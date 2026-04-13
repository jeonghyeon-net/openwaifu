import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadChatAttachments } from "../src/features/chat/attachment-loader.js";

const roots: string[] = [];
const makeResponse = (body: BodyInit, status = 200) => new Response(body, { status });

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

beforeEach(() => {
  vi.stubGlobal("fetch", (url: string | URL | Request) => {
    const key = String(url);
    if (key.endsWith("notes.txt")) return Promise.resolve(makeResponse("hello\nworld"));
    if (key.endsWith("photo.png")) return Promise.resolve(makeResponse(new Uint8Array([1, 2, 3])));
    if (key.endsWith("big.png")) return Promise.resolve(makeResponse(Buffer.alloc(5 * 1024 * 1024 + 1, 1)));
    if (key.endsWith("archive.zip")) return Promise.resolve(makeResponse(new Uint8Array([9, 9])));
    if (key.endsWith("explode.bin")) return Promise.reject("explode");
    return Promise.resolve(makeResponse("nope", 404));
  });
});

describe("attachment loader", () => {
  it("returns empty list when no attachments exist", async () => {
    await expect(loadChatAttachments("/repo", "scope:1", "m0", [])).resolves.toEqual([]);
  });

  it("downloads text, image, oversized image, binary, and failed attachments", async () => {
    const root = mkdtempSync(join(tmpdir(), "attachments-"));
    roots.push(root);
    const attachments = await loadChatAttachments(root, "scope:1", "m1", [
      { name: "notes.txt", url: "https://x/notes.txt", size: 1, contentType: "text/plain" },
      { name: "photo.png", url: "https://x/photo.png", size: 3, contentType: "image/png" },
      { name: "big.png", url: "https://x/big.png", size: 9, contentType: "image/png" },
      { name: "archive.zip", url: "https://x/archive.zip", size: 2 },
      { name: "missing.bin", url: "https://x/missing.bin", size: 0 },
      { name: "explode.bin", url: "https://x/explode.bin", size: 0 },
    ]);
    expect(attachments[0]).toMatchObject({ textPreview: "hello\nworld" });
    expect(attachments[1]?.image).toEqual({ type: "image", data: Buffer.from([1, 2, 3]).toString("base64"), mimeType: "image/png" });
    expect(attachments[2]?.note).toBe("image too large for direct vision input");
    expect(attachments[3]?.note).toBe("binary attachment saved locally; use saved path if needed");
    expect(attachments[4]?.error).toBe("download failed: 404");
    expect(attachments[5]?.error).toBe("explode");
    expect(attachments[0]?.path).toContain("discord-attachments");
  });
});
