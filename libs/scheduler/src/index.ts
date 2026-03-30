import { Database } from "bun:sqlite";

export type Schedule = {
	id: string;
	cronExpression: string;
	prompt: string;
	createdBy: string;
	enabled: boolean;
	once: boolean;
};

type ScheduleRow = {
	id: string;
	cron_expression: string;
	prompt: string;
	created_by: string;
	enabled: number;
	once: number;
};

function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Parse a single cron field against a value.
 * Supports: *, specific numbers, ranges (1-5), steps (asterisk/5, 1-10/2), comma lists (1,3,5).
 */
function matchesCronField(field: string, value: number, max: number): boolean {
	for (const part of field.split(",")) {
		if (matchesCronPart(part.trim(), value, max)) return true;
	}
	return false;
}

function matchesCronPart(part: string, value: number, max: number): boolean {
	const stepSplit = part.split("/");
	const rangePart = stepSplit[0];
	if (rangePart === undefined) return false;
	const step = stepSplit[1] !== undefined ? Number(stepSplit[1]) : undefined;

	if (step !== undefined && (Number.isNaN(step) || step <= 0)) return false;

	if (rangePart === "*") {
		if (step === undefined) return true;
		return value % step === 0;
	}

	if (rangePart.includes("-")) {
		const [startStr, endStr] = rangePart.split("-");
		const start = Number(startStr);
		const end = Number(endStr);
		if (Number.isNaN(start) || Number.isNaN(end)) return false;
		if (value < start || value > end) return false;
		if (step === undefined) return true;
		return (value - start) % step === 0;
	}

	const num = Number(rangePart);
	if (Number.isNaN(num)) return false;
	if (step !== undefined) {
		if (value < num || value > max) return false;
		return (value - num) % step === 0;
	}
	return value === num;
}

/**
 * Check if a cron expression matches a given date.
 * Cron format: minute hour dayOfMonth month dayOfWeek
 * dayOfWeek: 0 = Sunday, 6 = Saturday
 */
export function matchesCron(expression: string, date: Date): boolean {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 5) return false;

	const minute = date.getMinutes();
	const hour = date.getHours();
	const dayOfMonth = date.getDate();
	const month = date.getMonth() + 1;
	const dayOfWeek = date.getDay();

	const [fMinute, fHour, fDayOfMonth, fMonth, fDayOfWeek] = fields;
	if (
		fMinute === undefined ||
		fHour === undefined ||
		fDayOfMonth === undefined ||
		fMonth === undefined ||
		fDayOfWeek === undefined
	)
		return false;

	if (!matchesCronField(fMinute, minute, 59)) return false;
	if (!matchesCronField(fHour, hour, 23)) return false;
	if (!matchesCronField(fDayOfMonth, dayOfMonth, 31)) return false;
	if (!matchesCronField(fMonth, month, 12)) return false;
	if (!matchesCronField(fDayOfWeek, dayOfWeek, 6)) return false;

	return true;
}

const FIELD_RANGES: [number, number][] = [
	[0, 59],
	[0, 23],
	[1, 31],
	[1, 12],
	[0, 6],
];

function isValidCronField(field: string, min: number, max: number): boolean {
	for (const part of field.split(",")) {
		const [rangePart, stepStr] = part.split("/");
		if (rangePart === undefined) return false;

		if (stepStr !== undefined) {
			const step = Number(stepStr);
			if (!Number.isInteger(step) || step <= 0) return false;
		}

		if (rangePart === "*") continue;

		if (rangePart.includes("-")) {
			const parts = rangePart.split("-").map(Number);
			const a = parts[0];
			const b = parts[1];
			if (a === undefined || b === undefined) return false;
			if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
			if (a < min || a > max || b < min || b > max || a > b) return false;
			continue;
		}

		const num = Number(rangePart);
		if (!Number.isInteger(num) || num < min || num > max) return false;
	}
	return true;
}

export function isValidCron(expression: string): boolean {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 5) return false;
	return fields.every((field, i) => {
		const [min, max] = FIELD_RANGES[i] ?? [0, 0];
		return isValidCronField(field, min, max);
	});
}

export class Scheduler {
	private db: Database;
	private timer: ReturnType<typeof setInterval> | undefined;
	private lastTriggered: Map<string, number> = new Map();

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
		this.db.run("PRAGMA journal_mode=WAL");
		this.db.run("PRAGMA busy_timeout=5000");
		this.migrate();
	}

	private migrate(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS schedules (
				id TEXT PRIMARY KEY,
				cron_expression TEXT NOT NULL,
				prompt TEXT NOT NULL,
				created_by TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1,
				once INTEGER NOT NULL DEFAULT 0
			)
		`);
	}

	add(schedule: Omit<Schedule, "id" | "enabled">): string {
		if (!isValidCron(schedule.cronExpression)) {
			throw new Error(`Invalid cron expression: ${schedule.cronExpression}`);
		}
		const id = generateId();
		this.db.run(
			`INSERT INTO schedules (id, cron_expression, prompt, created_by, enabled, once)
			 VALUES (?, ?, ?, ?, 1, ?)`,
			[
				id,
				schedule.cronExpression,
				schedule.prompt,
				schedule.createdBy,
				schedule.once ? 1 : 0,
			],
		);
		return id;
	}

	remove(id: string): boolean {
		const result = this.db.run("DELETE FROM schedules WHERE id = ?", [id]);
		this.lastTriggered.delete(id);
		return result.changes > 0;
	}

	list(): Schedule[] {
		const rows = this.db
			.query<ScheduleRow, []>("SELECT * FROM schedules")
			.all();
		return rows.map(rowToSchedule);
	}

	enable(id: string): boolean {
		const result = this.db.run(
			"UPDATE schedules SET enabled = 1 WHERE id = ?",
			[id],
		);
		return result.changes > 0;
	}

	disable(id: string): boolean {
		const result = this.db.run(
			"UPDATE schedules SET enabled = 0 WHERE id = ?",
			[id],
		);
		return result.changes > 0;
	}

	start(onTrigger: (schedule: Schedule) => Promise<void>): void {
		if (this.timer) return;

		this.timer = setInterval(() => {
			void this.tick(onTrigger);
		}, 60_000);

		// Also run immediately on start
		void this.tick(onTrigger);
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
		this.db.close();
	}

	private async tick(
		onTrigger: (schedule: Schedule) => Promise<void>,
	): Promise<void> {
		const now = new Date();
		// Floor to the current minute
		const minuteKey = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			now.getHours(),
			now.getMinutes(),
		).getTime();

		const rows = this.db
			.query<ScheduleRow, []>("SELECT * FROM schedules WHERE enabled = 1")
			.all();

		for (const row of rows) {
			const schedule = rowToSchedule(row);
			if (!matchesCron(schedule.cronExpression, now)) continue;

			const lastTime = this.lastTriggered.get(schedule.id);
			if (lastTime === minuteKey) continue;

			this.lastTriggered.set(schedule.id, minuteKey);
			if (schedule.once) {
				this.remove(schedule.id);
			}
			onTrigger(schedule).catch((err) => {
				console.error(`Scheduler trigger error for ${schedule.id}:`, err);
			});
		}
	}
}

function rowToSchedule(row: ScheduleRow): Schedule {
	return {
		id: row.id,
		cronExpression: row.cron_expression,
		prompt: row.prompt,
		createdBy: row.created_by,
		enabled: row.enabled === 1,
		once: row.once === 1,
	};
}
