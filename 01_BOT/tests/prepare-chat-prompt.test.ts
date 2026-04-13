import { describe, expect, it, vi } from "vitest";

const loadChatAttachments = vi.fn();
vi.mock("../src/features/chat/attachment-loader.js", () => ({ loadChatAttachments }));

describe("prepareChatPrompt", () => {
  it("combines prompt text with attachment context and images", async () => {
    loadChatAttachments.mockResolvedValueOnce([
      {
        name: "notes.txt",
        url: "u",
        size: 3,
        path: "/tmp/notes.txt",
        textPreview: "hello",
      },
      {
        name: "photo.png",
        url: "u",
        size: 4,
        path: "/tmp/photo.png",
        image: { type: "image", data: "abc", mimeType: "image/png" },
      },
    ]);
    const { prepareChatPrompt } = await import("../src/features/chat/prepare-chat-prompt.js");
    await expect(
      prepareChatPrompt({ repoRoot: "/repo", scopeId: "scope:1", messageId: "m1", prompt: "hello", attachments: [] }),
    ).resolves.toEqual({
      prompt: expect.stringContaining("[Discord attachments]"),
      images: [{ type: "image", data: "abc", mimeType: "image/png" }],
    });
    expect(loadChatAttachments).toHaveBeenCalledWith("/repo", "scope:1", "m1", []);

    loadChatAttachments.mockResolvedValueOnce([]);
    await expect(
      prepareChatPrompt({ repoRoot: "/repo", scopeId: "scope:1", messageId: "m2", prompt: "plain", attachments: [] }),
    ).resolves.toEqual({ prompt: "plain", images: undefined });
  });
});
