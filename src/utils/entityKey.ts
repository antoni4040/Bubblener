/**
 * The identity of an entity across pages and sessions.
 *
 * Merging, starring and hiding must all agree on this: if starring keyed on
 * the raw name while merging keyed on a normalised one, a starred entity would
 * silently fail to match itself the next time it appeared.
 */
const entityKey = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

export default entityKey;
