import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";

export const PERSONA_FILENAME = "PERSONA";

export const personaPathFromModuleUrl = (moduleUrl: string) =>
	fileURLToPath(new URL(`../${PERSONA_FILENAME}`, moduleUrl));

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
	(personaPath = personaPathFromModuleUrl(import.meta.url)) =>
	async (
		event: BeforeAgentStartEvent,
		_ctx: ExtensionContext,
	): Promise<BeforeAgentStartEventResult | undefined> => {
		const personaMarkdown = readPersonaMarkdown(personaPath);
		if (!personaMarkdown) return undefined;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${personaMarkdown}`,
		};
	};
