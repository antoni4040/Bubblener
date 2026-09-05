import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/renderWithMantine';
import EntityModal from './EntityModal';
import type Entity from '@/utils/types/Entity';
import defaults from '@/utils/constants/defaults';

const entity: Entity = {
    entity_name: 'Acme Corporation',
    entity_type: 'Organization',
    description: 'A company mentioned in the text.',
    summary_from_text: 'Acme appears throughout the document as the main subject.',
    contextual_enrichment: null,
};

describe('EntityModal', () => {
    it('renders nothing when there is no entity', () => {
        renderWithMantine(
            <EntityModal entity={null} isOpen={true} colors={defaults.colorSettings} onClose={() => {}} />
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the entity name, type, and summary when open', () => {
        renderWithMantine(
            <EntityModal entity={entity} isOpen={true} colors={defaults.colorSettings} onClose={() => {}} />
        );

        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        expect(screen.getByText('Organization')).toBeInTheDocument();
        expect(screen.getByText(entity.summary_from_text)).toBeInTheDocument();
    });

    it('omits the contextual enrichment section when null', () => {
        renderWithMantine(
            <EntityModal entity={entity} isOpen={true} colors={defaults.colorSettings} onClose={() => {}} />
        );
        expect(screen.queryByText(/Founded in/)).not.toBeInTheDocument();
    });

    it('shows contextual enrichment when present', () => {
        renderWithMantine(
            <EntityModal
                entity={{ ...entity, contextual_enrichment: 'Founded in 1985.' }}
                isOpen={true}
                colors={defaults.colorSettings}
                onClose={() => {}}
            />
        );
        expect(screen.getByText('Founded in 1985.')).toBeInTheDocument();
    });

    it('does not render modal content when isOpen is false', () => {
        renderWithMantine(
            <EntityModal entity={entity} isOpen={false} colors={defaults.colorSettings} onClose={() => {}} />
        );
        expect(screen.queryByText('Acme Corporation')).not.toBeInTheDocument();
    });
});
