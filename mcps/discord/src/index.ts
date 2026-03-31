import { env } from "@lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client, GatewayIntentBits } from "discord.js";
import { registerAutomodTools } from "./tools/automod.js";
import { registerChannelTools } from "./tools/channels.js";
import { registerEmojiTools } from "./tools/emojis.js";
import { registerEventTools } from "./tools/events.js";
import { registerForumTools } from "./tools/forums.js";
import { registerGuildTools } from "./tools/guild.js";
import { registerInviteTools } from "./tools/invites.js";
import { registerMemberTools } from "./tools/members.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerPresenceTools } from "./tools/presence.js";
import { registerReactionTools } from "./tools/reactions.js";
import { registerRoleTools } from "./tools/roles.js";
import { registerStickerTools } from "./tools/stickers.js";
import { registerThreadTools } from "./tools/threads.js";
import { registerVoiceTools } from "./tools/voice.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { createUtils } from "./utils.js";

const server = new McpServer({ name: "discord", version: "0.2.0" });

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildWebhooks,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildScheduledEvents,
		GatewayIntentBits.AutoModerationConfiguration,
		GatewayIntentBits.AutoModerationExecution,
	],
});

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
registerPresenceTools(server, client, utils);
registerEventTools(server, client, utils);
registerStickerTools(server, client, utils);
registerAutomodTools(server, client, utils);

const token = env("DISCORD_TOKEN");
const loginPromise = client.login(token);
await server.connect(new StdioServerTransport());
await loginPromise;
