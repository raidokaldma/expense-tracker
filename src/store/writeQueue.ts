// Every write runs through one queue, in the order it was made. Reloads, undo and imports wait their turn too,
// so nothing reads storage before earlier writes have landed.
let queue: Promise<unknown> = Promise.resolve();

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  // one failed task must not block the ones after it
  queue = run.catch(() => undefined);
  return run;
}

export function writesDone() {
  return queue;
}
