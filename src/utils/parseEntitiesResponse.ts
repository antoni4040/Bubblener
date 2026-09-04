import { z } from 'zod';
import Entity from '@/utils/types/Entity';

// Models routinely answer "no enrichment" with a placeholder string rather
// than JSON null, which then renders as the word "null" in the modal.
const PLACEHOLDERS = new Set(['null', 'none', 'n/a', 'na', 'nil', 'undefined', '-', '']);

const emptyToNull = (value: string | null): string | null =>
    value === null || PLACEHOLDERS.has(value.trim().toLowerCase()) ? null : value;

const ENTITY_TYPES = ['Person', 'Organization', 'Location', 'Key Concept/Theme'] as const;
type EntityType = typeof ENTITY_TYPES[number];

/** Things the models actually answer that mean one of our four categories. */
const TYPE_SYNONYMS: Record<string, EntityType> = {
    people: 'Person', human: 'Person', character: 'Person', individual: 'Person',
    organisation: 'Organization', company: 'Organization', institution: 'Organization',
    group: 'Organization', family: 'Organization',
    place: 'Location', city: 'Location', country: 'Location', building: 'Location',
    setting: 'Location',
    concept: 'Key Concept/Theme', theme: 'Key Concept/Theme', idea: 'Key Concept/Theme',
    event: 'Key Concept/Theme', object: 'Key Concept/Theme', thing: 'Key Concept/Theme',
    artifact: 'Key Concept/Theme', work: 'Key Concept/Theme', motif: 'Key Concept/Theme',
};

/**
 * Maps whatever the model called it onto our four categories.
 *
 * Only Gemini has the enum enforced by its schema; the others are guided by
 * the prompt alone and reach for categories we do not offer — a novel is full
 * of significant *objects* (an axe, an ikon) with nowhere else to go. Rejecting
 * those used to discard the entire response along with them.
 */
const normalizeEntityType = (value: string): EntityType => {
    const trimmed = value.trim();
    const exact = ENTITY_TYPES.find((type) => type.toLowerCase() === trimmed.toLowerCase());
    if (exact) return exact;
    return TYPE_SYNONYMS[trimmed.toLowerCase()] ?? 'Key Concept/Theme';
};

export const EntitySchema = z.object({
    entity_name: z.string(),
    entity_type: z.string().transform(normalizeEntityType),
    // Optional: older cached payloads predate it, and not every provider
    // reliably returns it.
    mentions: z.array(z.string()).optional(),
    // Optional, and clamped: models occasionally answer 1-10 or overshoot.
    importance: z.number().optional()
        .transform((value) => value === undefined ? undefined : Math.min(1, Math.max(0, value))),
    description: z.string(),
    summary_from_text: z.string(),
    contextual_enrichment: z.string().nullable().transform(emptyToNull),
});

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

    // Validated one at a time, deliberately. Validating the array as a whole
    // meant a single malformed entity threw away every good one beside it —
    // three odd `entity_type` values once discarded a whole page's worth.
    const entities: Entity[] = [];
    const problems: string[] = [];

    for (const [index, raw] of (candidate as unknown[]).entries()) {
        const parsed = EntitySchema.safeParse(raw);
        if (parsed.success) entities.push(parsed.data as Entity);
        else problems.push(`#${index}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
    }

    if (!entities.length && problems.length) {
        throw new Error(`Invalid entity shape in response: ${problems.join('; ')}`);
    }
    if (problems.length) {
        console.warn(`[Bubblener] dropped ${problems.length} malformed entities: ${problems.join('; ')}`);
    }

    return entities;
};

export default parseEntitiesResponse;
