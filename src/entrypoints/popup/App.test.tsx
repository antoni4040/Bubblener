import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '@/test/renderWithMantine';
import App from './App';
import apiKey from '@/utils/storage/apiKey';

const SECRET_KEY = 'sk-super-secret-value';

describe('App API key field', () => {
    it('never renders a previously saved key into the DOM', async () => {
        await apiKey.setValue(SECRET_KEY);
        renderWithMantine(<App />);

        await waitFor(() => expect(screen.getByText('Key saved')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Change Key' })).toBeInTheDocument();
        expect(document.body.innerHTML).not.toContain(SECRET_KEY);
    });

    it('shows an empty editable field and no "Key saved" text when no key is saved yet', async () => {
        await apiKey.setValue('');
        renderWithMantine(<App />);

        await waitFor(() =>
            expect(screen.getByPlaceholderText(/Enter your API Key/)).toBeInTheDocument()
        );
        expect(screen.queryByText('Key saved')).not.toBeInTheDocument();
    });

    it('clicking "Change Key" reveals an empty input, not the real key', async () => {
        await apiKey.setValue(SECRET_KEY);
        renderWithMantine(<App />);

        await userEvent.click(await screen.findByRole('button', { name: 'Change Key' }));

        const editableField = await screen.findByPlaceholderText(/Enter your API Key/);
        expect(editableField).toHaveValue('');
        expect(screen.queryByText('Key saved')).not.toBeInTheDocument();
    });

    it('typing a new key and saving persists it, then shows "Key saved" again', async () => {
        await apiKey.setValue(SECRET_KEY);
        renderWithMantine(<App />);

        await userEvent.click(await screen.findByRole('button', { name: 'Change Key' }));
        const editableField = await screen.findByPlaceholderText(/Enter your API Key/);
        await userEvent.type(editableField, 'sk-new-key');
        await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

        await waitFor(async () => expect(await apiKey.getValue()).toBe('sk-new-key'));
        await waitFor(() => expect(screen.getByText('Key saved')).toBeInTheDocument());
    });

    it('saving without touching the API key leaves the stored key untouched', async () => {
        await apiKey.setValue(SECRET_KEY);
        renderWithMantine(<App />);

        await screen.findByText('Key saved');
        await userEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

        await waitFor(() => expect(screen.getByText(/saved successfully/i)).toBeInTheDocument());
        expect(await apiKey.getValue()).toBe(SECRET_KEY);
    });

    it('merely opening "Change Key" does not touch the stored key', async () => {
        await apiKey.setValue(SECRET_KEY);
        renderWithMantine(<App />);

        await userEvent.click(await screen.findByRole('button', { name: 'Change Key' }));
        expect(await apiKey.getValue()).toBe(SECRET_KEY);
    });
});
