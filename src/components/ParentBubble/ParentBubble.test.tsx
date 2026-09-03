import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParentBubble from './ParentBubble';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

describe('ParentBubble', () => {
    it('calls setShowBubbles(true) when clicked', async () => {
        const setShowBubbles = vi.fn();
        render(
            <ParentBubble
                setShowBubbles={setShowBubbles}
                BubblesIcon="icon.svg"
                bubblePosition={BubblePositionEnum.TopRight}
                bubbleDistance={20}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'Show bubbles' }));
        expect(setShowBubbles).toHaveBeenCalledWith(true);
    });

    it('renders the provided bubble icon', () => {
        const { container } = render(
            <ParentBubble
                setShowBubbles={() => {}}
                BubblesIcon="icon.svg"
                bubblePosition={BubblePositionEnum.TopRight}
                bubbleDistance={20}
            />
        );
        expect(container.querySelector('img')).toHaveAttribute('src', 'icon.svg');
    });
});
