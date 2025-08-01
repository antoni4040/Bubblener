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

    const prompt = `# ROLE:
You are an expert research analyst. Your task is to extract key entities from a text and enrich them with your general knowledge to create a comprehensive knowledge base entry.

# GOAL:
Identify the most significant entities in the provided text (e.g., articles, book chapters, news reports). For each entity, you will provide a one-sentence description, a more detailed summary based *only* on the text, and then supplement it with external, factual context.

# INSTRUCTIONS:
1.  **Entity Identification**: Extract up to ${maxElements} of the most important entities. Focus on entities that are thematically significant or central to the text's narrative or argument.
2.  **Canonical Naming**: Consolidate all mentions of an entity (e.g., "The Company", "Acme Corp.", "Acme") under their single, most complete and formal name (e.g., "Acme Corporation").
3.  **Strict Information Synthesis**:
    * **Description**: The description field must be a *single, concise sentence* that defines the entity's primary identity or role as presented in the text.
    * **Summary**: The summary_from_text field must be a *3-4 sentence paragraph* that synthesizes all mentions of the entity to explain its broader activities, relationships, and significance *within the context of the document*.
    * **Enrichment**: The contextual_enrichment field should contain supplementary facts from your general knowledge. If the entity is fictional or you have no external knowledge, this value must be null.
4.  **Entity Categorization**: Classify each entity into one of the following types: **Person**, **Organization**, **Location**, or **Key Concept/Theme** (e.g., "Quantum Entanglement", "Neoclassical Economics", "Character Arc").

# OUTPUT FORMAT:
- Your output must be ONLY a valid JSON array of objects.
- Do not add any introductory text, closing remarks, or markdown json tags.
- If no significant entities are found, return an empty JSON array: [].

## JSON Schema:
[
  {
    "entity_name": "The full, canonical name of the entity.",
    "entity_type": "One of: Person, Organization, Location, Key Concept/Theme.",
    "description": "A single, concise sentence defining the entity's primary role in the text.",
    "summary_from_text": "A 3-4 sentence summary synthesizing the entity's significance, based exclusively on the provided text.",
    "contextual_enrichment": "Brief, supplementary facts from general knowledge (e.g., a person's profession, an organization's industry). Must be null if no external information is found."
  }
]

# TEXT TO ANALYZE:
${request.text}`

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
      if (entitiesText && entitiesText.startsWith('```json')) {
        entitiesText = entitiesText.substring(7, entitiesText.lastIndexOf('```'));
      }

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
      const errorMessage = error?.message || 'An unknown error occurred while processing entities.';

      // Show notification to user
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Error',
        message: errorMessage,
      });

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