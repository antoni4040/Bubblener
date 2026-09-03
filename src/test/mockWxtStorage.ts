// wxt's `storage` global is injected at build time via its Vite plugin, so
// it doesn't exist under plain Vitest. This provides a minimal in-memory
// stand-in with the same shape (getValue/setValue/removeValue/watch) so
// modules built on `storage.defineItem` can be unit tested directly.
const store = new Map<string, unknown>();

(globalThis as any).storage = {
    defineItem: (key: string, opts: { defaultValue: unknown }) => {
        if (!store.has(key)) {
            store.set(key, opts.defaultValue);
        }
        return {
            getValue: async () => store.get(key),
            setValue: async (value: unknown) => {
                store.set(key, value);
            },
            removeValue: async () => {
                store.set(key, opts.defaultValue);
            },
            watch: () => () => {},
        };
    },
};
