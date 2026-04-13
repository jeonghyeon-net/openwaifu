import { describe, expect, it } from "vitest";

import { createRuntimeStreamState } from "../src/integrations/pi/runtime-stream-state.js";

describe("runtime stream state", () => {
  it("returns immediately when chunk already buffered", async () => {
    const state = createRuntimeStreamState();
    state.push({ type: "text", text: "a" });

    await expect(state.wait()).resolves.toBeUndefined();
    expect(state.chunks).toEqual([{ type: "text", text: "a" }]);
    expect(state.isDone()).toBe(false);
  });

  it("returns immediately when state already done", async () => {
    const state = createRuntimeStreamState();
    state.finish();

    await expect(state.wait()).resolves.toBeUndefined();
    expect(state.isDone()).toBe(true);
  });

  it("waits until chunk arrives", async () => {
    const state = createRuntimeStreamState();
    let resolved = false;
    const pending = state.wait().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    state.push({ type: "text", text: "later" });
    await pending;
    expect(resolved).toBe(true);
    expect(state.chunks).toEqual([{ type: "text", text: "later" }]);
  });

  it("waits until finish wakes waiter", async () => {
    const state = createRuntimeStreamState();
    let resolved = false;
    const pending = state.wait().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    state.finish();
    await pending;
    expect(resolved).toBe(true);
    expect(state.isDone()).toBe(true);
  });
});
