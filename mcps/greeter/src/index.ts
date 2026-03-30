import { greet } from "@lib/core";

export function greeterTool(name: string): string {
	return greet(name);
}
