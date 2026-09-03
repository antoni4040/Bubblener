import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '@/test/renderWithMantine';
import EntityColorSection from './EntityColorSection';

const colors = { gradientStart: '#3b82f6', gradientEnd: '#1d4ed8', textColor: '#ffffff' };

describe('EntityColorSection', () => {
    it('calls onToggleSection when the header is clicked', async () => {
        const onToggleSection = vi.fn();
        renderWithMantine(
            <EntityColorSection
                entityType="person"
                displayName="Person"
                colors={colors}
                isOpen={false}
                onToggleSection={onToggleSection}
                onUpdateColorSetting={() => {}}
                onResetEntityColors={() => {}}
            />
        );

        await userEvent.click(screen.getByText('Person'));
        expect(onToggleSection).toHaveBeenCalledWith('person');
    });

    it('resets colors without also toggling the section (stops propagation)', async () => {
        const onToggleSection = vi.fn();
        const onResetEntityColors = vi.fn();
        renderWithMantine(
            <EntityColorSection
                entityType="organization"
                displayName="Organization"
                colors={colors}
                isOpen={false}
                onToggleSection={onToggleSection}
                onUpdateColorSetting={() => {}}
                onResetEntityColors={onResetEntityColors}
            />
        );

        await userEvent.click(screen.getByTitle('Reset Organization Colors'));
        expect(onResetEntityColors).toHaveBeenCalledWith('organization');
        expect(onToggleSection).not.toHaveBeenCalled();
    });

    it('shows the preview swatch text', () => {
        renderWithMantine(
            <EntityColorSection
                entityType="location"
                displayName="Location"
                colors={colors}
                isOpen={true}
                onToggleSection={() => {}}
                onUpdateColorSetting={() => {}}
                onResetEntityColors={() => {}}
            />
        );

        expect(screen.getByText('Location Preview')).toBeInTheDocument();
    });
});
