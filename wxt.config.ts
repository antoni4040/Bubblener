import { defineConfig } from 'wxt';
import postcssSimpleVars from 'postcss-simple-vars';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    permissions: ['storage', 'contextMenus', 'notifications'],
  },
  postcss: (config) => {
    config.plugins.unshift(postcssSimpleVars());
  },
});
