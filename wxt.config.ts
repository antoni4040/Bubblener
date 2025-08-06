import { defineConfig } from 'wxt';
import postcssSimpleVars from 'postcss-simple-vars';

// See https://wxt.dev/api/config.html
interface ManifestConfig {
  permissions: string[];
}

interface PostCSSConfig {
  plugins: any[];
}

interface DefineConfigOptions {
  modules: string[];
  srcDir: string;
  manifest: ManifestConfig;
  postcss: (config: PostCSSConfig) => void;
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    permissions: ['storage', 'contextMenus', 'notifications', 'activeTab'],
  },
  postcss: (config: PostCSSConfig) => {
    config.plugins.unshift(postcssSimpleVars());
  },
} as DefineConfigOptions);
