import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	type SDKMessage,
	type SDKSession,
	unstable_v2_createSession,
	unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "tsyringe";
import {
	ChatBot,
	type ChatOptions,
	type ChatResult,
	type McpServerConfig,
} from "./chatbot.js";

function isTextDelta(msg: SDKMessage): string | null {
	if (
		msg.type === "stream_event" &&
		msg.event.type === "content_block_delta" &&
		msg.event.delta.type === "text_delta"
	) {
		return msg.event.delta.text;
	}
	return null;
}

function isIdle(msg: SDKMessage): boolean {
	return (
		msg.type === "system" &&
		msg.subtype === "session_state_changed" &&
		msg.state === "idle"
	);
}

@injectable()
export class ClaudeCodeBot extends ChatBot {
	private sessions = new Map<string, SDKSession>();

	async setMcpServers(servers: Record<string, McpServerConfig>) {
		const mcpJson = {
			mcpServers: Object.fromEntries(
				Object.entries(servers).map(([name, config]) => [
					name,
					{ command: config.command, args: config.args },
				]),
			),
		};
		writeFileSync(
			join(process.cwd(), ".mcp.json"),
			JSON.stringify(mcpJson, null, "\t"),
		);
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		const self = this;
		let sessionId = options?.sessionId ?? "";

		const stream = async function* () {
			let session: SDKSession;

			const cached = sessionId ? self.sessions.get(sessionId) : undefined;

			if (cached) {
				session = cached;
			} else if (sessionId) {
				session = unstable_v2_resumeSession(sessionId, {
					model: "claude-sonnet-4-6",
					permissionMode: "bypassPermissions",
				});
				self.sessions.set(sessionId, session);
			} else {
				session = unstable_v2_createSession({
					model: "claude-sonnet-4-6",
					permissionMode: "bypassPermissions",
				});
			}

			await session.send(message);

			for await (const msg of session.stream()) {
				if (!sessionId && msg.type === "system" && msg.subtype === "init") {
					sessionId = msg.session_id;
					self.sessions.set(sessionId, session);
				}

				const text = isTextDelta(msg);
				if (text !== null) {
					yield text;
				}

				if (isIdle(msg)) break;
			}
		};

		return {
			get sessionId() {
				return sessionId;
			},
			stream: stream(),
		};
	}
}
