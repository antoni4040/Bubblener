// wxt's `storage` global is injected at build time via its Vite plugin, so
// it doesn't exist under plain Vitest. This provides a minimal in-memory
// stand-in with the same shape (getValue/setValue/removeValue/watch) so
// modules built on `storage.defineItem` can be unit tested directly.
import { emitStorageChange } from './mockBrowser';

const store = new Map<string, unknown>();
const defaults = new Map<string, unknown>();
const watchers = new Map<string, Set<(value: unknown) => void>>();

(globalThis as any).storage = {
    defineItem: (key: string, opts: { defaultValue: unknown }) => {
        defaults.set(key, opts.defaultValue);
        if (!store.has(key)) store.set(key, opts.defaultValue);
        return {
            getValue: async () => store.get(key),
            setValue: async (value: unknown) => {
                store.set(key, value);
                watchers.get(key)?.forEach((fn) => fn(value));
                // The real browser fires storage.onChanged for the extension's
                // own writes too — which is how a page learns that starring or
                // hiding something from its own modal took effect.
                emitStorageChange({ [key.replace(/^local:/, '')]: { newValue: value } });
            },
            removeValue: async () => {
                store.set(key, opts.defaultValue);
            },
            watch: (fn: (value: unknown) => void) => {
                if (!watchers.has(key)) watchers.set(key, new Set());
                watchers.get(key)!.add(fn);
                return () => watchers.get(key)!.delete(fn);
            },
        };
    },
};

/** Sets a value directly, as if it had been saved from the popup. */
export const setStored = (key: string, value: unknown) => {
    store.set(`local:${key}`, value);
};

/** Returns every key to its declared default. Without this, one test's
 *  settings silently become the next test's starting state. */
export const resetStorage = () => {
    store.clear();
    for (const [key, value] of defaults) store.set(key, value);
    watchers.clear();
};
