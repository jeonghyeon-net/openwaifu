import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

let loaded = false;

/**
 * Walk up from cwd to find .env and load into process.env.
 * Does not overwrite existing values. Idempotent.
 */
export function loadEnv(): void {
	if (loaded) return;
	loaded = true;

	let dir = process.cwd();
	while (dir !== dirname(dir)) {
		const envPath = join(dir, ".env");
		if (existsSync(envPath)) {
			for (const line of readFileSync(envPath, "utf-8").split("\n")) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) continue;
				const eqIdx = trimmed.indexOf("=");
				if (eqIdx === -1) continue;
				const k = trimmed.slice(0, eqIdx).trim();
				let v = trimmed.slice(eqIdx + 1).trim();
				if (
					(v.startsWith('"') && v.endsWith('"')) ||
					(v.startsWith("'") && v.endsWith("'"))
				) {
					v = v.slice(1, -1);
				}
				if (!process.env[k]) process.env[k] = v;
			}
			return;
		}
		dir = dirname(dir);
	}
}

/**
 * Get an environment variable. Loads .env on first call.
 * Throws if the key is missing and no default is provided.
 */
export function env(key: string, defaultValue?: string): string {
	loadEnv();
	const val = process.env[key];
	if (val !== undefined) return val;
	if (defaultValue !== undefined) return defaultValue;
	throw new Error(`Missing environment variable: ${key}`);
}
