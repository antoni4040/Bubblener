import { EntitySchema } from '@/utils/parseEntitiesResponse';
import type Entity from '@/utils/types/Entity';

/**
 * Pulling finished entities out of a half-received response.
 *
 * A streamed answer is invalid JSON until its final byte, so it cannot be
 * parsed as a whole. But each *entity* inside it is complete the moment its
 * closing brace arrives, and that is what we can show.
 *
 * The scan finds balanced `{...}` regions and keeps the ones that parse into a
 * valid entity. The wrapper object of `{"entities": [...]}` balances only at
 * the very end and has no entity_name of its own, so it falls out naturally
 * and both response shapes work without special-casing.
 */

/** Byte ranges of every balanced brace-delimited region, outermost first. */
const balancedObjects = (buffer: string): string[] => {
    const found: string[] = [];
    const stack: number[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];

        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }

        if (char === '"') inString = true;
        else if (char === '{') stack.push(i);
        else if (char === '}' && stack.length) {
            const start = stack.pop()!;
            found.push(buffer.slice(start, i + 1));
        }
    }

    return found;
};

/**
 * Every entity fully present in `buffer`, in the order the model emitted them.
 * Safe to call on each chunk: it is pure, and callers track how many they have
 * already shown.
 */
export const extractStreamedEntities = (buffer: string): Entity[] => {
    const entities: { at: number; entity: Entity }[] = [];

    for (const candidate of balancedObjects(buffer)) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(candidate);
        } catch {
            continue;
        }

        const result = EntitySchema.safeParse(parsed);
        if (result.success) {
            entities.push({ at: buffer.indexOf(candidate), entity: result.data as Entity });
        }
    }

    // balancedObjects closes inner regions first; restore document order.
    return entities.sort((a, b) => a.at - b.at).map((e) => e.entity);
};

export default extractStreamedEntities;
