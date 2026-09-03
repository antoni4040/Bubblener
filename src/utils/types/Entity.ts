interface Entity {
    entity_name: string;
    entity_type: 'Person' | 'Organization' | 'Location' | 'Key Concept/Theme';
    /** Surface forms as they appear in the text. Optional: responses stored
     *  before this field existed still parse. */
    mentions?: string[];
    description: string;
    summary_from_text: string;
    contextual_enrichment: string | null;
}

export default Entity;