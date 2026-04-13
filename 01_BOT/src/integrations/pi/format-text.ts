export const limitText = (text: string) =>
  text.length > 1900 ? `${text.slice(0, 1885)}\n\n(truncated)` : text;

export const formatList = (title: string, items: string[]) =>
  `${title}\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "- none"}`;
