import { describe, expect, it } from "vitest";

import {
  isImageAttachment,
  isTextAttachment,
} from "../src/features/chat/attachment-classify.js";

describe("attachment classification", () => {
  it("detects image and text attachments by content type or extension", () => {
    expect(isImageAttachment({ name: "photo.png", url: "u", size: 1 })).toBe(true);
    expect(isImageAttachment({ name: "photo.bin", url: "u", size: 1, contentType: "image/jpeg" })).toBe(true);
    expect(isImageAttachment({ name: "notes.txt", url: "u", size: 1 })).toBe(false);
    expect(isTextAttachment({ name: "notes.txt", url: "u", size: 1 })).toBe(true);
    expect(isTextAttachment({ name: "data.bin", url: "u", size: 1, contentType: "application/json" })).toBe(true);
    expect(isTextAttachment({ name: "archive.zip", url: "u", size: 1 })).toBe(false);
  });
});
