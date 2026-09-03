import { z } from 'zod';
import Entity from '@/utils/types/Entity';

const EntitySchema = z.object({
    entity_name: z.string(),
    entity_type: z.enum(['Person', 'Organization', 'Location', 'Key Concept/Theme']),
    description: z.string(),
    summary_from_text: z.string(),
    contextual_enrichment: z.string().nullable(),
});

const EntityArraySchema = z.array(EntitySchema);

// Strips Markdown code fences (```json ... ``` or ``` ... ```) that LLMs
// sometimes wrap JSON responses in, regardless of surrounding whitespace.
const stripCodeFence = (text: string): string => {
    const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : text.trim();
};

export const parseEntitiesResponse = (raw: string): Entity[] => {
    const cleaned = stripCodeFence(raw);

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch (error) {
        throw new Error(`Failed to parse entities response as JSON: ${(error as Error).message}`);
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
