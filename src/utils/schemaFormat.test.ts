import { describe, expect, it } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';
import EntitiesSchema from '@/utils/types/EntitiesSchema';

/**
 * The provider SDKs are mocked everywhere else, so the unit suite can only
 * observe what we *meant* to send. This seam is the exception: `zodTextFormat`
 * turns our Zod schema into the JSON Schema ChatGPT is actually constrained
 * by, and it runs entirely offline. A Zod or OpenAI major that changed the
 * generated shape would otherwise stay invisible until a real call failed.
 */
describe('the JSON schema handed to ChatGPT', () => {
    const format = zodTextFormat(EntitiesSchema, 'entities') as any;
    const entity = format.schema.properties.entities.items;

    it('is a strict, closed schema', () => {
        expect(format.type).toBe('json_schema');
        expect(format.strict).toBe(true);
        expect(entity.additionalProperties).toBe(false);
    });

    it('carries every entity field the parser expects', () => {
        expect(entity.required).toEqual([
            'entity_name', 'entity_type', 'mentions', 'importance',
            'description', 'summary_from_text', 'contextual_enrichment',
        ]);
    });

    it('keeps the entity type constrained to the four we handle', () => {
        expect(entity.properties.entity_type.enum)
            .toEqual(['Person', 'Organization', 'Location', 'Key Concept/Theme']);
    });

    it('leaves contextual_enrichment genuinely nullable', () => {
        // A non-nullable schema here made `null` unrepresentable, so the model
        // complied by emitting the *string* "null" for every entity instead.
        expect(entity.properties.contextual_enrichment.type).toEqual(['string', 'null']);
    });
});
