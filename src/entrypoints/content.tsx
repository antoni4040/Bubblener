import './style.css';
import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Entity } from '@/utils/Entity';

// Main App Component
const EntityBubblesApp = () => {
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState(null);
  const [scrollThreshold, setScrollThreshold] = useState(500);

  useEffect(() => {
    // Load scroll threshold on component mount
    const loadScrollThreshold = async () => {
      try {
        const threshold = await pixelDistance.getValue();
        setScrollThreshold(threshold);
        // Set colors from storage or use defaults
      } catch (error) {
        console.warn('Could not load scroll threshold, using default:', error);
        setScrollThreshold(500); // Fallback value
      }
    };

    loadScrollThreshold();

    // Function to get visible text on screen
    const getVisibleTextOnScreen = () => {
      const allTextElements = Array.from(
        document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, a, span, td')
      );
      let visibleText = '';

      allTextElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        const isVisible = (
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.top < window.innerHeight &&
          rect.bottom >= 0 &&
          rect.left < window.innerWidth &&
          rect.right >= 0
        );

        if (isVisible) {
          visibleText += (element as HTMLElement).innerText + '\n';
        }
      });

      return visibleText;
    };

    // Send text to background script for processing
    const processText = (text: string) => {
      const maxTextLength = 16000;
      if (text.length > maxTextLength) {
        text = text.substring(0, maxTextLength);
        console.log(`Text truncated to ${maxTextLength} characters.`);
      }

      browser.runtime.sendMessage({ text })
        .then(response => {
          if (response && response.status === "processing") {
            console.log("Message sent to background script for processing.");
          }
        })
        .catch(error => console.error("Error sending message to background script:", error));
    };

    // Initial text extraction
    const initialText = getVisibleTextOnScreen();
    processText(initialText);

    // Listen for entities from background script
    const messageListener = (
      request: any,
      sender: any,
      sendResponse: (response?: any) => void
    ) => {
      if (request.entities) {
        setEntities(request.entities.nodes || []);
        setError(null); // Clear any previous errors
      }
      if (request.error) {
        setError(request.error);
        // Auto-hide error after 10 seconds
        setTimeout(() => setError(null), 10000);
      }
      if (request.action === "toggleBubbles") {
        setIsVisible(prev => !prev);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Scroll listener with debouncing
    let lastScrollY = window.scrollY;
    let scrollTimeout: any = null;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const currentScrollY = window.scrollY;
        if (Math.abs(currentScrollY - lastScrollY) >= scrollThreshold) {
          lastScrollY = currentScrollY;
          console.log("Significant scroll detected. Re-extracting text.");
          const newText = getVisibleTextOnScreen();
          processText(newText);
        }
      }, 500);
    };

    window.addEventListener('scroll', handleScroll);

    // Cleanup
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  const handleEntityClick = (entity: Entity) => {
    setSelectedEntity(entity);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEntity(null);
  };

  const handleCloseError = () => {
    setError(null);
  };

  if (!isVisible) return null;

  return (
    <>
      <div id="entity-bubbles-container" style={{ display: isVisible ? 'flex' : 'none' }}>
        {entities.map((entity, index) => (
          <EntityBubble
            key={index}
            entity={entity}
            onEntityClick={handleEntityClick}
          />
        ))}
      </div>

      <EntityModal
        entity={selectedEntity}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      <ErrorToast
        error={error}
        onClose={handleCloseError}
      />
    </>
  );
};

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Create shadow root UI
    const ui = await createShadowRootUi(ctx, {
      name: 'entity-bubbles-ui',
      position: 'overlay',
      anchor: 'body',
      append: 'first',
      onMount: (container) => {
        // Create wrapper div to avoid React warnings about mounting on body
        const app = document.createElement('div');
        app.setAttribute("id", "bubblener-extension-root")
        container.append(app);

        // Create React root and render the app
        const root = ReactDOM.createRoot(app);
        root.render(<MantineProvider cssVariablesSelector="#bubblener-extension-root"
          getRootElement={() => app}>
          <EntityBubblesApp /> </MantineProvider>);
        return root;
      },
      onRemove: (root) => {
        // Unmount the root when the UI is removed
        root?.unmount();
      },
    });

    // Mount the UI
    ui.mount();
  },
});