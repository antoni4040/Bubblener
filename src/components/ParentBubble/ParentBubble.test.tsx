import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParentBubble from './ParentBubble';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';
import defaults from '@/utils/constants/defaults';

const renderAt = (
    bubblePosition: BubblePositionEnum,
    setShowBubbles: (show: boolean) => void = () => { },
) => render(
    <ParentBubble
        setShowBubbles={setShowBubbles}
        bubblePosition={bubblePosition}
        bubbleDistance={20}
        colors={defaults.colorSettings}
    />
);

describe('ParentBubble', () => {
    it('calls setShowBubbles(true) when clicked', async () => {
        const setShowBubbles = vi.fn();
        renderAt(BubblePositionEnum.TopRight, setShowBubbles);

        await userEvent.click(screen.getByRole('button', { name: 'Show bubbles' }));
        expect(setShowBubbles).toHaveBeenCalledWith(true);
    });

    it('sits flush against the edge, offset only vertically', () => {
        renderAt(BubblePositionEnum.TopRight);

        const button = screen.getByRole('button', { name: 'Show bubbles' });
        expect(button.style.right).toBe('0px');
        expect(button.style.top).toBe('20px');
    });

    it('tucks into whichever edge the bubbles use', () => {
        renderAt(BubblePositionEnum.BottomLeft);

        const button = screen.getByRole('button', { name: 'Show bubbles' });
        expect(button.style.left).toBe('0px');
        expect(button.style.bottom).toBe('20px');
        // Rounded on the inner side only, so it reads as tucked in.
        expect(button.style.borderRadius).toBe('0 999px 999px 0');
    });

    it('is painted in the theme colour the launcher uses', () => {
        // Both buttons occupy the same corner, one replacing the other; they
        // have to be the same object as far as the reader is concerned.
        renderAt(BubblePositionEnum.TopRight);

        const button = screen.getByRole('button', { name: 'Show bubbles' });
        expect(button.style.getPropertyValue('--bn-edge-ink'))
            .toBe(defaults.colorSettings.person.gradientStart);
    });
});
