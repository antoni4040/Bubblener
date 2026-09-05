import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '@/test/renderWithMantine';
import Library from './Library';
import apiKey from '@/utils/storage/apiKey';
import theme from '@/utils/storage/theme';
import bubbleSize from '@/utils/storage/bubbleSize';
import starredEntities from '@/utils/storage/starredEntities';
import blockedSites from '@/utils/storage/blockedSites';
import { EXPORT_VERSION } from '@/utils/settingsTransfer';
import ThemeEnum from '@/utils/types/themeEnum';

/** jsdom has no download machinery; capture what the page tried to save. */
let downloaded = '';
beforeEach(() => {
    downloaded = '';
    (URL as any).createObjectURL = vi.fn((blob: Blob) => {
        // Blob.text() is async and the click is not, so read it eagerly here.
        (blob as any).text().then((t: string) => { downloaded = t; });
        return 'blob:mock';
    });
    (URL as any).revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
});

const importFile = async (contents: unknown) => {
    const input = screen.getByLabelText('Settings file to import');
    const file = new File(
        [typeof contents === 'string' ? contents : JSON.stringify(contents)],
        'settings.json',
        { type: 'application/json' },
    );
    await userEvent.upload(input, file);
};

const validFile = (overrides: Record<string, unknown> = {}) => ({
    bubblener: EXPORT_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    starred: {},
    hidden: {},
    ...overrides,
});

describe('Library export', () => {
    it('never writes the API key into the exported file', async () => {
        // The invariant, checked end to end rather than only in the unit test.
        await apiKey.setValue('sk-super-secret-value');
        await theme.setValue(ThemeEnum.Library);
        renderWithMantine(<Library />);

        await userEvent.click(await screen.findByRole('button', { name: 'Export' }));

        await waitFor(() => expect(downloaded).not.toBe(''));
        expect(downloaded).not.toContain('sk-super-secret-value');
        expect(downloaded).not.toContain('apiKey');
        expect(JSON.parse(downloaded).settings.theme).toBe(ThemeEnum.Library);
    });

    it('says plainly that the key is not included', async () => {
        renderWithMantine(<Library />);
        await userEvent.click(await screen.findByRole('button', { name: 'Export' }));

        expect(await screen.findByText(/API key is not in the file/)).toBeInTheDocument();
    });

    it('carries the starred entities', async () => {
        await starredEntities.setValue({
            alice: {
                entity_name: 'Alice', entity_type: 'Person', mentions: ['Alice'],
                description: 'A person.', summary_from_text: 'About Alice.',
                contextual_enrichment: null, savedAt: 1,
            },
        });
        renderWithMantine(<Library />);

        await screen.findByText('Alice');
        await userEvent.click(screen.getByRole('button', { name: 'Export' }));

        await waitFor(() => expect(downloaded).not.toBe(''));
        expect(JSON.parse(downloaded).starred.alice.entity_name).toBe('Alice');
    });
});

