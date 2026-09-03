import { describe, expect, it } from 'vitest';
import { estimateMs, recordSample, formatDuration } from '@/utils/timing';
import TimingStats from '@/utils/types/TimingStats';

const MODEL = 'gemini-3.5-flash-lite';

describe('recordSample', () => {
    it('accumulates per model without touching the others', () => {
        let stats: TimingStats = {};
        stats = recordSample(stats, MODEL, 1000, 1200, 4000);
        stats = recordSample(stats, 'other-model', 500, 600, 1000);

        expect(stats[MODEL]).toEqual({
            samples: 1, totalMs: 4000, totalInputChars: 1000, totalOutputTokens: 1200,
        });
        expect(stats['other-model'].samples).toBe(1);
    });

    it('halves the running totals past the forget threshold', () => {
        let stats: TimingStats = {};
        for (let i = 0; i < 21; i++) stats = recordSample(stats, MODEL, 1000, 1200, 4000);

        // Averages survive the halving; only the weight of history drops.
        expect(stats[MODEL].samples).toBeLessThan(21);
        expect(stats[MODEL].totalMs / stats[MODEL].samples).toBeCloseTo(4000, 5);
    });
});

describe('estimateMs', () => {
    it('returns null until there is history for that model', () => {
        expect(estimateMs({}, MODEL, 1000)).toBeNull();
        const other = recordSample({}, 'other-model', 1000, 1200, 4000);
        expect(estimateMs(other, MODEL, 1000)).toBeNull();
    });

    it('returns the running mean for a comparable request', () => {
        const stats = recordSample({}, MODEL, 1000, 1200, 4000);
        expect(estimateMs(stats, MODEL, 1000)).toBe(4000);
    });

    it('scales only mildly with input size, since generation dominates', () => {
        const stats = recordSample({}, MODEL, 1000, 1200, 4000);

        // Four times the input is nowhere near four times the wall clock.
        const bigger = estimateMs(stats, MODEL, 4000)!;
        expect(bigger).toBeGreaterThan(4000);
        expect(bigger).toBeLessThan(8000);

        const smaller = estimateMs(stats, MODEL, 100)!;
        expect(smaller).toBeLessThan(4000);
        expect(smaller).toBeGreaterThan(2000);
    });

    it('clamps absurd input ratios instead of extrapolating wildly', () => {
        const stats = recordSample({}, MODEL, 1000, 1200, 4000);
        expect(estimateMs(stats, MODEL, 10_000_000)).toBe(estimateMs(stats, MODEL, 4000));
    });

    it('averages across samples rather than tracking the latest', () => {
        let stats = recordSample({}, MODEL, 1000, 1200, 2000);
        stats = recordSample(stats, MODEL, 1000, 1200, 6000);
        expect(estimateMs(stats, MODEL, 1000)).toBe(4000);
    });
});

describe('formatDuration', () => {
    it('uses ms below a second and seconds above', () => {
        expect(formatDuration(850)).toBe('850ms');
        expect(formatDuration(4200)).toBe('4.2s');
        expect(formatDuration(90_000)).toBe('90.0s');
    });
});
