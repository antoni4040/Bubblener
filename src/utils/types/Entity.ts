interface Entity {
    entity_name: string;
    entity_type: 'Person' | 'Organization' | 'Location' | 'Key Concept/Theme';
    /** Surface forms as they appear in the text. Optional: responses stored
     *  before this field existed still parse. */
    mentions?: string[];
    /** How central to the passage, 0.0–1.0. Optional: older payloads lack it. */
    importance?: number;
    description: string;
    summary_from_text: string;
    contextual_enrichment: string | null;
}

export type { Entity as default };