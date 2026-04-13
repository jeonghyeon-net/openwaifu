export type RuntimeTextChunk = { type: "text"; text: string };

export type RuntimeStreamState = {
  chunks: RuntimeTextChunk[];
  push(chunk: RuntimeTextChunk): void;
  finish(): void;
  wait(): Promise<void>;
  isDone(): boolean;
};

export const createRuntimeStreamState = (): RuntimeStreamState => {
  const chunks: RuntimeTextChunk[] = [];
  let done = false;
  let notify: (() => void) | undefined;

  const wake = () => {
    notify?.();
    notify = undefined;
  };

  return {
    chunks,
    push(chunk) {
      chunks.push(chunk);
      wake();
    },
    finish() {
      done = true;
      wake();
    },
    async wait() {
      if (done || chunks.length > 0) return;
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    },
    isDone() {
      return done;
    },
  };
};
