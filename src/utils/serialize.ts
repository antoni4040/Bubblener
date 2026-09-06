/**
 * Runs async tasks one at a time, in call order.
 *
 * Several tabs share one background script, so `read → modify → write` against
 * browser storage is a lost-update waiting to happen: two analyses finishing
 * near each other both read the same totals and the later write erases the
 * earlier one. Storage has no atomic increment, so the fix is to stop the
 * interleaving.
 *
 * Scoped to a single service-worker instance, which is all that is needed:
 * every tab's messages are handled by the same worker.
 */
export const createSerializer = () => {
    let tail: Promise<unknown> = Promise.resolve();

    return <T>(task: () => Promise<T>): Promise<T> => {
        // Chained off the previous task's settlement rather than its value, so
        // one failed update cannot wedge the queue for everything after it.
        const run = tail.then(task, task);
        tail = run.catch(() => { /* failures are the caller's to handle */ });
        return run;
    };
};

export default createSerializer;
