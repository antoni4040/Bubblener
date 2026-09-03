import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(dirname, '..', '.output', 'chrome-mv3');

export const test = base.extend<{
    context: BrowserContext;
    extensionId: string;
    background: Worker;
}>({
    // eslint-disable-next-line no-empty-pattern
    context: async ({}, use) => {
        const context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
            ],
        });
        await use(context);
        await context.close();
    },
    background: async ({ context }, use) => {
        let [worker] = context.serviceWorkers();
        if (!worker) {
            worker = await context.waitForEvent('serviceworker');
        }
        await use(worker);
    },
    extensionId: async ({ background }, use) => {
        await use(new URL(background.url()).host);
    },
});

export const expect = test.expect;
