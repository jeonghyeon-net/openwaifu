import type { DiscordAdminService } from "./discord-admin-types.js";
import { createCreateChannelTool } from "./create-channel-tool.js";
import { createCreateRoleTool } from "./create-role-tool.js";
import { createDeleteChannelTool } from "./delete-channel-tool.js";
import { createInspectServerTool } from "./inspect-server-tool.js";
import { createListServersTool } from "./list-servers-tool.js";
import { createModerateMemberTool } from "./moderate-member-tool.js";
import { createSendMessageTool } from "./send-message-tool.js";
import { createUpdateChannelTool } from "./update-channel-tool.js";
import { createUpdateMemberRolesTool } from "./update-member-roles-tool.js";

export const createDiscordManagementTools = (service: DiscordAdminService) => [
  createListServersTool(service),
  createInspectServerTool(service),
  createSendMessageTool(service),
  createCreateChannelTool(service),
  createUpdateChannelTool(service),
  createDeleteChannelTool(service),
  createCreateRoleTool(service),
  createUpdateMemberRolesTool(service),
  createModerateMemberTool(service),
];
