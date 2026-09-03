import { describe, expect, it } from 'vitest';
import parseEntitiesResponse from '@/utils/parseEntitiesResponse';

const validEntity = {
    entity_name: 'Acme Corporation',
    entity_type: 'Organization',
    description: 'A company mentioned in the text.',
    summary_from_text: 'Acme appears throughout the document as the main subject.',
    contextual_enrichment: null,
};

describe('parseEntitiesResponse', () => {
    it('parses a plain JSON array', () => {
        const raw = JSON.stringify([validEntity]);
        expect(parseEntitiesResponse(raw)).toEqual([validEntity]);
    });

    it('parses a JSON object with an entities array', () => {
        const raw = JSON.stringify({ entities: [validEntity] });
        expect(parseEntitiesResponse(raw)).toEqual([validEntity]);
    });

    it('strips ```json fenced code blocks', () => {
        const raw = '```json\n' + JSON.stringify([validEntity]) + '\n```';
        expect(parseEntitiesResponse(raw)).toEqual([validEntity]);
    });

    it('strips plain ``` fenced code blocks without a language tag', () => {
        const raw = '```\n' + JSON.stringify([validEntity]) + '\n```';
        expect(parseEntitiesResponse(raw)).toEqual([validEntity]);
    });

    it('tolerates surrounding whitespace and newlines around the fence', () => {
        const raw = `\n\n  \`\`\`json\n   ${JSON.stringify([validEntity])}   \n\`\`\`  \n`;
        expect(parseEntitiesResponse(raw)).toEqual([validEntity]);
    });

    it('handles contextual_enrichment being a non-null string', () => {
        const entity = { ...validEntity, contextual_enrichment: 'Founded in 1985.' };
        const raw = JSON.stringify([entity]);
        expect(parseEntitiesResponse(raw)).toEqual([entity]);
    });

    it('throws a descriptive error on malformed JSON', () => {
        expect(() => parseEntitiesResponse('not json at all')).toThrow(/Failed to parse entities response as JSON/);
    });

    it('throws when the payload is a JSON object without an entities array', () => {
        const raw = JSON.stringify({ foo: 'bar' });
        expect(() => parseEntitiesResponse(raw)).toThrow(/expected an array of entities/);
    });

    it('throws when entities are missing required fields', () => {
        const raw = JSON.stringify([{ entity_name: 'Acme' }]);
        expect(() => parseEntitiesResponse(raw)).toThrow(/Invalid entity shape/);
    });

    it('throws when entity_type is not one of the allowed categories', () => {
        const raw = JSON.stringify([{ ...validEntity, entity_type: 'Not A Category' }]);
        expect(() => parseEntitiesResponse(raw)).toThrow(/Invalid entity shape/);
    });

    it('recovers from a trailing comma before a closing brace or bracket', () => {
        const raw = `{"entities":[${JSON.stringify(validEntity).replace(/}$/, ',}')},]}`;
        expect(parseEntitiesResponse(raw)).toEqual([validEntity]);
    });

    it('does not mangle a comma that legitimately appears inside a string', () => {
        const entity = { ...validEntity, description: 'Trailing text, ] and , } inside a string.' };
        expect(parseEntitiesResponse(JSON.stringify([entity]))).toEqual([entity]);
    });

    it('still throws when the payload is broken beyond a trailing comma', () => {
        expect(() => parseEntitiesResponse('{"entities": [ { entity_name: Acme } ]}'))
            .toThrow(/Failed to parse entities response as JSON/);
    });

    it('returns an empty array when given an empty JSON array', () => {
        expect(parseEntitiesResponse('[]')).toEqual([]);
    });
});
