import { execSync } from "node:child_process";
import { cpus, freemem, totalmem } from "node:os";

// 초기값을 미리 읽어서 첫 호출부터 유효한 CPU% 제공
const initCores = cpus();
let prevIdle = initCores.reduce((s, c) => s + c.times.idle, 0);
let prevTotal = initCores.reduce(
	(s, c) =>
		s + c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle,
	0,
);

export function getSystemStats(): {
	cpu: number;
	ram: number;
	disk: number;
} {
	const cores = cpus();
	let idle = 0;
	let total = 0;
	for (const core of cores) {
		idle += core.times.idle;
		total +=
			core.times.user +
			core.times.nice +
			core.times.sys +
			core.times.irq +
			core.times.idle;
	}

	const cpu =
		prevTotal > 0
			? Math.round((1 - (idle - prevIdle) / (total - prevTotal)) * 100)
			: 0;
	prevIdle = idle;
	prevTotal = total;

	const ram = Math.round((1 - freemem() / totalmem()) * 100);

	let disk = 0;
	try {
		// macOS APFS: Data 볼륨이 실제 사용량, 없으면 루트 사용
		const df = execSync("df -h /System/Volumes/Data 2>/dev/null || df -h /", {
			encoding: "utf-8",
		});
		const last = df.trim().split("\n").pop() ?? "";
		const match = last.match(/(\d+)%/);
		if (match) disk = Number(match[1]);
	} catch {
		/* ignore */
	}

	return { cpu, ram, disk };
}

export function formatStats(stats: {
	cpu: number;
	ram: number;
	disk: number;
}): string {
	return `CPU ${stats.cpu}% | RAM ${stats.ram}% | DISK ${stats.disk}%`;
}
