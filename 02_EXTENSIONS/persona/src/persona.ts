import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	BeforeAgentStartEvent,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";

export const PERSONA_FILENAME = "PERSONA";
export const PERSONA_RELATIVE_PATH = join(
	"02_EXTENSIONS",
	"persona",
	PERSONA_FILENAME,
);

export const personaPathForCwd = (cwd: string) =>
	join(cwd, PERSONA_RELATIVE_PATH);

export const readPersonaMarkdown = (personaPath: string) => {
	try {
		if (!existsSync(personaPath)) return undefined;
		const content = readFileSync(personaPath, "utf8");
		return content.trim().length > 0 ? content : undefined;
	} catch {
		return undefined;
	}
};

export const createBeforeAgentStartHandler =
	(personaPath?: string) =>
	async (event: BeforeAgentStartEvent, ctx: ExtensionContext) => {
		const resolvedPath = personaPath ?? personaPathForCwd(ctx.cwd);
		const personaMarkdown = readPersonaMarkdown(resolvedPath);
		if (!personaMarkdown) return undefined;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${personaMarkdown}`,
		};
	};
