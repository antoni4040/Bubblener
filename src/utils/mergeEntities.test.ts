import { describe, expect, it } from 'vitest';
import mergeEntities, { type RankedEntity } from '@/utils/mergeEntities';
import entityKey from '@/utils/entityKey';
import type Entity from '@/utils/types/Entity';

const make = (name: string, importance?: number, description = 'd'): Entity => ({
    entity_name: name,
    entity_type: 'Person',
    importance,
    description,
    summary_from_text: 's',
    contextual_enrichment: null,
});

const names = (entities: RankedEntity[]) => entities.map((e) => e.entity_name);

describe('mergeEntities', () => {
    it('appends new entities after the existing ones', () => {
        const result = mergeEntities([make('A')], [make('B')], 10, 1);
        expect(names(result)).toEqual(['A', 'B']);
    });

    it('keeps existing bubbles in place so nothing jumps mid-stream', () => {
        const result = mergeEntities([make('A'), make('B')], [make('B'), make('C')], 10, 1);
        expect(names(result)).toEqual(['A', 'B', 'C']);
    });

    it('replaces a repeated entity with the newer version', () => {
        const result = mergeEntities([make('A', 0.5, 'old')], [make('A', 0.5, 'new')], 10, 1);
        expect(result).toHaveLength(1);
        expect(result[0]!.description).toBe('new');
    });

    it('treats names differing only by case or padding as the same entity', () => {
        const result = mergeEntities([make('Raskolnikov')], [make('  raskolnikov ')], 10, 1);
        expect(result).toHaveLength(1);
    });

    it('respects the caller\'s limit rather than a fixed ceiling', () => {
        const many = Array.from({ length: 12 }, (_, i) => make(`E${i}`, 0.5));
        expect(mergeEntities([], many, 8, 0)).toHaveLength(8);
        expect(mergeEntities([], many, 3, 0)).toHaveLength(3);
    });

    it('drops the least important when over the limit, not merely the oldest', () => {
        const current = [make('Vital', 0.9), make('Trivial', 0.1)];
        const result = mergeEntities(current, [make('Fresh', 0.6)], 2, 0);
        expect(names(result)).toEqual(['Vital', 'Fresh']);
    });

    it('lets a new section in even when older entities scored higher', () => {
        // Batch 0 filled every slot; batch 3 must still be able to displace it,
        // or reading on would never change what is shown.
        let shown = mergeEntities([], [make('Old1', 0.8), make('Old2', 0.8)], 2, 0);
        shown = mergeEntities(shown, [make('New', 0.7)], 2, 3);
        expect(names(shown)).toContain('New');
    });

    it('still favours a decisively more important older entity', () => {
        let shown = mergeEntities([], [make('Protagonist', 1.0)], 1, 0);
        shown = mergeEntities(shown, [make('Passer-by', 0.1)], 1, 1);
        expect(names(shown)).toEqual(['Protagonist']);
    });

    it('re-dates an entity that appears again, refreshing its claim', () => {
        let shown = mergeEntities([], [make('Recurring', 0.6), make('Once', 0.6)], 2, 0);
        shown = mergeEntities(shown, [make('Recurring', 0.6)], 2, 5);
        shown = mergeEntities(shown, [make('Newcomer', 0.5)], 2, 5);
        // "Once" is stale and unmentioned since; "Recurring" was just seen.
        expect(names(shown)).toEqual(['Recurring', 'Newcomer']);
    });

    it('treats a missing importance as middling rather than discarding it', () => {
        const result = mergeEntities([], [make('Unscored'), make('Weak', 0.1)], 1, 0);
        expect(names(result)).toEqual(['Unscored']);
    });

    it('ignores malformed entries rather than rendering a blank bubble', () => {
        const result = mergeEntities(
            [make('A')],
            [undefined as any, { entity_name: '   ' } as any],
            10, 1,
        );
        expect(names(result)).toEqual(['A']);
    });

    it('keeps a starred entity even when it would lose on score', () => {
        const pinned = new Set([entityKey('Beloved')]);
        const result = mergeEntities(
            [make('Beloved', 0.01)], [make('Strong', 0.99)], 1, 0, { pinned },
        );
        expect(names(result)).toEqual(['Beloved', 'Strong']);
    });

    it('does not let starred entities consume the limit for the rest', () => {
        const pinned = new Set([entityKey('Pinned')]);
        const result = mergeEntities(
            [make('Pinned', 0.01)],
            [make('A', 0.9), make('B', 0.8)],
            2, 0, { pinned },
        );
        expect(names(result)).toEqual(['Pinned', 'A', 'B']);
    });

    it('drops a hidden entity on arrival', () => {
        const hidden = new Set([entityKey('Noise')]);
        const result = mergeEntities([], [make('Signal', 0.5), make('Noise', 0.9)], 10, 0, { hidden });
        expect(names(result)).toEqual(['Signal']);
    });

    it('removes an entity hidden after it was already shown', () => {
        // Hiding must apply retroactively, not just to future batches.
        const hidden = new Set([entityKey('Regret')]);
        const result = mergeEntities([make('Keep'), make('Regret')], [], 10, 1, { hidden });
        expect(names(result)).toEqual(['Keep']);
    });

    it('matches starred and hidden names regardless of case or spacing', () => {
        const hidden = new Set([entityKey('Marfa  Petrovna')]);
        const result = mergeEntities([], [make('marfa petrovna')], 10, 0, { hidden });
        expect(result).toHaveLength(0);
    });
});
