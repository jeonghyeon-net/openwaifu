export function ok(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

export function err(e: unknown) {
	const text = e instanceof Error ? e.message : String(e);
	return { content: [{ type: "text" as const, text }], isError: true as const };
}
