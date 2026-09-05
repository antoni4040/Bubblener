import { type SavedEntities } from '@/utils/types/SavedEntity';

/** Pinned entities: exempt from the bubble cap and from distance retirement. */
const starredEntities = storage.defineItem<SavedEntities>('local:starredEntities', {
    defaultValue: {},
});

export default starredEntities;
