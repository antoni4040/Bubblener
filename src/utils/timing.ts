import type TimingStats from '@/utils/types/TimingStats';

/** Past this many samples the running totals are halved, so the estimate
 *  tracks current conditions instead of averaging in last month's network. */
const FORGET_AFTER = 20;

export const recordSample = (
    stats: TimingStats,
    model: string,
    inputChars: number,
    outputTokens: number,
    ms: number,
): TimingStats => {
    const previous = stats[model] ?? { samples: 0, totalMs: 0, totalInputChars: 0, totalOutputTokens: 0 };

    let next = {
        samples: previous.samples + 1,
        totalMs: previous.totalMs + ms,
        totalInputChars: previous.totalInputChars + inputChars,
        totalOutputTokens: previous.totalOutputTokens + outputTokens,
    };

    if (next.samples > FORGET_AFTER) {
        next = {
            samples: next.samples / 2,
            totalMs: next.totalMs / 2,
            totalInputChars: next.totalInputChars / 2,
            totalOutputTokens: next.totalOutputTokens / 2,
        };
    }

    return { ...stats, [model]: next };
};

/**
 * How long this request is likely to take, in ms, or null with no history.
 *
 * Generation dominates the wall clock and its length is set by maxElements
 * rather than by the page, so the estimate is mostly the running mean. Input
 * size only nudges it — prefill is cheap next to producing ~1,200 tokens.
 */
export const estimateMs = (stats: TimingStats, model: string, inputChars: number): number | null => {
    const timing = stats[model];
    if (!timing || timing.samples < 1) return null;

    const meanMs = timing.totalMs / timing.samples;
    const meanInput = timing.totalInputChars / timing.samples;
    if (!meanInput) return Math.round(meanMs);

    const ratio = Math.min(Math.max(inputChars / meanInput, 0.25), 4);
    return Math.round(meanMs * (0.75 + 0.25 * ratio));
};

/** "4.2s" / "850ms" */
export const formatDuration = (ms: number): string =>
    ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
