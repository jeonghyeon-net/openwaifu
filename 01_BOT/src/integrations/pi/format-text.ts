export const limitText = (text: string) =>
  text.length > 1900 ? `${text.slice(0, 1885)}\n\n(truncated)` : text;
