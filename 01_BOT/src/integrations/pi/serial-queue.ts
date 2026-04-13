export class SerialQueue {
  private current: Promise<unknown> = Promise.resolve();

  run<T>(job: () => Promise<T>) {
    const next = this.current.then(job, job);
    this.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
