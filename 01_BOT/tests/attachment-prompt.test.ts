import { describe, expect, it } from "vitest";

import {
  attachmentPromptSection,
  promptWithAttachments,
} from "../src/features/chat/attachment-prompt.js";

describe("attachment prompt formatting", () => {
  it("formats prompt section with paths, images, notes, errors, and previews", () => {
    const section = attachmentPromptSection([
      {
        name: "notes.txt",
        url: "u",
        size: 3,
        contentType: "text/plain",
        path: "/tmp/notes.txt",
        textPreview: "hello",
      },
      {
        name: "photo.png",
        url: "u",
        size: 4,
        contentType: "image/png",
        path: "/tmp/photo.png",
        image: { type: "image", data: "abc", mimeType: "image/png" },
        note: "saved",
        error: "none",
      },
    ]);
    expect(section).toContain("[Discord attachments]");
    expect(section).toContain("saved_path: /tmp/notes.txt");
    expect(section).toContain("image attached to model input");
    expect(section).toContain("text_preview:");
    expect(promptWithAttachments("hello", [])).toBe("hello");
    expect(promptWithAttachments("hello", [{ name: "a", url: "u", size: 1, path: "/tmp/a" }])).toContain("hello");
  });
});
