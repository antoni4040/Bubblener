import { describe, expect, it } from 'vitest';
import { createSerializer } from '@/utils/serialize';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createSerializer', () => {
    it('never lets two tasks overlap', async () => {
        const serialize = createSerializer();
        let running = 0;
        let maxConcurrent = 0;

        const task = async () => {
            running++;
            maxConcurrent = Math.max(maxConcurrent, running);
            await tick(5);
            running--;
        };

        await Promise.all([serialize(task), serialize(task), serialize(task)]);
        expect(maxConcurrent).toBe(1);
    });

    it('runs tasks in the order they were queued', async () => {
        const serialize = createSerializer();
        const order: number[] = [];

        await Promise.all([
            serialize(async () => { await tick(15); order.push(1); }),
            serialize(async () => { await tick(1); order.push(2); }),
            serialize(async () => { order.push(3); }),
        ]);

        expect(order).toEqual([1, 2, 3]);
    });

    it('protects a read-modify-write against lost updates', async () => {
        // The actual reason this exists: concurrent token-total increments.
        const serialize = createSerializer();
        let stored = 0;
        const increment = () => serialize(async () => {
            const current = stored;
            await tick(3);          // the storage round trip
            stored = current + 1;
        });

        await Promise.all(Array.from({ length: 10 }, increment));
        expect(stored).toBe(10);
    });

    it('returns each task its own result', async () => {
        const serialize = createSerializer();
        const results = await Promise.all([
            serialize(async () => 'a'),
            serialize(async () => 'b'),
        ]);
        expect(results).toEqual(['a', 'b']);
    });

    it('keeps running after a task throws', async () => {
        // A failed write must not wedge every later one behind it.
        const serialize = createSerializer();
        const failed = serialize(async () => { throw new Error('write failed'); });

        await expect(failed).rejects.toThrow('write failed');
        await expect(serialize(async () => 'still here')).resolves.toBe('still here');
    });
});
