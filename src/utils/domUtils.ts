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

/**
 * The element the extracted text came from, or `document.body` when no
 * priority container matched. Mention highlighting scopes itself to this, so
 * it never marks up text that was never sent to the model.
 */
export const getContentRoot = (): HTMLElement => {
  for (const selector of prioritySelectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element) return element;
  }
  return document.body;
};

// Block-level text carriers. Deliberately no `a`/`span`: they are inline, so
// their text already appears in the enclosing block, and including them
// duplicated every link and flooded the request with navigation chrome.
const BLOCK_SELECTOR = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'blockquote', 'td', 'th', 'dd', 'dt', 'figcaption', 'pre',
].join(', ');

const intersectsViewport = (element: Element): boolean => {
  const style = window.getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none') return false;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  return (
    rect.top < window.innerHeight &&
    rect.bottom >= 0 &&
    rect.left < window.innerWidth &&
    rect.right >= 0
  );
};

/** True when an enclosing block inside `root` already carries this text. */
const isNestedBlock = (element: Element, root: HTMLElement): boolean => {
  const ancestor = element.parentElement?.closest(BLOCK_SELECTOR);
  return !!ancestor && ancestor !== root && root.contains(ancestor);
};

/**
 * The text currently on screen, within the page's main content container.
 *
 * Both halves matter. The priority selectors pick *where* to read, keeping
 * navigation and sidebars out; the viewport filter picks *what* to read, so
 * scrolling through a long article yields the section actually being read
 * rather than re-sending the whole thing.
 */
const getVisibleTextOnScreen = (): string => {
  const root = getContentRoot();

  const visible = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
    .filter((element) => !isNestedBlock(element, root))
    .filter(intersectsViewport)
    .map((element) => (element as HTMLElement).innerText?.trim() ?? '')
    .filter(Boolean);

  if (visible.length) return visible.join('\n');

  // No measurable blocks — a root holding bare text, or a layout we can't
  // measure. Reading the root whole is better than sending nothing.
  return root.innerText ?? '';
};

export default getVisibleTextOnScreen;