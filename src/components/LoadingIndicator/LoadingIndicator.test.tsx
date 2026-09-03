import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/renderWithMantine';
import LoadingIndicator from './LoadingIndicator';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

describe('LoadingIndicator', () => {
    it('shows the processing message', () => {
        renderWithMantine(
            <LoadingIndicator bubblePosition={BubblePositionEnum.TopRight} bubbleDistance={20} />
        );
        expect(screen.getByText('Processing entities...')).toBeInTheDocument();
    });

    it('anchors to the top-right corner', () => {
        renderWithMantine(
            <LoadingIndicator bubblePosition={BubblePositionEnum.TopRight} bubbleDistance={20} />
        );
        const indicator = screen.getByText('Processing entities...').parentElement as HTMLElement;
        expect(indicator).toHaveStyle({ top: '20px', right: '20px', bottom: 'auto', left: 'auto' });
    });

    it('anchors to the bottom-left corner', () => {
        renderWithMantine(
            <LoadingIndicator bubblePosition={BubblePositionEnum.BottomLeft} bubbleDistance={10} />
        );
        const indicator = screen.getByText('Processing entities...').parentElement as HTMLElement;
        expect(indicator).toHaveStyle({ bottom: '10px', left: '10px', top: 'auto', right: 'auto' });
    });
});
