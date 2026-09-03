import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorToast from './ErrorToast';

describe('ErrorToast', () => {
    it('renders nothing when there is no error', () => {
        const { container } = render(<ErrorToast error={null} onClose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the error title and message', () => {
        render(
            <ErrorToast
                error={{ title: 'API Key Missing', message: 'Please set your API key.' }}
                onClose={() => {}}
            />
        );

        expect(screen.getByText('API Key Missing')).toBeInTheDocument();
        expect(screen.getByText('Please set your API key.')).toBeInTheDocument();
    });

    it('calls onClose when the dismiss button is clicked', async () => {
        const onClose = vi.fn();
        render(
            <ErrorToast error={{ title: 'Error', message: 'Something failed.' }} onClose={onClose} />
        );

        await userEvent.click(screen.getByRole('button'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
