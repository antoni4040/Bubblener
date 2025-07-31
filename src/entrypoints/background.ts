import { GoogleGenAI } from '@google/genai';

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

    const genAI = new GoogleGenAI({ apiKey });
    const maxElements = await maxNumberOfElements.getValue() || 12;
    const prompt = `Extract up to ${maxElements} of the most important named entities (people, organizations, locations, concepts) from the following text. For each entity, provide:
- A concise name.
- A brief description (1-2 sentences).
- A short summary (2-3 sentences).
Focus on unique and significant entities that add value to understanding the text.
Ignore advertisements, links, and other non-content elements.
Format the output as a valid JSON array of objects, like this:
[
  {
    "name": "Entity Name",
    "description": "Brief description.",
    "summary": "Short summary."
  }
]
Text: ${request.text}`;

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingBudget: 0, // Disables thinking
          },
        }
      });

      let entitiesText = response.text;
      console.log('Gemini API Response:', entitiesText);

      // Clean up the response to ensure it's valid JSON
      if (entitiesText.startsWith('```json')) {
        entitiesText = entitiesText.substring(7, entitiesText.lastIndexOf('```'));
      }

      const entities = JSON.parse(entitiesText);

      // Send the parsed entities back to the content script
      if (sender.tab?.id) {
        await browser.tabs.sendMessage(sender.tab.id, {
          entities: { nodes: entities, links: [] },
        });
        console.log('Entities sent to content script.');
      }
    } catch (error) {
      console.error('Error calling Gemini API or processing response:', error);
      
      // Handle specific API errors
      let errorMessage = 'An unknown error occurred while processing entities.';
      let errorTitle = 'Processing Error';
      
      if (error instanceof Error) {
        // Check if it's an API error with structured response
        if (error.message.includes('API key not valid')) {
          errorMessage = 'Invalid API key. Please check your Google Gemini API key in extension options.';
          errorTitle = 'Invalid API Key';
        } else if (error.message.includes('quota exceeded') || error.message.includes('QUOTA_EXCEEDED')) {
          errorMessage = 'API quota exceeded. Please check your Google Gemini API usage limits.';
          errorTitle = 'Quota Exceeded';
        } else if (error.message.includes('rate limit') || error.message.includes('RATE_LIMIT_EXCEEDED')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          errorTitle = 'Rate Limited';
        } else if (error.message.includes('model not found') || error.message.includes('MODEL_NOT_FOUND')) {
          errorMessage = 'The requested AI model is not available. Please check the model name.';
          errorTitle = 'Model Not Found';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
          errorTitle = 'Network Error';
        } else if (error.name === 'SyntaxError') {
          errorMessage = 'Failed to parse API response. The AI service may be experiencing issues.';
          errorTitle = 'Response Parse Error';
        } else {
          // Generic error with the actual error message
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      // Try to parse structured API error if available
      try {
        const errorStr = error.toString();
        if (errorStr.includes('ApiError:')) {
          const jsonStart = errorStr.indexOf('{');
          if (jsonStart !== -1) {
            const errorJson = JSON.parse(errorStr.substring(jsonStart));
            if (errorJson.error && errorJson.error.message) {
              errorMessage = errorJson.error.message;
              
              // Map specific error codes to user-friendly messages
              switch (errorJson.error.code) {
                case 400:
                  if (errorJson.error.status === 'INVALID_ARGUMENT') {
                    errorTitle = 'Invalid Request';
                    if (errorJson.error.message.includes('API key')) {
                      errorMessage = 'Invalid API key. Please update your Google Gemini API key in extension options.';
                      errorTitle = 'Invalid API Key';
                    }
                  }
                  break;
                case 401:
                  errorTitle = 'Authentication Error';
                  errorMessage = 'Authentication failed. Please check your API key permissions.';
                  break;
                case 403:
                  errorTitle = 'Access Forbidden';
                  errorMessage = 'Access denied. Your API key may not have permission for this service.';
                  break;
                case 429:
                  errorTitle = 'Rate Limited';
                  errorMessage = 'Too many requests. Please wait a moment before trying again.';
                  break;
                case 500:
                  errorTitle = 'Server Error';
                  errorMessage = 'Google Gemini service is experiencing issues. Please try again later.';
                  break;
              }
            }
          }
        }
      } catch (parseError) {
        // If we can't parse the structured error, stick with the generic message
        console.log('Could not parse structured error:', parseError);
      }
      
      // Show notification to user
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: errorTitle,
        message: errorMessage,
      });
      
      // Send error message to content script (optional)
      if (sender.tab?.id) {
        try {
          await browser.tabs.sendMessage(sender.tab.id, {
            error: {
              title: errorTitle,
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