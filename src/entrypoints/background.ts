import { GeminiAPIRequest, ChatGPTAPIRequest, DeepSeekAPIRequest } from '@/utils/promptUtils';
import apiKey from '@/utils/storage/apiKey';
import modelAPI from '@/utils/storage/modelAPI';
import maxNumberOfElements from '@/utils/storage/maxNumberOfElements';
import ModelAPIsEnum from '@/utils/types/modelAPIsEnum';

export default defineBackground(() => {
  // Track which tabs have the extension activated
  const activatedTabs = new Set<number>();

  // Function to activate content script
  const activateContentScript = async (tab: any) => {
    // Validate tab exists and has valid ID
    if (!tab || !tab.id || tab.id === -1) {
      console.log('Invalid tab - cannot activate content script');
      return;
    }

    // Check if URL is supported
    if (tab.url) {
      const url = new URL(tab.url);

      // Skip unsupported pages
      if (
        tab.url.endsWith('.pdf') ||
        url.protocol === 'chrome:' ||
        url.protocol === 'chrome-extension:' ||
        url.protocol === 'moz-extension:' ||
        url.protocol === 'about:' ||
        url.protocol === 'file:'
      ) {
        console.log(`Cannot activate on ${url.protocol} or PDF pages`);

        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icon-128.png'),
          title: 'Bubblener Not Supported',
          message: 'Bubblener cannot be activated on this type of page.',
        });
        return;
      }
    }

    try {
      // Add tab to activated set
      activatedTabs.add(tab.id);

      // Use appropriate script injection method
      if (browser.scripting?.executeScript) {
        // Manifest V3 method (Chrome, newer Firefox)
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/content.js']
        });
      } else if (browser.tabs?.executeScript) {
        // Manifest V2 method (Firefox, older Chrome)
        await browser.tabs.executeScript(tab.id, {
          file: 'content-scripts/content.js'
        });
      } else {
        throw new Error('No script injection method available');
      }

      console.log(`Content script activated for tab ${tab.id}`);

      // Notify user of activation
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Bubblener Activated',
        message: 'Entity detection is now active on this page.',
      });
    } catch (error) {
      console.error('Error activating content script:', error);

      // Show error notification to user
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Activation Failed',
        message: 'Could not activate Bubblener on this page.',
      });
    }
  };

  // Handle browser action click
  const handleBrowserActionClick = async (tab: any) => {
    if (tab) {
      await activateContentScript(tab);
    }
  };

  // Use the appropriate API based on what's available
  if (browser.action) {
    // Manifest V3 (Chrome, newer Firefox)
    browser.action.onClicked.addListener(handleBrowserActionClick);
  } else if (browser.browserAction) {
    // Manifest V2 (Firefox, older Chrome)
    browser.browserAction.onClicked.addListener(handleBrowserActionClick);
  } else {
    console.error('Neither browser.action nor browser.browserAction is available.');
  }

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
    const currentApiKey = await apiKey.getValue();
    if (!currentApiKey) {
      console.error('API Key not found. Please set it in the extension options.');
      // Notify the user
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'API Key Missing',
        message: 'Please set your API key in the extension options page.',
      });
      return;
    }

    const maxElements = await maxNumberOfElements.getValue();
    const currentModelAPI = await modelAPI.getValue();
    try {
      let response: string | undefined;
      if (currentModelAPI === ModelAPIsEnum.ChatGPT) {
        console.log('Using ChatGPT API for entity detection.');
        response = await ChatGPTAPIRequest(request.text, maxElements, currentApiKey);
      } else if (currentModelAPI === ModelAPIsEnum.Gemini) {
        console.log('Using Gemini API for entity detection.');
        response = await GeminiAPIRequest(request.text, maxElements, currentApiKey);
      } else if (currentModelAPI === ModelAPIsEnum.DeepSeek) {
        console.log('Using DeepSeek API for entity detection.');
        response = await DeepSeekAPIRequest(request.text, maxElements, currentApiKey);
      }

      if (typeof response !== 'string') {
        throw new Error('No response text received from API.');
      }

      if (response.startsWith('```json')) {
        response = response.slice(7, -3);
      }
      let entities = JSON.parse(response);
      if (!Array.isArray(entities)) {
        if (entities.entities) {
          entities = entities.entities;
        } else {
          throw new Error('Invalid response format: expected an array of entities.');
        }
      }
      console.log('Entities detected:', entities);

      if (sender.tab?.id) {
        await browser.tabs.sendMessage(sender.tab.id, {
          entities: { nodes: entities, links: [] },
        });
        console.log('Entities sent to content script.');
      }
    } catch (error: any) {
      console.error('Error calling API or processing response:', error);

      let errorMessage = 'An unknown error occurred while processing entities.';
      if (error?.message) {
        try {
          const errorObj = JSON.parse(error.message);
          if (errorObj?.error?.message) {
            errorMessage = errorObj.error.message;
          } else {
            errorMessage = error.message;
          }
        } catch (parseError) {
          errorMessage = error.message;
        }
      }

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