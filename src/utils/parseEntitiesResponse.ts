import { z } from 'zod';
import Entity from '@/utils/types/Entity';

// Models routinely answer "no enrichment" with a placeholder string rather
// than JSON null, which then renders as the word "null" in the modal.
const PLACEHOLDERS = new Set(['null', 'none', 'n/a', 'na', 'nil', 'undefined', '-', '']);

const emptyToNull = (value: string | null): string | null =>
    value === null || PLACEHOLDERS.has(value.trim().toLowerCase()) ? null : value;

const EntitySchema = z.object({
    entity_name: z.string(),
    entity_type: z.enum(['Person', 'Organization', 'Location', 'Key Concept/Theme']),
    // Optional: older cached payloads predate it, and not every provider
    // reliably returns it.
    mentions: z.array(z.string()).optional(),
    description: z.string(),
    summary_from_text: z.string(),
    contextual_enrichment: z.string().nullable().transform(emptyToNull),
});

const EntityArraySchema = z.array(EntitySchema);

// Strips Markdown code fences (```json ... ``` or ``` ... ```) that LLMs
// sometimes wrap JSON responses in, regardless of surrounding whitespace.
const stripCodeFence = (text: string): string => {
    const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : text.trim();
};

// Trailing commas are the most common way an LLM hands back JSON that is
// nearly valid ("...}, ]"). Only applied after a strict parse has already
// failed, so well-formed output is never rewritten. Commas inside strings are
// skipped by tracking whether we're in one.
const dropTrailingCommas = (json: string): string => {
    let out = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < json.length; i++) {
        const char = json[i];

        if (inString) {
            out += char;
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }

        if (char === '"') {
            inString = true;
            out += char;
            continue;
        }

        if (char === ',') {
            const next = json.slice(i + 1).match(/^\s*([}\]])/);
            if (next) continue; // comma immediately before a closing bracket
        }
        out += char;
    }
    return out;
};

export const parseEntitiesResponse = (raw: string): Entity[] => {
    const cleaned = stripCodeFence(raw);

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch (error) {
        try {
            parsed = JSON.parse(dropTrailingCommas(cleaned));
        } catch {
            // Report the original failure, not the repaired one — it points at
            // what the model actually sent.
            throw new Error(`Failed to parse entities response as JSON: ${(error as Error).message}`);
        }
    }

    const candidate = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).entities)
            ? (parsed as any).entities
            : undefined;

    if (candidate === undefined) {
        throw new Error('Invalid response format: expected an array of entities or an object with an "entities" array.');
    }

    const result = EntityArraySchema.safeParse(candidate);
    if (!result.success) {
        throw new Error(`Invalid entity shape in response: ${result.error.message}`);
    }

    return result.data as Entity[];
};

export default parseEntitiesResponse;
