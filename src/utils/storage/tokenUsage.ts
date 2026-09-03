import TokenUsage from "@/utils/types/TokenUsage";

export interface TokenUsageTotals extends TokenUsage {
    calls: number;
}

/** Cumulative spend since install (or since the user last reset it). */
const tokenUsage = storage.defineItem<TokenUsageTotals>('local:tokenUsage', {
    defaultValue: { input: 0, output: 0, calls: 0 },
});

export default tokenUsage;
