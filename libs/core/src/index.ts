import { injectable } from "tsyringe";

@injectable()
export class Greeter {
	greet(name: string): string {
		return `Hello, ${name}!`;
	}
}
