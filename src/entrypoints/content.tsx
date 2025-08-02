import './style.css';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import BubblesContainer from '@/components/BubblesContainer';

export default defineContentScript({
  matches: ['*://*/*'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Create shadow root UI
    const ui = await createShadowRootUi(ctx, {
      name: 'entity-bubbles-ui',
      inheritStyles: false,
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        // Create wrapper div to avoid React warnings about mounting on body
        const app = document.createElement('div');
        app.setAttribute("id", "bubblener-extension-root")
        container.append(app);

        // Create React root and render the app
        const root = ReactDOM.createRoot(app);
        root.render(<MantineProvider cssVariablesSelector="#bubblener-extension-root"
          getRootElement={() => app}>
          <BubblesContainer /> </MantineProvider>);
        return { root, app };
      },
      onRemove: (elements) => {
        // Unmount the root when the UI is removed
        elements?.root.unmount();
        elements?.app.remove();
      },
    });

    // Mount the UI
    ui.mount();
  },
});