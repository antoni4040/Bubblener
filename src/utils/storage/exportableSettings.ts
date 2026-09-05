import theme from './theme';
import modelAPI from './modelAPI';
import modelTier from './modelTier';
import bubblePosition from './bubblePosition';
import ollamaModel from './ollamaModel';
import bubbleColors from './bubbleColors';
import bubbleDistance from './bubbleDistance';
import bubbleSize from './bubbleSize';
import bubbleTransparency from './bubbleTransparency';
import textHighlighting from './textHighlighting';
import showLauncher from './showLauncher';
import pixelDistance from './pixelDistance';
import maxNumberOfElements from './maxNumberOfElements';
import maxNumberOfCharacters from './maxNumberOfCharacters';
import blockedSites from './blockedSites';
import starredEntities from './starredEntities';
import hiddenEntities from './hiddenEntities';
import type { SavedEntities } from '@/utils/types/SavedEntity';
import { type SettingKey, SETTING_KEYS, type ImportedData } from '@/utils/settingsTransfer';

/**
 * Where each exportable setting actually lives.
 *
 * `satisfies Record<SettingKey, ...>` is doing real work: it is a compile-time
 * guarantee that this map and the validation allowlist in `settingsTransfer`
 * cannot drift apart. Add a schema there without an item here and `tsc` fails,
 * rather than the setting silently never being exported.
 *
 * `apiKey` has no entry, by the same design that keeps it out of the schemas.
 */
const items = {
    theme, modelAPI, modelTier, bubblePosition, ollamaModel, bubbleColors,
    bubbleDistance, bubbleSize, bubbleTransparency, textHighlighting,
    showLauncher, pixelDistance, maxNumberOfElements, maxNumberOfCharacters,
    blockedSites,
} satisfies Record<SettingKey, { getValue: () => Promise<any>; setValue: (v: any) => Promise<void> }>;

/** Current values of everything exportable. */
export const readExportableSettings = async (): Promise<Partial<Record<SettingKey, unknown>>> => {
    const entries = await Promise.all(
        SETTING_KEYS.map(async (key) => [key, await items[key].getValue()] as const),
    );
    return Object.fromEntries(entries);
};

export interface ApplyResult {
    settings: number;
    starred: number;
    hidden: number;
}

/** What to do with the starred and hidden lists already in storage. */
export type ImportMode = 'merge' | 'replace';

/** Whether a file carries any entities, i.e. whether the mode matters at all. */
export const hasEntities = (data: ImportedData): boolean =>
    Object.keys(data.starred).length > 0 || Object.keys(data.hidden).length > 0;

/**
 * Writes an imported file into storage.
 *
 * Settings always overwrite: they are single values, and merging two themes is
 * not a meaningful operation. The entity lists are the user's call —
 * `merge` adds to what is there (the imported copy wins a key collision),
 * `replace` makes the lists exactly what the file holds, empties included.
 * Replacing can destroy curated lists, so the caller must ask first rather
 * than picking a default on the user's behalf.
 */
export const applyImport = async (
    data: ImportedData, mode: ImportMode = 'merge',
): Promise<ApplyResult> => {
    const settingEntries = Object.entries(data.settings) as [SettingKey, unknown][];
    // Indexing the map with a union narrows `setValue`'s parameter to the
    // intersection of every item's type, i.e. `never`. The values were just
    // validated against that key's own schema in `parseImport`, so the cast is
    // sound; the type system simply cannot carry the pairing through the loop.
    await Promise.all(settingEntries.map(
        ([key, value]) => (items[key].setValue as (v: unknown) => Promise<void>)(value),
    ));

    const writeList = async (
        item: { getValue: () => Promise<SavedEntities>; setValue: (v: SavedEntities) => Promise<void> },
        incoming: Record<string, unknown>,
    ) => {
        if (mode === 'replace') {
            // Deliberately writes an empty file-list as empty: "replace" has to
            // mean the lists become what the file holds, or it is unpredictable.
            await item.setValue(incoming as SavedEntities);
            return Object.keys(incoming).length;
        }
        if (!Object.keys(incoming).length) return 0;
        const existing = (await item.getValue()) ?? {};
        await item.setValue({ ...existing, ...(incoming as SavedEntities) });
        return Object.keys(incoming).length;
    };

    return {
        settings: settingEntries.length,
        starred: await writeList(starredEntities, data.starred),
        hidden: await writeList(hiddenEntities, data.hidden),
    };
};
