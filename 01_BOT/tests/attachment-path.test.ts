import { describe, expect, it } from "vitest";

import {
  attachmentDirectoryForMessage,
  attachmentDirectoryForScope,
  attachmentPathForName,
} from "../src/features/chat/attachment-path.js";

describe("attachment paths", () => {
  it("sanitizes scope ids, message ids, and file names", () => {
    expect(attachmentDirectoryForScope("/repo", "channel:1/user")).toBe(
      "/repo/01_BOT/.data/discord-attachments/channel_1_user",
    );
    expect(attachmentDirectoryForMessage("/repo", "channel:1/user", "msg:2")).toBe(
      "/repo/01_BOT/.data/discord-attachments/channel_1_user/msg_2",
    );
    expect(attachmentPathForName("/tmp/dir", 3, "my file?.png")).toBe("/tmp/dir/03_my_file_.png");
    expect(attachmentPathForName("/tmp/dir", 0, "***")).toBe("/tmp/dir/00____");
    expect(attachmentPathForName("/tmp/dir", 1, "")).toBe("/tmp/dir/01_attachment");
  });
});
