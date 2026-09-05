import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '@/test/renderWithMantine';
import App from './App';
import apiKey from '@/utils/storage/apiKey';
import blockedSites from '@/utils/storage/blockedSites';
import { setActiveTab } from '@/test/mockBrowser';

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

describe('App blocked sites', () => {
    /** The blocklist lives in its own collapsed accordion section. */
    const openPrivacy = async () => {
        await userEvent.click(await screen.findByRole('button', { name: /Privacy/ }));
        return screen.findByLabelText('Site to block');
    };

    it('offers to block the site in the active tab, by bare hostname', async () => {
        setActiveTab({ id: 1, url: 'https://www.bank.example.com/accounts?x=1' });
        renderWithMantine(<App />);
        await openPrivacy();

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Never on bank.example.com' }))
                .toBeInTheDocument());
    });

    it('blocks immediately, without waiting for Save', async () => {
        // A privacy control that only takes effect once you remember to press
        // Save leaves a window where you believe you are protected.
        setActiveTab({ id: 1, url: 'https://bank.example.com/' });
        renderWithMantine(<App />);
        await openPrivacy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Never on bank.example.com' }));

        await waitFor(async () =>
            expect(await blockedSites.getValue()).toEqual(['bank.example.com']));
    });

    it('says so, and stops offering, once the current site is blocked', async () => {
        await blockedSites.setValue(['bank.example.com']);
        setActiveTab({ id: 1, url: 'https://bank.example.com/' });
        renderWithMantine(<App />);
        await openPrivacy();

        const button = screen.getByRole('button', { name: 'bank.example.com is blocked' });
        expect(button).toBeDisabled();
        // And it is listed, so it can be removed again.
        expect(screen.getByRole('button', { name: 'Stop blocking bank.example.com' }))
            .toBeInTheDocument();
    });

    it('recognises the current site as covered by a blocked parent domain', async () => {
        await blockedSites.setValue(['example.com']);
        setActiveTab({ id: 1, url: 'https://mail.example.com/' });
        renderWithMantine(<App />);
        await openPrivacy();

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /is blocked/ })).toBeDisabled());
    });

    it('accepts a pasted URL and stores just the hostname', async () => {
        renderWithMantine(<App />);

        await userEvent.type(await openPrivacy(), 'https://mail.example.com/inbox');
        await userEvent.click(screen.getByRole('button', { name: 'Block' }));

        await waitFor(async () =>
            expect(await blockedSites.getValue()).toEqual(['mail.example.com']));
    });

    it('removes a site from the list', async () => {
        await blockedSites.setValue(['example.com']);
        renderWithMantine(<App />);
        await openPrivacy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Stop blocking example.com' }));

        await waitFor(async () => expect(await blockedSites.getValue()).toEqual([]));
    });

    it('offers nothing to block on a page the extension cannot run on', async () => {
        setActiveTab({ id: 1, url: 'chrome://extensions' });
        renderWithMantine(<App />);
        await openPrivacy();

        expect(screen.queryByRole('button', { name: /^Never on/ })).not.toBeInTheDocument();
    });

    it('keeps the blocklist when everything else is reset to defaults', async () => {
        await blockedSites.setValue(['bank.example.com']);
        renderWithMantine(<App />);

        await userEvent.click(await screen.findByRole('button', { name: /Reset All/i }));

        await waitFor(() => expect(screen.getByText(/reset to defaults/i)).toBeInTheDocument());
        expect(await blockedSites.getValue()).toEqual(['bank.example.com']);
    });
});