describe('Library import', () => {
    it('applies validated settings to storage', async () => {
        renderWithMantine(<Library />);
        await screen.findByRole('button', { name: 'Import' });

        await importFile(validFile({
            settings: { theme: ThemeEnum.Cyberpunk, blockedSites: ['bank.example.com'] },
        }));

        await waitFor(async () => expect(await theme.getValue()).toBe(ThemeEnum.Cyberpunk));
        expect(await blockedSites.getValue()).toEqual(['bank.example.com']);
    });

    it('refuses an apiKey hand-edited into the file', async () => {
        await apiKey.setValue('sk-original');
        renderWithMantine(<Library />);
        await screen.findByRole('button', { name: 'Import' });

        await importFile(validFile({
            settings: { apiKey: 'sk-injected', theme: ThemeEnum.Dark },
        }));

        await waitFor(async () => expect(await theme.getValue()).toBe(ThemeEnum.Dark));
        // The import went through, and the key was left exactly as it was.
        expect(await apiKey.getValue()).toBe('sk-original');
    });

    it('asks before touching lists, and adds when told to', async () => {
        await starredEntities.setValue({
            alice: { entity_name: 'Alice', entity_type: 'Person', savedAt: 1 } as any,
        });
        renderWithMantine(<Library />);
        await screen.findByText('Alice');

        await importFile(validFile({
            starred: { bob: { entity_name: 'Bob', entity_type: 'Person', savedAt: 2 } },
        }));

        // Nothing is written until the user chooses.
        const choose = await screen.findByRole('button', { name: 'Add to my lists' });
        expect(Object.keys(await starredEntities.getValue())).toEqual(['alice']);

        await userEvent.click(choose);
        await waitFor(async () =>
            expect(Object.keys(await starredEntities.getValue()).sort()).toEqual(['alice', 'bob']));
    });

    it('replaces the lists when that is what was chosen', async () => {
        await starredEntities.setValue({
            alice: { entity_name: 'Alice', entity_type: 'Person', savedAt: 1 } as any,
        });
        renderWithMantine(<Library />);
        await screen.findByText('Alice');

        await importFile(validFile({
            starred: { bob: { entity_name: 'Bob', entity_type: 'Person', savedAt: 2 } },
        }));
        await userEvent.click(await screen.findByRole('button', { name: 'Replace my lists' }));

        await waitFor(async () =>
            expect(Object.keys(await starredEntities.getValue())).toEqual(['bob']));
    });

    it('cancelling leaves everything untouched', async () => {
        await starredEntities.setValue({
            alice: { entity_name: 'Alice', entity_type: 'Person', savedAt: 1 } as any,
        });
        await theme.setValue(ThemeEnum.Light);
        renderWithMantine(<Library />);
        await screen.findByText('Alice');

        await importFile(validFile({
            settings: { theme: ThemeEnum.Dark },
            starred: { bob: { entity_name: 'Bob', entity_type: 'Person', savedAt: 2 } },
        }));
        await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

        // Not even the settings are applied — the whole import is abandoned.
        expect(await theme.getValue()).toBe(ThemeEnum.Light);
        expect(Object.keys(await starredEntities.getValue())).toEqual(['alice']);
    });

    it('shows what the file holds against what is already here', async () => {
        await starredEntities.setValue({
            alice: { entity_name: 'Alice', entity_type: 'Person', savedAt: 1 } as any,
        });
        renderWithMantine(<Library />);
        await screen.findByText('Alice');

        await importFile(validFile({
            starred: { bob: { entity_name: 'Bob', entity_type: 'Person', savedAt: 2 } },
        }));

        expect(await screen.findByText(/You currently have 1 and 0/)).toBeInTheDocument();
    });

    it('does not ask when the file carries no entities', async () => {
        renderWithMantine(<Library />);
        await screen.findByRole('button', { name: 'Import' });

        await importFile(validFile({ settings: { theme: ThemeEnum.Dark } }));

        // A question with one real answer is not worth asking.
        await waitFor(async () => expect(await theme.getValue()).toBe(ThemeEnum.Dark));
        expect(screen.queryByRole('button', { name: 'Add to my lists' })).not.toBeInTheDocument();
    });

    it('keeps the good settings when one value is broken', async () => {
        await bubbleSize.setValue(13);
        renderWithMantine(<Library />);
        await screen.findByRole('button', { name: 'Import' });

        await importFile(validFile({
            settings: { theme: ThemeEnum.Dark, bubbleSize: 'enormous' },
        }));

        await waitFor(async () => expect(await theme.getValue()).toBe(ThemeEnum.Dark));
        expect(await bubbleSize.getValue()).toBe(13);
    });

    it('explains a file that is not an export, and changes nothing', async () => {
        await theme.setValue(ThemeEnum.Light);
        renderWithMantine(<Library />);
        await screen.findByRole('button', { name: 'Import' });

        await importFile({ hello: 'world' });

        expect(await screen.findByText(/not a Bubblener export/)).toBeInTheDocument();
        expect(await theme.getValue()).toBe(ThemeEnum.Light);
    });

    it('explains malformed JSON rather than failing silently', async () => {
        renderWithMantine(<Library />);
        await screen.findByRole('button', { name: 'Import' });

        await importFile('{ not json');

        expect(await screen.findByText(/not valid JSON/)).toBeInTheDocument();
    });

    it('reports what it imported', async () => {
        renderWithMantine(<Library />);
        await screen.findByRole('button', { name: 'Import' });

        await importFile(validFile({
            settings: { theme: ThemeEnum.Dark },
            starred: { bob: { entity_name: 'Bob', entity_type: 'Person' } },
        }));
        await userEvent.click(await screen.findByRole('button', { name: 'Add to my lists' }));

        expect(await screen.findByText(/1 settings, 1 starred, 0 hidden/)).toBeInTheDocument();
    });
});
