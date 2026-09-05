import type Entity from '@/utils/types/Entity';

/** An entity the user acted on, kept with where it was found. */
export interface SavedEntity extends Entity {
    savedAt: number;
    sourceUrl?: string;
    sourceTitle?: string;
}

/** Keyed by `entityKey(entity_name)`. */
export type SavedEntities = Record<string, SavedEntity>;
