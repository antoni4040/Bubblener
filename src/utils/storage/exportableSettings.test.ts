import { describe, expect, it } from 'vitest';
import { applyImport, hasEntities, readExportableSettings } from '@/utils/storage/exportableSettings';
import { SETTING_KEYS, type ImportedData } from '@/utils/settingsTransfer';
import starredEntities from '@/utils/storage/starredEntities';
import hiddenEntities from '@/utils/storage/hiddenEntities';
import theme from '@/utils/storage/theme';
import ThemeEnum from '@/utils/types/themeEnum';

const data = (overrides: Partial<ImportedData> = {}): ImportedData => ({
    settings: {}, starred: {}, hidden: {}, skipped: [], ...overrides,
});

const entity = (name: string) => ({ entity_name: name, entity_type: 'Person', savedAt: 1 });

describe('readExportableSettings', () => {
    it('reads every key on the allowlist, and nothing else', async () => {
        const settings = await readExportableSettings();
        expect(Object.keys(settings).sort()).toEqual([...SETTING_KEYS].sort());
        expect(settings).not.toHaveProperty('apiKey');
    });
});

describe('hasEntities', () => {
    it('is false for a settings-only file, so the user is not asked needlessly', () => {
        expect(hasEntities(data({ settings: { theme: ThemeEnum.Dark } }))).toBe(false);
    });

    it('is true when either list has something in it', () => {
        expect(hasEntities(data({ starred: { a: entity('A') } }))).toBe(true);
        expect(hasEntities(data({ hidden: { a: entity('A') } }))).toBe(true);
    });
});

describe('applyImport', () => {
    it('merges by default, keeping what was already there', async () => {
        await starredEntities.setValue({ alice: entity('Alice') } as any);

        await applyImport(data({ starred: { bob: entity('Bob') } }), 'merge');

        expect(Object.keys(await starredEntities.getValue()).sort()).toEqual(['alice', 'bob']);
    });

    it('lets the imported copy win a name collision', async () => {
        await starredEntities.setValue({ alice: { ...entity('Alice'), savedAt: 1 } } as any);

        await applyImport(
            data({ starred: { alice: { ...entity('Alice'), savedAt: 99 } } }), 'merge',
        );

        expect((await starredEntities.getValue()).alice!.savedAt).toBe(99);
    });

    it('replaces a list with exactly what the file holds', async () => {
        await starredEntities.setValue({ alice: entity('Alice') } as any);

        await applyImport(data({ starred: { bob: entity('Bob') } }), 'replace');

        expect(Object.keys(await starredEntities.getValue())).toEqual(['bob']);
    });

    it('replacing with an empty list clears it, as "replace" has to mean', async () => {
        // Destructive on purpose: the UI shows both counts before asking, so
        // this is visible rather than a surprise.
        await hiddenEntities.setValue({ alice: entity('Alice') } as any);

        await applyImport(data({ starred: { bob: entity('Bob') } }), 'replace');

        expect(await hiddenEntities.getValue()).toEqual({});
    });

    it('merging never clears a list the file does not mention', async () => {
        await hiddenEntities.setValue({ alice: entity('Alice') } as any);

        await applyImport(data({ starred: { bob: entity('Bob') } }), 'merge');

        expect(Object.keys(await hiddenEntities.getValue())).toEqual(['alice']);
    });

    it('writes settings whichever mode is chosen', async () => {
        await applyImport(data({ settings: { theme: ThemeEnum.Cyberpunk } }), 'replace');
        expect(await theme.getValue()).toBe(ThemeEnum.Cyberpunk);

        await applyImport(data({ settings: { theme: ThemeEnum.Library } }), 'merge');
        expect(await theme.getValue()).toBe(ThemeEnum.Library);
    });

    it('reports what it wrote', async () => {
        const result = await applyImport(data({
            settings: { theme: ThemeEnum.Dark },
            starred: { bob: entity('Bob') },
        }), 'merge');

        expect(result).toEqual({ settings: 1, starred: 1, hidden: 0 });
    });
});
