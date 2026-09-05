import defaults from '@/utils/constants/defaults';

/**
 * Hostnames Bubblener must never analyse. `local:`, like everything else —
 * see the storage note in CLAUDE.md.
 */
const blockedSites = storage.defineItem<string[]>('local:blockedSites', {
    defaultValue: defaults.blockedSites,
});

export default blockedSites;
