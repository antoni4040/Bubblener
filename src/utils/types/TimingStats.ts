export interface ModelTiming {
    samples: number;
    totalMs: number;
    totalInputChars: number;
    totalOutputTokens: number;
}

/** Keyed by model id — latency differs far more between models than providers. */
type TimingStats = Record<string, ModelTiming>;

export type { TimingStats as default };
