import "reflect-metadata";
import { Greeter } from "@lib/core";
import { GreeterTool } from "@mcp/greeter";
import { container, injectable } from "tsyringe";

@injectable()
class OpenAILLM {
	chat(message: string): string {
		return `[OpenAI] ${message}`;
	}
}

@injectable()
class Waifu {
	constructor(private llm: OpenAILLM) {}

	talk(message: string): string {
		return this.llm.chat(message);
	}
}

const waifu = container.resolve(Waifu);
const greeter = container.resolve(Greeter);
const greeterTool = container.resolve(GreeterTool);

console.log(waifu.talk("안녕"));
console.log(greeter.greet("Brain"));
console.log(greeterTool.run("Waifu"));
