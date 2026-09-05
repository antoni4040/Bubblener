import { describe, expect, it } from 'vitest';
import {
    EXPORT_VERSION, SETTING_KEYS, buildExport, exportFilename, parseImport,
} from '@/utils/settingsTransfer';
import ThemeEnum from '@/utils/types/themeEnum';

const file = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    bubblener: EXPORT_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    starred: {},
    hidden: {},
    ...overrides,
});

describe('the API key never travels', () => {
    it('is not an exportable setting', () => {
        expect(SETTING_KEYS).not.toContain('apiKey');
    });

    it('is dropped from an export even if handed in', () => {
        const exported = buildExport(
            { theme: ThemeEnum.Dark, apiKey: 'sk-secret' } as any, {}, {},
        );
        expect(JSON.stringify(exported)).not.toContain('sk-secret');
        expect(exported.settings).not.toHaveProperty('apiKey');
    });

    it('is refused on import, even hand-edited into the file', () => {
        // The one that matters: someone adds apiKey to a JSON file by hand.
        const result = parseImport(file({
            settings: { apiKey: 'sk-injected', theme: ThemeEnum.Dark },
        }));

        expect(result.settings).not.toHaveProperty('apiKey');
        expect(result.settings.theme).toBe(ThemeEnum.Dark);
        expect(result.skipped).toContain('apiKey');
    });
});

describe('usage stats stay machine-local', () => {
    it('does not carry token counts or timings', () => {
        expect(SETTING_KEYS).not.toContain('tokenUsage');
        expect(SETTING_KEYS).not.toContain('timingStats');
    });
});

describe('buildExport', () => {
    it('records the format version and a date', () => {
        const exported = buildExport({ theme: ThemeEnum.Library }, {}, {});
        expect(exported.bubblener).toBe(EXPORT_VERSION);
        expect(exported.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('omits settings that have no value rather than writing undefined', () => {
        const exported = buildExport({ theme: ThemeEnum.Light }, {}, {});
        expect(Object.keys(exported.settings)).toEqual(['theme']);
    });

    it('carries the starred and hidden lists', () => {
        const starred = { alice: { entity_name: 'Alice', entity_type: 'Person' } };
        expect(buildExport({}, starred, {}).starred).toEqual(starred);
    });

    it('names the file by date', () => {
        expect(exportFilename(new Date('2026-03-04T12:00:00Z')))
            .toBe('bubblener-settings-2026-03-04.json');
    });
});

describe('parseImport rejects what is not an export', () => {
    it('rejects malformed JSON', () => {
        expect(() => parseImport('{ not json')).toThrow(/not valid JSON/);
    });

    it('rejects a JSON file that is not ours', () => {
        expect(() => parseImport('{"hello":"world"}')).toThrow(/not a Bubblener export/);
        expect(() => parseImport('[1,2,3]')).toThrow(/not a Bubblener export/);
    });

    it('refuses a file from a newer format rather than guessing', () => {
        expect(() => parseImport(file({ bubblener: EXPORT_VERSION + 1 })))
            .toThrow(/newer version/);
    });
});

describe('parseImport validates each field on its own', () => {
    it('keeps the good settings and skips the bad ones', () => {
        // One broken value must not discard the rest of the file.
        const result = parseImport(file({
            settings: { theme: ThemeEnum.Cyberpunk, bubbleSize: 'enormous', maxNumberOfElements: 5 },
        }));

        expect(result.settings.theme).toBe(ThemeEnum.Cyberpunk);
        expect(result.settings.maxNumberOfElements).toBe(5);
        expect(result.settings).not.toHaveProperty('bubbleSize');
        expect(result.skipped).toContain('bubbleSize');
    });

    it('rejects an enum value outside the ones we handle', () => {
        // An unknown theme would leave the UI rendering against nothing.
        const result = parseImport(file({ settings: { theme: 'Neon' } }));
        expect(result.settings).not.toHaveProperty('theme');
        expect(result.skipped).toContain('theme');
    });

    it('rejects a half-built color object', () => {
        const result = parseImport(file({
            settings: { bubbleColors: { person: { gradientStart: '#fff' } } },
        }));
        expect(result.settings).not.toHaveProperty('bubbleColors');
    });

    it('ignores unknown settings instead of writing them to storage', () => {
        const result = parseImport(file({ settings: { somethingElse: 1 } }));
        expect(result.settings).toEqual({});
        expect(result.skipped).toContain('somethingElse');
    });

    it('accepts a file that carries only some settings', () => {
        const result = parseImport(file({ settings: { theme: ThemeEnum.Dark } }));
        expect(result.settings).toEqual({ theme: ThemeEnum.Dark });
        expect(result.skipped).toEqual([]);
    });
});

describe('parseImport and the entity lists', () => {
    it('keeps valid entities and skips malformed ones', () => {
        const result = parseImport(file({
            starred: {
                alice: { entity_name: 'Alice', entity_type: 'Person', savedAt: 1 },
                broken: { entity_type: 'Person' },
            },
        }));

        expect(Object.keys(result.starred)).toEqual(['alice']);
        expect(result.skipped).toContain('starred.broken');
    });

    it('accepts an entity from an older build that lacks the newer fields', () => {
        const result = parseImport(file({
            hidden: { bob: { entity_name: 'Bob', entity_type: 'Person' } },
        }));
        expect(result.hidden).toHaveProperty('bob');
    });

    it('treats a missing list as empty rather than failing', () => {
        const result = parseImport('{"bubblener":1}');
        expect(result.starred).toEqual({});
        expect(result.hidden).toEqual({});
        expect(result.settings).toEqual({});
    });

    it('skips a list that is not an object', () => {
        const result = parseImport(file({ starred: ['nope'] }));
        expect(result.starred).toEqual({});
        expect(result.skipped).toContain('starred');
    });
});

describe('a round trip', () => {
    it('survives export then import unchanged', () => {
        const starred = {
            alice: {
                entity_name: 'Alice', entity_type: 'Person',
                description: 'A person.', savedAt: 42,
            },
        };
        const exported = buildExport(
            { theme: ThemeEnum.Library, bubbleSize: 15, blockedSites: ['bank.example.com'] },
            starred, {},
        );

        const result = parseImport(JSON.stringify(exported));

        expect(result.settings).toEqual({
            theme: ThemeEnum.Library, bubbleSize: 15, blockedSites: ['bank.example.com'],
        });
        expect(result.starred).toEqual(starred);
        expect(result.skipped).toEqual([]);
    });
});
