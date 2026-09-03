import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomCircularButton from './CustomCircularButton';

describe('CustomCircularButton', () => {
    it('renders children and an accessible label', () => {
        render(
            <CustomCircularButton onClick={() => {}} aria-label="Show bubbles">
                <span>icon</span>
            </CustomCircularButton>
        );

        expect(screen.getByRole('button', { name: 'Show bubbles' })).toBeInTheDocument();
        expect(screen.getByText('icon')).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
        const onClick = vi.fn();
        render(
            <CustomCircularButton onClick={onClick} aria-label="Show bubbles">
                icon
            </CustomCircularButton>
        );

        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
