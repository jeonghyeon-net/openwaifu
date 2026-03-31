import { execSync } from "node:child_process";
import { cpus, totalmem } from "node:os";

const PAGE_SIZE = 16384; // macOS default

// 초기값을 미리 읽어서 첫 호출부터 유효한 CPU% 제공
const initCores = cpus();
let prevIdle = initCores.reduce((s, c) => s + c.times.idle, 0);
let prevTotal = initCores.reduce(
	(s, c) =>
		s + c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle,
	0,
);

function getCpu(): number {
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
	const dTotal = total - prevTotal;
	const cpu =
		dTotal > 0 ? Math.round((1 - (idle - prevIdle) / dTotal) * 100) : 0;
	prevIdle = idle;
	prevTotal = total;
	return cpu;
}

function getRam(): number {
	try {
		// macOS: vm_stat으로 active + wired = 실사용 메모리
		const vmstat = execSync("vm_stat", { encoding: "utf-8" });
		const pages = (key: string) => {
			const m = vmstat.match(new RegExp(`${key}:\\s+(\\d+)`));
			return m ? Number(m[1]) : 0;
		};
		const used =
			(pages("Pages active") + pages("Pages wired down")) * PAGE_SIZE;
		return Math.round((used / totalmem()) * 100);
	} catch {
		// Linux fallback: /proc/meminfo
		try {
			const meminfo = execSync("cat /proc/meminfo", { encoding: "utf-8" });
			const totalMatch = meminfo.match(/MemTotal:\s+(\d+)/);
			const availMatch = meminfo.match(/MemAvailable:\s+(\d+)/);
			if (totalMatch && availMatch) {
				return Math.round(
					(1 - Number(availMatch[1]) / Number(totalMatch[1])) * 100,
				);
			}
		} catch {
			/* ignore */
		}
		return 0;
	}
}

function getDisk(): number {
	try {
		// macOS APFS: 컨테이너 전체 사용량 = Size - Avail
		const df = execSync("df /System/Volumes/Data 2>/dev/null || df /", {
			encoding: "utf-8",
		});
		const lines = df.trim().split("\n");
		const cols = lines[lines.length - 1]?.split(/\s+/);
		if (cols && cols.length >= 4) {
			const size = Number(cols[1]);
			const avail = Number(cols[3]);
			if (size > 0) return Math.round(((size - avail) / size) * 100);
		}
	} catch {
		/* ignore */
	}
	return 0;
}

export function getSystemStats(): {
	cpu: number;
	ram: number;
	disk: number;
} {
	return { cpu: getCpu(), ram: getRam(), disk: getDisk() };
}

export function formatStats(stats: {
	cpu: number;
	ram: number;
	disk: number;
}): string {
	return `CPU ${stats.cpu}% | RAM ${stats.ram}% | DISK ${stats.disk}%`;
}
