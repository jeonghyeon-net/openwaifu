import { env } from "@lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "discord.js";
import { registerAutomodTools } from "./tools/automod.js";
import { registerChannelTools } from "./tools/channels.js";
import { registerEmojiTools } from "./tools/emojis.js";
import { registerEventTools } from "./tools/events.js";
import { registerForumTools } from "./tools/forums.js";
import { registerGuildTools } from "./tools/guild.js";
import { registerInviteTools } from "./tools/invites.js";
import { registerMemberTools } from "./tools/members.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerReactionTools } from "./tools/reactions.js";
import { registerRoleTools } from "./tools/roles.js";
import { registerStickerTools } from "./tools/stickers.js";
import { registerThreadTools } from "./tools/threads.js";
import { registerVoiceTools } from "./tools/voice.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { createUtils } from "./utils.js";

const server = new McpServer({ name: "discord", version: "0.2.0" });

// REST-only: 게이트웨이 연결 없이 API 호출만 사용
// presence는 brain의 DiscordPlatform이 관리하므로 게이트웨이 불필요
const client = new Client({ intents: [] });

const utils = createUtils(client);

registerMessageTools(server, client, utils);
registerReactionTools(server, client, utils);
registerChannelTools(server, client, utils);
registerThreadTools(server, client, utils);
registerForumTools(server, client, utils);
registerRoleTools(server, client, utils);
registerMemberTools(server, client, utils);
registerWebhookTools(server, client, utils);
registerInviteTools(server, client, utils);
registerGuildTools(server, client, utils);
registerEmojiTools(server, client, utils);
registerVoiceTools(server, client, utils);
registerEventTools(server, client, utils);
registerStickerTools(server, client, utils);
registerAutomodTools(server, client, utils);

const token = env("DISCORD_TOKEN");
client.token = token;
client.rest.setToken(token);
await server.connect(new StdioServerTransport());
