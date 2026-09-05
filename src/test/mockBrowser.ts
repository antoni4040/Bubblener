import { vi } from 'vitest';

/**
 * A controllable stand-in for the `browser` global that WXT injects.
 *
 * The content script talks to the background exclusively through messages, so
 * tests need to see what it sent and to deliver replies on their own terms —
 * including out of order, which is how the stale-results bug appeared.
 */
type Listener = (request: any, sender?: any, sendResponse?: any) => void;

const messageListeners = new Set<Listener>();
const storageListeners = new Set<Listener>();

/** Everything the component has sent to the background. */
export const sentMessages: any[] = [];

export const sendMessageMock = vi.fn(async (message: any) => {
    sentMessages.push(message);
    return undefined;
});

(globalThis as any).browser = {
    runtime: {
        sendMessage: sendMessageMock,
        onMessage: {
            addListener: (fn: Listener) => messageListeners.add(fn),
            removeListener: (fn: Listener) => messageListeners.delete(fn),
        },
        getURL: (path: string) => `chrome-extension://test${path}`,
    },
    storage: {
        onChanged: {
            addListener: (fn: Listener) => storageListeners.add(fn),
            removeListener: (fn: Listener) => storageListeners.delete(fn),
        },
    },
    tabs: { create: vi.fn(), query: vi.fn(async () => activeTabs) },
};

/** What `browser.tabs.query` should report as the active tab. */
let activeTabs: any[] = [];
export const setActiveTab = (tab: any) => { activeTabs = tab ? [tab] : []; };

/** Delivers a message from the background, as `browser.tabs.sendMessage` would. */
export const emitMessage = (message: any) => {
    messageListeners.forEach((fn) => fn(message, {}, () => { }));
};

/** Fires the storage.onChanged listener the component installs. */
export const emitStorageChange = (changes: Record<string, unknown>) => {
    storageListeners.forEach((fn) => fn(changes));
};

export const resetBrowser = () => {
    activeTabs = [];
    sentMessages.length = 0;
    sendMessageMock.mockClear();
    messageListeners.clear();
    storageListeners.clear();
};
