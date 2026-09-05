import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '@/test/renderWithMantine';
import { emitMessage, emitStorageChange, sentMessages } from '@/test/mockBrowser';
import { setStored } from '@/test/mockWxtStorage';
import BubblesContainer from '@/components/BubblesContainer';
import type Entity from '@/utils/types/Entity';

const entity = (name: string, extra: Partial<Entity> = {}): Entity => ({
    entity_name: name,
    entity_type: 'Person',
    mentions: [name],
    importance: 0.5,
    description: `${name} appears here.`,
    summary_from_text: `A summary about ${name}.`,
    contextual_enrichment: null,
    ...extra,
});

/** Delivers a completed analysis, the way the background does. */
const deliver = (entities: Entity[], requestId = 1) =>
    emitMessage({
        requestId,
        entities: { nodes: entities, links: [] },
        usage: { input: 100, output: 50 },
        durationMs: 1200,
        complete: true,
    });

/** Bubble labels, without the ★ a starred entity carries. */
const bubbleNames = () =>
    Array.from(document.querySelectorAll('[data-entity-index]'))
        .map((el) => (el.textContent || '').trim().replace(/^★\s*/, ''));

const starredNames = () =>
    Array.from(document.querySelectorAll('[data-entity-index]'))
        .filter((el) => (el.textContent || '').startsWith('★'))
        .map((el) => (el.textContent || '').trim().replace(/^★\s*/, ''));

beforeEach(() => {
    // jsdom has no layout engine, so `innerText` is unimplemented.
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        get() { return this.textContent; },
        configurable: true,
    });
    document.body.innerHTML =
        '<article><h1>A Page</h1><p>Raskolnikov met Razumihin near the gate.</p></article>';
});

describe('BubblesContainer: sending text', () => {
    it('sends the page text for analysis on activation', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        expect(sentMessages[0].text).toContain('Raskolnikov met Razumihin');
    });

    it('truncates to the configured character limit', async () => {
        setStored('maxNumberOfCharacters', 20);
        document.body.innerHTML = `<article><p>${'x'.repeat(500)}</p></article>`;

        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        expect(sentMessages[0].text).toHaveLength(20);
    });

    it('shows the spinner until an answer arrives', async () => {
        renderWithMantine(<BubblesContainer />);
        expect(await screen.findByText('Processing entities...')).toBeInTheDocument();

        deliver([entity('Raskolnikov')]);
        await waitFor(() =>
            expect(screen.queryByText('Processing entities...')).not.toBeInTheDocument());
    });
});

describe('BubblesContainer: receiving entities', () => {
    it('renders a bubble per entity', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([entity('Raskolnikov'), entity('Razumihin')]);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov', 'Razumihin']));
    });

    it('adds to what is on screen instead of replacing it', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([entity('Raskolnikov')], 1);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));

        deliver([entity('Razumihin')], 2);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov', 'Razumihin']));
    });

    it('ignores an answer for a request already superseded', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([entity('Current')], 5);
        await waitFor(() => expect(bubbleNames()).toEqual(['Current']));

        // A slower, older analysis finally returns — it must not be shown.
        deliver([entity('Stale')], 2);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(bubbleNames()).toEqual(['Current']);
    });

    it('keeps only the most important once the entity limit is reached', async () => {
        setStored('maxNumberOfElements', 2);
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([
            entity('Vital', { importance: 0.9 }),
            entity('Middling', { importance: 0.5 }),
            entity('Trivial', { importance: 0.05 }),
        ]);
        await waitFor(() => expect(bubbleNames()).toHaveLength(2));
        expect(bubbleNames()).toEqual(['Vital', 'Middling']);
    });

    it('never shows an entity on the hidden list', async () => {
        setStored('hiddenEntities', { razumihin: { ...entity('Razumihin'), savedAt: 1 } });
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([entity('Raskolnikov'), entity('Razumihin')]);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));
    });

    it('keeps a starred entity even past the limit', async () => {
        setStored('maxNumberOfElements', 1);
        setStored('starredEntities', { pinned: { ...entity('Pinned'), savedAt: 1 } });
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([entity('Pinned', { importance: 0.01 }), entity('Strong', { importance: 0.99 })]);
        await waitFor(() => expect(bubbleNames()).toEqual(['Pinned', 'Strong']));
        // And it is visibly marked as pinned.
        expect(starredNames()).toEqual(['Pinned']);
    });
});

describe('BubblesContainer: failures', () => {
    it('shows the error and stops the spinner', async () => {
        // A failed request used to leave the spinner running for ever, which
        // reads as a hang rather than as an error.
        renderWithMantine(<BubblesContainer />);
        expect(await screen.findByText('Processing entities...')).toBeInTheDocument();

        emitMessage({ requestId: 1, error: { title: 'Error', message: 'Provider unreachable.' } });

        expect(await screen.findByText('Provider unreachable.')).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText('Processing entities...')).not.toBeInTheDocument());
    });
});

describe('BubblesContainer: the detail modal', () => {
    it('opens on click with the summary, and can star the entity', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        deliver([entity('Raskolnikov')]);

        const bubble = await screen.findByText('Raskolnikov');
        await userEvent.click(bubble);

        expect(await screen.findByText('A summary about Raskolnikov.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /^Star$/ }));
        await waitFor(() => expect(screen.getByRole('button', { name: /Starred/ })).toBeInTheDocument());
    });
});

describe('BubblesContainer: settings', () => {
    it('picks up a changed setting without a page reload', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        deliver([entity('Raskolnikov')]);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));

        // The popup's Save writes storage and fires onChanged; the page must
        // apply it live rather than waiting for a reload.
        setStored('bubbleSize', 20);
        emitStorageChange({ bubbleSize: { newValue: 20 } });

        // jsdom does not resolve var(), so assert the variable the bubbles
        // read rather than the computed font-size.
        await waitFor(() => {
            const themed = document.querySelector('[style*="--bn-bubble-size"]') as HTMLElement;
            expect(themed.style.getPropertyValue('--bn-bubble-size')).toBe('20px');
        });
    });

    it('hides the bubbles on demand and brings them back', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        deliver([entity('Raskolnikov')]);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));

        await userEvent.click(screen.getByRole('button', { name: 'Hide bubbles' }));
        await waitFor(() => expect(bubbleNames()).toEqual([]));

        await userEvent.click(screen.getByRole('button', { name: 'Show bubbles' }));
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));
    });
});
