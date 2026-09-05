import { describe, expect, it } from 'vitest';
import extractStreamedEntities from '@/utils/streamEntities';

const entity = (name: string) => ({
    entity_name: name,
    entity_type: 'Person',
    mentions: [name],
    description: `${name} is someone.`,
    summary_from_text: `A paragraph about ${name}.`,
    contextual_enrichment: null,
});

const wrapped = (names: string[]) =>
    JSON.stringify({ entities: names.map(entity) });

describe('extractStreamedEntities', () => {
    it('finds nothing in a buffer with no complete entity yet', () => {
        expect(extractStreamedEntities('{"entities": [ {"entity_name": "Rask')).toEqual([]);
    });

    it('returns an entity as soon as its closing brace arrives', () => {
        const full = wrapped(['Raskolnikov', 'Dounia']);
        // Cut mid-way through the second entity.
        const partial = full.slice(0, full.indexOf('Dounia') + 3);

        const found = extractStreamedEntities(partial);
        expect(found.map((e) => e.entity_name)).toEqual(['Raskolnikov']);
    });

    it('grows monotonically as more of the stream arrives', () => {
        const full = wrapped(['Raskolnikov', 'Dounia', 'Razumihin']);
        const counts = [];
        for (let i = 1; i <= full.length; i += 25) {
            counts.push(extractStreamedEntities(full.slice(0, i)).length);
        }
        // Never goes backwards, and ends with all three.
        for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
        }
        expect(extractStreamedEntities(full)).toHaveLength(3);
    });

    it('preserves the order the model emitted them in', () => {
        const found = extractStreamedEntities(wrapped(['A-name', 'B-name', 'C-name']));
        expect(found.map((e) => e.entity_name)).toEqual(['A-name', 'B-name', 'C-name']);
    });

    it('handles a bare array as well as an {entities:[...]} wrapper', () => {
        const bare = JSON.stringify([entity('Sonia')]);
        expect(extractStreamedEntities(bare).map((e) => e.entity_name)).toEqual(['Sonia']);
    });

    it('does not mistake the wrapper object for an entity', () => {
        const found = extractStreamedEntities(wrapped(['Luzhin']));
        expect(found).toHaveLength(1);
        expect(found[0]!.entity_name).toBe('Luzhin');
    });

    it('ignores braces and brackets inside string values', () => {
        const tricky = {
            ...entity('Marmeladov'),
            description: 'He said "} {" and left, oddly.',
        };
        const found = extractStreamedEntities(JSON.stringify({ entities: [tricky] }));
        expect(found).toHaveLength(1);
        expect(found[0]!.description).toBe('He said "} {" and left, oddly.');
    });

    it('skips a complete object that is not a valid entity', () => {
        const buffer = '{"entities": [ {"foo": "bar"}, ' + JSON.stringify(entity('Porfiry')) + ' ]}';
        expect(extractStreamedEntities(buffer).map((e) => e.entity_name)).toEqual(['Porfiry']);
    });

    it('normalises a placeholder enrichment mid-stream, like the batch parser', () => {
        const buffer = JSON.stringify([{ ...entity('Zametov'), contextual_enrichment: 'null' }]);
        expect(extractStreamedEntities(buffer)[0]!.contextual_enrichment).toBeNull();
    });
});
