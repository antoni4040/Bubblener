import { z } from "zod";

const EntitySchema = z.object({
  entity_name: z.string().describe("The canonical name of the entity."),
  entity_type: z.enum(['Person', 'Organization', 'Location', 'Key Concept/Theme']).describe("The category of the entity."),
  description: z.string().describe("A single, concise sentence defining the entity's role in the text."),
  summary_from_text: z.string().describe("A 3-4 sentence summary synthesized exclusively from the provided text."),
  contextual_enrichment: z.string().nullable().describe("External facts about the entity, or null if none exist."),
});

const EntitiesSchema = z.object({
  entities: z.array(EntitySchema),
}).describe("A list of entities extracted from the text, each with a description, summary, and contextual enrichment.");

export default EntitiesSchema;