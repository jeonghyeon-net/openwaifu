import { createInterface } from "node:readline/promises";
import type { ChatBot } from "@lib/llm";

export async function startRepl(bot: ChatBot): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log('Type a message to chat. "exit" to quit.\n');

	for (;;) {
		const input = await rl.question("> ");

		if (input.trim() === "exit") break;
		if (input.trim() === "") continue;

		const chat = bot.chat(input);

		for await (const chunk of chat.stream) {
			if (chunk.type === "text") {
				process.stdout.write(chunk.text);
			}
		}
		console.log("\n");
	}

	rl.close();
}
