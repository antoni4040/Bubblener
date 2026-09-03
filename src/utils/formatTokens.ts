/** Compact token counts: 1234 -> "1.2k", 1200000 -> "1.2M". */
const formatTokens = (value: number): string => {
    if (value < 1000) return String(value);
    if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
    return `${(value / 1_000_000).toFixed(1)}M`;
};

export default formatTokens;
