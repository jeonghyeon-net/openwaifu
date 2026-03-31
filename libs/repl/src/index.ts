import { createInterface } from "node:readline/promises";
import type { Bot } from "@lib/llm";

export async function startRepl(bot: Bot): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log('Type a message to chat. "exit" to quit.\n');

	for (;;) {
		const input = await rl.question("> ");

		if (input.trim() === "exit") break;
		if (input.trim() === "") continue;

		for await (const chunk of bot.send(input)) {
			if (chunk.type === "text") {
				process.stdout.write(chunk.text);
			}
		}
		console.log("\n");
	}

	rl.close();
}
