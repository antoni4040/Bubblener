import { SavedEntities } from '@/utils/types/SavedEntity';

/** Entities the user never wants to see again, on any page. */
const hiddenEntities = storage.defineItem<SavedEntities>('local:hiddenEntities', {
    defaultValue: {},
});

export default hiddenEntities;
