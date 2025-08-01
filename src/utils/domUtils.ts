export const getVisibleTextOnScreen = (): string => {
  // 1. Prioritized Content Extraction
  // Look for common main content containers in a preferred order.
  const prioritySelectors = [
    'article', 
    'main', 
    '[role="main"]', 
    '#content', 
    '#main', 
    '.post-content', 
    '.entry-content'
  ];

  for (const selector of prioritySelectors) {
    const mainContentElement = document.querySelector(selector) as HTMLElement | null;

    // If a priority element is found, use its text and stop.
    if (mainContentElement) {
      console.log(`Content extracted using priority selector: "${selector}"`);
      return mainContentElement.innerText;
    }
  }

  // 2. Fallback: Generic Text Extraction (your original logic)
  // This runs only if no priority containers are found.
  console.log("No priority selector found. Falling back to generic text extraction.");
  const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, a, span, td');
  let visibleText = '';

  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    const isVisible = (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      rect.width > 0 && rect.height > 0 && // Element must have dimensions
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