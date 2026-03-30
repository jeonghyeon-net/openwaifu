import { Database } from "bun:sqlite";

export type Schedule = {
	id: string;
	cronExpression: string;
	prompt: string;
	channelId: string;
	createdBy: string;
	enabled: boolean;
};

type ScheduleRow = {
	id: string;
	cron_expression: string;
	prompt: string;
	channel_id: string;
	created_by: string;
	enabled: number;
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

export class Scheduler {
	private db: Database;
	private timer: ReturnType<typeof setInterval> | undefined;
	private lastTriggered: Map<string, number> = new Map();

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
		this.migrate();
	}

	private migrate(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS schedules (
				id TEXT PRIMARY KEY,
				cron_expression TEXT NOT NULL,
				prompt TEXT NOT NULL,
				channel_id TEXT NOT NULL,
				created_by TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1
			)
		`);
	}

	add(schedule: Omit<Schedule, "id" | "enabled">): string {
		const id = generateId();
		this.db.run(
			`INSERT INTO schedules (id, cron_expression, prompt, channel_id, created_by, enabled)
			 VALUES (?, ?, ?, ?, ?, 1)`,
			[
				id,
				schedule.cronExpression,
				schedule.prompt,
				schedule.channelId,
				schedule.createdBy,
			],
		);
		return id;
	}

	remove(id: string): boolean {
		const result = this.db.run("DELETE FROM schedules WHERE id = ?", [id]);
		return result.changes > 0;
	}

	list(): Schedule[] {
		const rows = this.db
			.query<ScheduleRow, []>("SELECT * FROM schedules")
			.all();
		return rows.map(rowToSchedule);
	}

	enable(id: string): void {
		this.db.run("UPDATE schedules SET enabled = 1 WHERE id = ?", [id]);
	}

	disable(id: string): void {
		this.db.run("UPDATE schedules SET enabled = 0 WHERE id = ?", [id]);
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
		channelId: row.channel_id,
		createdBy: row.created_by,
		enabled: row.enabled === 1,
	};
}
