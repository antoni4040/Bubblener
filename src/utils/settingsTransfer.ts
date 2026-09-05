import { z } from 'zod';
import ThemeEnum from '@/utils/types/themeEnum';
import ModelAPIsEnum from '@/utils/types/modelAPIsEnum';
import ModelTierEnum from '@/utils/types/modelTierEnum';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

/**
 * Moving settings between machines.
 *
 * Storage is `local:`, never `sync:`, so the API key is never uploaded to a
 * browser account — the price of that choice is that a new machine starts from
 * nothing. This is how you carry your setup across deliberately.
 *
 * Two rules hold the whole file together:
 *
 *  1. **The API key is never exported, and never imported.** The popup's
 *     invariant is that a saved key cannot be read back out; an export that
 *     wrote it into `~/Downloads` in plaintext would undo that in one line.
 *     `apiKey` is not in the table below, so it cannot travel in either
 *     direction even if someone hand-edits it into a file.
 *  2. **An imported file is untrusted input.** Every field is validated
 *     individually and a bad one is skipped rather than aborting the import —
 *     the same per-item approach `parseEntitiesResponse` takes with entities,
 *     for the same reason: one broken value should not discard the good ones.
 */

export const EXPORT_VERSION = 1;

const colorSettings = z.object({
    gradientStart: z.string(),
    gradientEnd: z.string(),
    textColor: z.string(),
});

const entityColors = z.object({
    person: colorSettings,
    organization: colorSettings,
    location: colorSettings,
    keyConcept: colorSettings,
});

/**
 * Every setting that may travel, and the shape it has to have.
 *
 * `apiKey` is deliberately absent. So are `tokenUsage` and `timingStats`:
 * they are machine-local history rather than settings, and per-machine totals
 * are the sensible thing anyway.
 */
export const SETTING_SCHEMAS = {
    theme: z.enum(ThemeEnum),
    modelAPI: z.enum(ModelAPIsEnum),
    modelTier: z.enum(ModelTierEnum),
    bubblePosition: z.enum(BubblePositionEnum),
    ollamaModel: z.string(),
    bubbleColors: entityColors,
    bubbleDistance: z.number().finite(),
    bubbleSize: z.number().finite(),
    bubbleTransparency: z.boolean(),
    textHighlighting: z.boolean(),
    showLauncher: z.boolean(),
    pixelDistance: z.number().finite(),
    maxNumberOfElements: z.number().finite(),
    maxNumberOfCharacters: z.number().finite(),
    blockedSites: z.array(z.string()),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

/** A saved entity, loose enough to survive a file written by an older build. */
const savedEntity = z.object({
    entity_name: z.string(),
    entity_type: z.string(),
    description: z.string().optional(),
    summary_from_text: z.string().optional(),
    contextual_enrichment: z.string().nullable().optional(),
    mentions: z.array(z.string()).optional(),
    importance: z.number().optional(),
    savedAt: z.number().optional(),
    sourceUrl: z.string().optional(),
    sourceTitle: z.string().optional(),
});

export interface TransferFile {
    bubblener: number;
    exportedAt: string;
    settings: Record<string, unknown>;
    starred: Record<string, unknown>;
    hidden: Record<string, unknown>;
}

export interface ImportedData {
    settings: Partial<Record<SettingKey, unknown>>;
    starred: Record<string, unknown>;
    hidden: Record<string, unknown>;
    /** Field names that were present but unusable, for honest reporting. */
    skipped: string[];
}

/** Builds the file contents. Callers supply only exportable values. */
export const buildExport = (
    settings: Partial<Record<SettingKey, unknown>>,
    starred: Record<string, unknown>,
    hidden: Record<string, unknown>,
): TransferFile => {
    // Rebuilt from the allowlist rather than passed straight through, so a
    // caller cannot widen what gets written by handing us extra keys.
    const safe: Record<string, unknown> = {};
    for (const key of SETTING_KEYS) {
        if (settings[key] !== undefined) safe[key] = settings[key];
    }

    return {
        bubblener: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        settings: safe,
        starred,
        hidden,
    };
};

export const exportFilename = (now = new Date()): string =>
    `bubblener-settings-${now.toISOString().slice(0, 10)}.json`;

const parseEntityMap = (
    value: unknown, label: string, skipped: string[],
): Record<string, unknown> => {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
        skipped.push(label);
        return {};
    }

    const out: Record<string, unknown> = {};
    for (const [key, entity] of Object.entries(value as Record<string, unknown>)) {
        const parsed = savedEntity.safeParse(entity);
        if (parsed.success) out[key] = parsed.data;
        else skipped.push(`${label}.${key}`);
    }
    return out;
};

/**
 * Validates a file's contents.
 *
 * Throws only when the file is not a Bubblener export at all — anything
 * salvageable is imported, and whatever isn't is named in `skipped` so the UI
 * can say what it ignored instead of silently dropping it.
 */
export const parseImport = (raw: string): ImportedData => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('That file is not valid JSON.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('That file is not a Bubblener export.');
    }

    const file = parsed as Record<string, unknown>;
    if (typeof file.bubblener !== 'number') {
        throw new Error('That file is not a Bubblener export.');
    }
    if (file.bubblener > EXPORT_VERSION) {
        throw new Error(
            `That file was written by a newer version of Bubblener (format ${file.bubblener}).`,
        );
    }

    const skipped: string[] = [];
    const settings: Partial<Record<SettingKey, unknown>> = {};

    const rawSettings = (file.settings && typeof file.settings === 'object'
        && !Array.isArray(file.settings))
        ? file.settings as Record<string, unknown>
        : {};

    for (const [key, value] of Object.entries(rawSettings)) {
        // Anything not on the allowlist is ignored by construction. This is
        // what stops a hand-edited `apiKey` from ever reaching storage.
        if (!(key in SETTING_SCHEMAS)) {
            skipped.push(key);
            continue;
        }
        const schema = SETTING_SCHEMAS[key as SettingKey];
        const result = schema.safeParse(value);
        if (result.success) settings[key as SettingKey] = result.data;
        else skipped.push(key);
    }

    return {
        settings,
        starred: parseEntityMap(file.starred, 'starred', skipped),
        hidden: parseEntityMap(file.hidden, 'hidden', skipped),
        skipped,
    };
};
