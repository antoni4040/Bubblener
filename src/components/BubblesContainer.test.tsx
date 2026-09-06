import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '@/test/renderWithMantine';
import { emitMessage, emitStorageChange, sendMessageMock, sentMessages } from '@/test/mockBrowser';
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

    it('gives the limited slots to starred entities first', async () => {
        setStored('maxNumberOfElements', 1);
        setStored('starredEntities', { pinned: { ...entity('Pinned'), savedAt: 1 } });
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([entity('Pinned', { importance: 0.01 }), entity('Strong', { importance: 0.99 })]);

        // One slot, and the starred entity takes it despite the lower score.
        await waitFor(() => expect(bubbleNames()).toEqual(['Pinned']));
        // And it is visibly marked as pinned.
        expect(starredNames()).toEqual(['Pinned']);
    });

    it('shows no more bubbles than the configured limit', async () => {
        // A setting of N used to show N+1 once anything was starred.
        setStored('maxNumberOfElements', 3);
        setStored('starredEntities', { pinned: { ...entity('Pinned'), savedAt: 1 } });
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));

        deliver([
            entity('Pinned', { importance: 0.2 }),
            entity('A', { importance: 0.9 }),
            entity('B', { importance: 0.8 }),
            entity('C', { importance: 0.7 }),
            entity('D', { importance: 0.6 }),
        ]);

        await waitFor(() => expect(bubbleNames()).toHaveLength(3));
        expect(bubbleNames()).toEqual(['Pinned', 'A', 'B']);
    });
});

describe('BubblesContainer: progress while re-analysing', () => {
    it('shows a spinner for an analysis that starts with bubbles already up', async () => {
        // The big indicator only shows before the first entities arrive, so
        // every scroll-triggered analysis after that ran in silence.
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        deliver([entity('Raskolnikov')], 1);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));

        const reload = screen.getByRole('button', { name: 'Reload bubbles' });
        expect(reload).not.toHaveAttribute('data-loading', 'true');

        await userEvent.click(reload);

        const busy = await screen.findByRole('button', { name: 'Analysing' });
        expect(busy).toHaveAttribute('data-loading', 'true');
    });

    it('stops spinning once the answer lands', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        deliver([entity('Raskolnikov')], 1);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));

        await userEvent.click(screen.getByRole('button', { name: 'Reload bubbles' }));
        await screen.findByRole('button', { name: 'Analysing' });

        deliver([entity('Razumihin')], 2);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Reload bubbles' }))
                .not.toHaveAttribute('data-loading', 'true'));
    });
});

describe('BubblesContainer: failures', () => {
    it('stops the spinner and explains a refusal, not just a provider error', async () => {
        // Refusals — no key, blocked site, activation lost — used to return
        // silently, leaving a spinner that reads as a hang rather than a reason.
        renderWithMantine(<BubblesContainer />);
        expect(await screen.findByText('Processing entities...')).toBeInTheDocument();

        emitMessage({
            error: {
                title: 'No API key',
                message: 'Add your Gemini API key in the extension popup, or switch to Ollama.',
            },
        });

        expect(await screen.findByText(/Add your Gemini API key/)).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText('Processing entities...')).not.toBeInTheDocument());
    });

    it('reports a failed send at once instead of waiting for the watchdog', async () => {
        // An orphaned content script — the extension was reloaded — knows
        // immediately. Sitting on that for the full watchdog is pure delay.
        sendMessageMock.mockRejectedValueOnce(new Error('Extension context invalidated.'));
        renderWithMantine(<BubblesContainer />);

        expect(await screen.findByText(/Could not reach Bubblener/)).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText('Processing entities...')).not.toBeInTheDocument());
    });

    it('gives up on its own if nothing answers at all', async () => {
        // A Manifest V3 worker can be terminated mid-request, and then no
        // message of any kind arrives.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            renderWithMantine(<BubblesContainer />);
            await waitFor(() => expect(sentMessages).toHaveLength(1));
            expect(screen.getByText('Processing entities...')).toBeInTheDocument();

            await act(async () => { vi.advanceTimersByTime(121_000); });

            expect(await screen.findByText(/stopped responding/)).toBeInTheDocument();
            expect(screen.queryByText('Processing entities...')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not fire the watchdog once an answer has arrived', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            renderWithMantine(<BubblesContainer />);
            await waitFor(() => expect(sentMessages).toHaveLength(1));
            deliver([entity('Raskolnikov')]);
            await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));

            await act(async () => { vi.advanceTimersByTime(121_000); });

            expect(screen.queryByText(/stopped responding/)).not.toBeInTheDocument();
            expect(bubbleNames()).toEqual(['Raskolnikov']);
        } finally {
            vi.useRealTimers();
        }
    });

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

    it('applies a lowered limit to bubbles already on screen', async () => {
        setStored('maxNumberOfElements', 5);
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        deliver([
            entity('A', { importance: 0.9 }),
            entity('B', { importance: 0.8 }),
            entity('C', { importance: 0.7 }),
        ]);
        await waitFor(() => expect(bubbleNames()).toEqual(['A', 'B', 'C']));

        // Used to wait for the next model response before taking effect.
        setStored('maxNumberOfElements', 2);
        emitStorageChange({ maxNumberOfElements: { newValue: 2 } });

        await waitFor(() => expect(bubbleNames()).toEqual(['A', 'B']));
    });

    it('removes an entity hidden from somewhere else, without waiting', async () => {
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        deliver([entity('Raskolnikov'), entity('Razumihin')]);
        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov', 'Razumihin']));

        // As the Library page, or an import, would do it.
        setStored('hiddenEntities', { razumihin: { ...entity('Razumihin'), savedAt: 1 } });
        emitStorageChange({ hiddenEntities: { newValue: {} } });

        await waitFor(() => expect(bubbleNames()).toEqual(['Raskolnikov']));
    });

    it('re-sends the same text when the character limit changes', async () => {
        // The text is identical, so de-duplication would normally skip it —
        // dropping the one request the new limit was meant to produce.
        document.body.innerHTML = `<article><p>${'x'.repeat(500)}</p></article>`;
        setStored('maxNumberOfCharacters', 400);
        renderWithMantine(<BubblesContainer />);
        await waitFor(() => expect(sentMessages).toHaveLength(1));
        expect(sentMessages[0].text).toHaveLength(400);

        setStored('maxNumberOfCharacters', 100);
        emitStorageChange({ maxNumberOfCharacters: { newValue: 100 } });

        await waitFor(() => expect(sentMessages).toHaveLength(2));
        // And at the new limit, not the one it was holding when the change came in.
        expect(sentMessages[1].text).toHaveLength(100);
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
