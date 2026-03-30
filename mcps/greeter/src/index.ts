import type { Greeter } from "@lib/core";
import { injectable } from "tsyringe";

@injectable()
export class GreeterTool {
	constructor(private greeter: Greeter) {}

	run(name: string): string {
		return this.greeter.greet(name);
	}
}
