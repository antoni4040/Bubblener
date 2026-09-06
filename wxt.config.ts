import { defineConfig } from 'wxt';
import postcssSimpleVars from 'postcss-simple-vars';

// See https://wxt.dev/api/config.html
interface ManifestConfig {
  permissions: string[];
  browser_specific_settings?: {
    gecko: {
      id: string;
      data_collection_permissions: {
        required: string[];
      };
    };
  };
}

interface PostCSSConfig {
  plugins: any[];
}

interface DefineConfigOptions {
  modules: string[];
  srcDir: string;
  manifest: (env: { browser: string }) => ManifestConfig;
  postcss: (config: PostCSSConfig) => void;
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  // A function, so the Gecko block is emitted only for Firefox. Chrome ignores
  // the key at runtime, but shipping a Firefox-only declaration in a Chrome
  // Web Store package is noise at review time.
  manifest: ({ browser }: { browser: string }) => ({
    permissions: ['storage', 'notifications', 'activeTab', 'scripting'],
    ...(browser === 'firefox' ? {
      browser_specific_settings: {
        gecko: {
          // Effectively permanent once published to addons.mozilla.org, and a
          // prerequisite for `storage.sync` — without an ID it silently does
          // nothing in Firefox rather than failing.
          id: 'bubblener@antoni4040',
          // Required for new extensions from 3 November 2025. Bubblener sends
          // the text of the page you are reading to the provider you chose, so
          // `websiteContent` is declared. Nothing else is collected: there is
          // no backend, and the API key never leaves local storage.
          data_collection_permissions: {
            required: ['websiteContent'],
          },
        },
      },
    } : {}),
  }),
  postcss: (config: PostCSSConfig) => {
    config.plugins.unshift(postcssSimpleVars());
  },
} as DefineConfigOptions);
