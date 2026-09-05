import type Entity from '@/utils/types/Entity';
import entityKey from '@/utils/entityKey';

export interface RankedEntity extends Entity {
    /** Which batch this arrived in, for recency weighting. */
    seenAt?: number;
}

/**
 * How fast an entity's claim on a slot fades per batch.
 *
 * Without decay, a strong first section would fill every slot and the entities
 * of whatever you are reading now could never displace them. At 0.75 an entity
 * two sections back must be roughly twice as important to hold its place.
 */
const RECENCY_DECAY = 0.75;

/** Used when a model omits the field, so it neither wins nor loses outright. */
const DEFAULT_IMPORTANCE = 0.5;

const key = (entity: Entity) => entityKey(entity.entity_name);

const score = (entity: RankedEntity, batch: number): number => {
    const importance = entity.importance ?? DEFAULT_IMPORTANCE;
    const age = Math.max(0, batch - (entity.seenAt ?? batch));
    return importance * Math.pow(RECENCY_DECAY, age);
};

/**
 * Folds newly arrived entities into the ones already on screen, keeping the
 * `max` best.
 *
 * Display order is insertion order, never the ranking: a streaming answer
 * appends instead of reshuffling under the reader's cursor. Ranking decides
 * only *which* entities survive the cap, so what drops off is the least
 * important thing from the furthest-back section rather than simply the oldest.
 */
export interface MergeOptions {
    /** Starred: never evicted, and not counted against the cap. */
    pinned?: Set<string>;
    /** Hidden: dropped on arrival and removed if already shown. */
    hidden?: Set<string>;
}

export const mergeEntities = (
    current: RankedEntity[],
    incoming: Entity[],
    max: number,
    batch: number,
    { pinned, hidden }: MergeOptions = {},
): RankedEntity[] => {
    const byKey = new Map<string, RankedEntity>();
    for (const entity of current) byKey.set(key(entity), entity);

    for (const entity of incoming) {
        if (!entity?.entity_name?.trim()) continue;
        // A repeat is re-dated: still being talked about is itself a signal.
        byKey.set(key(entity), { ...entity, seenAt: batch });
    }

    // Hiding applies retroactively: hiding something already on screen should
    // remove it, not merely stop it coming back.
    if (hidden?.size) {
        for (const entityKeyValue of Array.from(byKey.keys())) {
            if (hidden.has(entityKeyValue)) byKey.delete(entityKeyValue);
        }
    }

    const all = Array.from(byKey.values());
    const isPinned = (entity: RankedEntity) => pinned?.has(key(entity)) ?? false;

    // Starred entities hold their place unconditionally — the user asked for
    // them — so the cap governs only the rest.
    const unpinned = all.filter((entity) => !isPinned(entity));
    if (max <= 0 || unpinned.length <= max) return all;

    const survivors = new Set(
        unpinned.slice()
            .sort((a, b) => score(b, batch) - score(a, batch))
            .slice(0, max)
    );
    return all.filter((entity) => isPinned(entity) || survivors.has(entity));
};

export default mergeEntities;
