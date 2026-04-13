import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	BeforeAgentStartEvent,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";

import {
	PERSONA_FILENAME,
	PERSONA_RELATIVE_PATH,
	createBeforeAgentStartHandler,
	personaPathForCwd,
	readPersonaMarkdown,
} from "../src/persona";

const tempDirs: string[] = [];
const createTempDir = async () => {
	const dir = await mkdtemp(join(tmpdir(), "openwaifu-persona-extension-"));
	tempDirs.push(dir);
	return dir;
};

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("personaPathForCwd", () => {
	it("points to extension-local PERSONA file", () => {
		expect(personaPathForCwd("/tmp/project")).toBe(
			"/tmp/project/02_EXTENSIONS/persona/PERSONA",
		);
		expect(PERSONA_FILENAME).toBe("PERSONA");
		expect(PERSONA_RELATIVE_PATH).toBe("02_EXTENSIONS/persona/PERSONA");
	});
});

describe("readPersonaMarkdown", () => {
	it("returns undefined when file missing", async () => {
		const dir = await createTempDir();
		expect(readPersonaMarkdown(join(dir, PERSONA_FILENAME))).toBeUndefined();
	});

	it("returns undefined when file blank", async () => {
		const dir = await createTempDir();
		await writeFile(join(dir, PERSONA_FILENAME), "  \n\n  ");
		expect(readPersonaMarkdown(join(dir, PERSONA_FILENAME))).toBeUndefined();
	});

	it("returns raw markdown content when file exists", async () => {
		const dir = await createTempDir();
		await writeFile(join(dir, PERSONA_FILENAME), "line 1\nline 2\n");
		expect(readPersonaMarkdown(join(dir, PERSONA_FILENAME))).toBe(
			"line 1\nline 2\n",
		);
	});

	it("returns undefined when file cannot be read", async () => {
		const dir = await createTempDir();
		await mkdir(join(dir, PERSONA_FILENAME));
		expect(readPersonaMarkdown(join(dir, PERSONA_FILENAME))).toBeUndefined();
	});
});

describe("createBeforeAgentStartHandler", () => {
	it("returns undefined when persona file missing", async () => {
		const dir = await createTempDir();
		const handler = createBeforeAgentStartHandler();
		await expect(
			handler(
				{ systemPrompt: "base prompt" } as BeforeAgentStartEvent,
				{ cwd: dir } as ExtensionContext,
			),
		).resolves.toBeUndefined();
	});

	it("appends raw PERSONA contents to system prompt", async () => {
		const dir = await createTempDir();
		const personaPath = join(dir, PERSONA_FILENAME);
		await writeFile(personaPath, "persona body\n");
		const handler = createBeforeAgentStartHandler(personaPath);
		await expect(
			handler(
				{ systemPrompt: "base prompt" } as BeforeAgentStartEvent,
				{ cwd: dir } as ExtensionContext,
			),
		).resolves.toEqual({
			systemPrompt: "base prompt\n\npersona body\n",
		});
	});
});
