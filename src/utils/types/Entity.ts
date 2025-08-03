interface Entity {
    entity_name: string;
    entity_type: 'Person' | 'Organization' | 'Location' | 'Key Concept/Theme';
    description: string;
    summary_from_text: string;
    contextual_enrichment: string | null;
}

export default Entity;