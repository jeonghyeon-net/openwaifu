import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerInviteTools(
	server: McpServer,
	client: Client,
	utils: Utils,
) {
	server.registerTool(
		"create_invite",
		{
			description: "Create an invite link for a channel",
			inputSchema: {
				channelId: z.string(),
				maxAge: z
					.number()
					.optional()
					.describe("Seconds until expiry (0 = never)"),
				maxUses: z.number().optional().describe("Max uses (0 = unlimited)"),
				temporary: z.boolean().optional().describe("Kick when disconnected"),
				unique: z.boolean().optional().describe("Create unique invite"),
			},
		},
		async ({ channelId, maxAge, maxUses, temporary, unique }) => {
			try {
				const ch = await utils.getChannel(channelId);
				if (!("createInvite" in ch))
					throw new Error("Channel does not support invites");
				const opts: Record<string, unknown> = {};
				if (maxAge !== undefined) opts["maxAge"] = maxAge;
				if (maxUses !== undefined) opts["maxUses"] = maxUses;
				if (temporary !== undefined) opts["temporary"] = temporary;
				if (unique !== undefined) opts["unique"] = unique;
				const invite = await (ch as any).createInvite(opts);
				return ok(
					JSON.stringify({
						code: invite.code,
						url: invite.url,
						maxAge: invite.maxAge,
						maxUses: invite.maxUses,
						expiresAt: invite.expiresAt?.toISOString(),
					}),
				);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"list_channel_invites",
		{
			description: "List active invites for a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) => {
			try {
				const ch = await utils.getChannel(channelId);
				if (!("fetchInvites" in ch))
					throw new Error("Channel does not support invites");
				const invites = await (ch as any).fetchInvites();
				const result = invites.map((i: any) => ({
					code: i.code,
					url: i.url,
					uses: i.uses,
					maxUses: i.maxUses,
					expiresAt: i.expiresAt?.toISOString(),
					inviter: i.inviter?.username,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_invite_info",
		{
			description: "Get information about an invite by code",
			inputSchema: { code: z.string() },
		},
		async ({ code }) => {
			try {
				const invite = await client.fetchInvite(code);
				return ok(
					JSON.stringify({
						code: invite.code,
						guild: invite.guild
							? { id: invite.guild.id, name: invite.guild.name }
							: null,
						channel: invite.channel
							? { id: invite.channel.id, name: invite.channel.name }
							: null,
						inviter: invite.inviter?.username,
						memberCount: invite.memberCount,
						presenceCount: invite.presenceCount,
						expiresAt: invite.expiresAt?.toISOString(),
					}),
				);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_invite",
		{
			description: "Delete/revoke an invite",
			inputSchema: { code: z.string() },
		},
		async ({ code }) => {
			try {
				const invite = await client.fetchInvite(code);
				await invite.delete();
				return ok(`Deleted invite ${code}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
