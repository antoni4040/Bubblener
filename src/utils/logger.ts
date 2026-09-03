import { formatDuration } from '@/utils/timing';

const PREFIX = '[Bubblener]';
const n = (value: number) => value.toLocaleString('en-US');

export const logRequest = (provider: string, model: string, tier: string, inputChars: number, estimate: number | null) =>
    console.log(
        `${PREFIX} → ${provider} · ${model} (${tier}) · ${n(inputChars)} chars in` +
        (estimate === null ? ' · no timing history yet' : ` · est ${formatDuration(estimate)}`)
    );

export const logResponse = (
    model: string, ms: number, usage: { input: number; output: number }, entities: number,
) =>
    console.log(
        `${PREFIX} ← ${model} · ${formatDuration(ms)} · ` +
        `${n(usage.input)}→${n(usage.output)} tokens · ${entities} entities`
    );

export const logFailure = (model: string, ms: number, error: unknown) =>
    console.error(`${PREFIX} ✗ ${model} · ${formatDuration(ms)} ·`, error);
