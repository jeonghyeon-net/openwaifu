import "reflect-metadata";
import { greet } from "@lib/core";
import { greeterTool } from "@mcp/greeter";
import { Container, inject, injectable } from "inversify";

interface LLM {
	chat(message: string): string;
}

@injectable()
class OpenAILLM implements LLM {
	chat(message: string): string {
		return `[OpenAI] ${message}`;
	}
}

@injectable()
class Waifu {
	constructor(@inject("LLM") private llm: LLM) {}

	talk(message: string): string {
		return this.llm.chat(message);
	}
}

const container = new Container();
container.bind<LLM>("LLM").to(OpenAILLM);
container.bind(Waifu).toSelf();

const waifu = container.get(Waifu);
console.log(waifu.talk("안녕"));
console.log(greet("Brain"));
console.log(greeterTool("Waifu"));
