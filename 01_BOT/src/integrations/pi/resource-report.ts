import type { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

import { formatList, limitText } from "./format-text.js";

export const formatResourceReport = (loader: DefaultResourceLoader) =>
  limitText(
    [
      formatList("extensions", loader.getExtensions().extensions.map((item) => item.path)),
      formatList("skills", loader.getSkills().skills.map((item) => `${item.name} (${item.filePath})`)),
      formatList("prompts", loader.getPrompts().prompts.map((item) => `${item.name} (${item.filePath})`)),
      formatList("themes", loader.getThemes().themes.map((item) => item.sourcePath ?? item.name ?? "(unnamed)")),
    ].join("\n\n"),
  );
