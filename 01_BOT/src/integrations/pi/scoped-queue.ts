export class ScopedQueue {
  private readonly chains = new Map<string, Promise<unknown>>();

  run<T>(scopeId: string, job: () => Promise<T>) {
    const previous = this.chains.get(scopeId) ?? Promise.resolve();
    const next = previous.then(job, job);
    const cleanup = next.finally(() => {
      if (this.chains.get(scopeId) === cleanup) {
        this.chains.delete(scopeId);
      }
    });
    this.chains.set(scopeId, cleanup);
    return next;
  }
}
