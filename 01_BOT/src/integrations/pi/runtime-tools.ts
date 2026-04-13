import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from "@mariozechner/pi-coding-agent";

export const createRuntimeTools = (cwd: string) => [
  createReadTool(cwd),
  createBashTool(cwd),
  createEditTool(cwd),
  createWriteTool(cwd),
  createGrepTool(cwd),
  createFindTool(cwd),
  createLsTool(cwd),
];
