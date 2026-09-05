import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '@/test/renderWithMantine';
import EntityBubble from './EntityBubble';
import type Entity from '@/utils/types/Entity';
import defaults from '@/utils/constants/defaults';

const entity: Entity = {
    entity_name: 'Acme Corporation',
    entity_type: 'Organization',
    description: 'A company mentioned in the text.',
    summary_from_text: 'Acme appears throughout the document.',
    contextual_enrichment: null,
};

describe('EntityBubble', () => {
    it('renders the entity name', () => {
        renderWithMantine(
            <EntityBubble index={0} entity={entity} colors={defaults.colorSettings} onEntityClick={() => {}} />
        );
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    it('calls onEntityClick with the entity when clicked', async () => {
        const onEntityClick = vi.fn();
        renderWithMantine(
            <EntityBubble index={0} entity={entity} colors={defaults.colorSettings} onEntityClick={onEntityClick} />
        );

        await userEvent.click(screen.getByText('Acme Corporation'));
        expect(onEntityClick).toHaveBeenCalledWith(entity);
    });
});
