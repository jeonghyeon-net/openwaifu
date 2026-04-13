import { mkdtempSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { listLocalExtensionRoots, listLocalSkillRoots } from "../src/integrations/pi/local-resource-paths";

const created: string[] = [];
const Loader = vi.fn(function Loader(options: object) {
  Object.assign(this, options);
});
vi.mock("@mariozechner/pi-coding-agent", () => ({ DefaultResourceLoader: Loader }));

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { force: true, recursive: true })));
  Loader.mockClear();
});

describe("resource loading", () => {
  it("lists local extension and skill roots", async () => {
    const root = mkdtempSync(join(tmpdir(), "bot-loader-"));
    created.push(root);
    mkdirSync(join(root, "ext-a"));
    mkdirSync(join(root, "ext-b"));
    expect(await listLocalExtensionRoots(root)).toEqual([join(root, "ext-a"), join(root, "ext-b")]);
    expect(await listLocalExtensionRoots(join(root, "missing"))).toEqual([]);
    expect(await listLocalSkillRoots(root)).toEqual([root]);
    expect(await listLocalSkillRoots(join(root, "missing"))).toEqual([]);
  });

  it("passes discovered roots into DefaultResourceLoader", async () => {
    const root = mkdtempSync(join(tmpdir(), "bot-loader-"));
    created.push(root);
    mkdirSync(join(root, "extensions", "one"), { recursive: true });
    mkdirSync(join(root, "skills"), { recursive: true });
    const { createResourceLoader } = await import("../src/integrations/pi/create-resource-loader");
    const loader = await createResourceLoader({ agentDir: "/agent", repoRoot: "/repo", settingsManager: {}, extensionsRoot: join(root, "extensions"), skillsRoot: join(root, "skills") });
    expect(Loader).toHaveBeenCalled();
    expect(loader).toMatchObject({ cwd: "/repo", agentDir: "/agent", additionalExtensionPaths: [join(root, "extensions", "one")], additionalSkillPaths: [join(root, "skills")] });
  });
});
