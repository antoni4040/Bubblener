import createAPIRequest from '../utils/promptUtils';
import geminiApiKey from '../utils/storage/geminiApiKey';
import maxNumberOfElements from '../utils/storage/maxNumberOfElements';

export default defineBackground(() => {
  // Track which tabs have the extension activated
  const activatedTabs = new Set<number>();

  // Function to activate content script
  const activateContentScript = async (tab: any) => {
    if (!tab.id) return;

    try {
      // Add tab to activated set
      activatedTabs.add(tab.id);

      // Inject content script if not already injected
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/content.js'] // Adjust path as needed
      });

      console.log(`Content script activated for tab ${tab.id}`);

      // Optionally notify user of activation
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Bubblener Activated',
        message: 'Entity detection is now active on this page.',
      });
    } catch (error) {
      console.error('Error activating content script:', error);
    }
  };

  // Handle browser action click
  browser.action.onClicked.addListener(async (tab) => {
    if (tab) {
      await activateContentScript(tab);
    }
  });

  // Handle context menu click
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'activateBubblener' && tab) {
      await activateContentScript(tab);
    }
  });

  // Create context menu on install
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "activateBubblener",
      title: "Activate Bubblener",
      contexts: ["page"]
    });
  });

  // Clean up when tab is closed
  browser.tabs.onRemoved.addListener((tabId) => {
    activatedTabs.delete(tabId);
  });

  // Clean up when tab is updated (navigated to new page)
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      activatedTabs.delete(tabId);
    }
  });

  // Process messages only from activated tabs
  browser.runtime.onMessage.addListener(async (request, sender) => {
    // Check if message has text and sender is from an activated tab
    if (!request.text || !sender.tab?.id || !activatedTabs.has(sender.tab.id)) {
      return;
    }

    console.log('Received text from activated content script. Processing...');

    // Use the imported storage item to get the key
    const apiKey = await geminiApiKey.getValue();
    if (!apiKey) {
      console.error('Gemini API Key not found. Please set it in the extension options.');
      // Notify the user
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'API Key Missing',
        message: 'Please set your Google Gemini API key in the extension options page.',
      });
      return;
    }

    const maxElements = await maxNumberOfElements.getValue() || 12;
    try {
      const response = await createAPIRequest(request.text, maxElements, apiKey);

      let entitiesText = response.text;
      console.log('Gemini API Response:', entitiesText);
      
      if (typeof entitiesText !== 'string') {
        throw new Error('No response text received from Gemini API.');
      }

      const entities = JSON.parse(entitiesText);

      // Send the parsed entities back to the content script
      if (sender.tab?.id) {
        await browser.tabs.sendMessage(sender.tab.id, {
          entities: { nodes: entities, links: [] },
        });
        console.log('Entities sent to content script.');
      }
    } catch (error: any) {
      console.error('Error calling Gemini API or processing response:', error);

      // Simple error handling - just show the error message
      let errorMessage = 'An unknown error occurred while processing entities.';
      if (error?.message) {
        try {
          // Try to parse the error message as JSON (for API errors)
          const errorObj = JSON.parse(error.message);
          if (errorObj?.error?.message) {
            errorMessage = errorObj.error.message;
          } else {
            errorMessage = error.message;
          }
        } catch (parseError) {
          // If parsing fails, use the original error message
          errorMessage = error.message;
        }
      }

      // Send error message to content script
      if (sender.tab?.id) {
        try {
          await browser.tabs.sendMessage(sender.tab.id, {
            error: {
              title: 'Error',
              message: errorMessage
            }
          });
        } catch (msgError) {
          console.log('Could not send error message to content script:', msgError);
        }
      }
    }
  });
});