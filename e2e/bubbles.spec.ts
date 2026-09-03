import { test, expect } from './fixtures';

const ARTICLE_URL = 'https://example.com/article';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const ARTICLE_HTML = `<!DOCTYPE html>
<html>
  <body>
    <article>
      <h1>Test Article</h1>
      <p>Acme Corporation is a well known business featured in this article about testing frameworks.</p>
    </article>
  </body>
</html>`;

const TEST_ENTITY = {
    entity_name: 'Acme Corporation',
    entity_type: 'Organization',
    description: 'A fictional company used for testing.',
    summary_from_text: 'Acme Corporation is featured throughout this test article as the primary example organization.',
    contextual_enrichment: null,
};

// Sets up storage (API key + provider, plus any extra overrides such as
// theme/bubbleColors) and serves the fake article page, then activates the
// extension on it via the real background code path.
const activateOnArticle = async (
    { context, background }: { context: any; background: any },
    storageOverrides: Record<string, unknown> = {}
) => {
    await background.evaluate(
        (overrides: Record<string, unknown>) =>
            chrome.storage.local.set({ apiKey: 'test-key', modelAPI: 'DeepSeek', ...overrides }),
        storageOverrides
    );

    await context.route(ARTICLE_URL, (route: any) =>
        route.fulfill({ contentType: 'text/html', body: ARTICLE_HTML })
    );

    const page = await context.newPage();
    await page.goto(ARTICLE_URL);

    const tabId = await background.evaluate(async (url: string) => {
        const tabs = await chrome.tabs.query({ url });
        return tabs[0]?.id;
    }, ARTICLE_URL);

    await background.evaluate(
        ({ id, url }: { id: number; url: string }) => (self as any).__bubblenerTestActivate({ id, url }),
        { id: tabId, url: ARTICLE_URL }
    );

    return page;
};

test('renders an entity bubble and opens its detail modal', async ({ context, background }) => {
    await context.route(DEEPSEEK_URL, (route) =>
        route.fulfill({
            json: {
                choices: [{ message: { content: JSON.stringify({ entities: [TEST_ENTITY] }) } }],
            },
        })
    );

    const page = await activateOnArticle({ context, background });

    const bubble = page.getByText(TEST_ENTITY.entity_name, { exact: true });
    await expect(bubble).toBeVisible();

    await bubble.click();
    await expect(page.getByText(TEST_ENTITY.summary_from_text)).toBeVisible();
});

test('shows an error toast when the API call fails', async ({ context, background }) => {
    await context.route(DEEPSEEK_URL, (route) =>
        route.fulfill({
            status: 401,
            json: { error: { message: 'Invalid API key provided.' } },
        })
    );

    const page = await activateOnArticle({ context, background });

    await expect(page.getByText('Error', { exact: true })).toBeVisible();
});

test('applies the selected theme to bubble colors and the accent gradient', async ({ context, background }) => {
    await context.route(DEEPSEEK_URL, (route) =>
        route.fulfill({
            json: {
                choices: [{ message: { content: JSON.stringify({ entities: [TEST_ENTITY] }) } }],
            },
        })
    );

    const page = await activateOnArticle({ context, background }, {
        theme: 'Cyberpunk',
        bubbleColors: {
            person: { gradientStart: '#34b94e', gradientEnd: '#34b94e', textColor: '#060a07' },
            organization: { gradientStart: '#d68f22', gradientEnd: '#d68f22', textColor: '#060a07' },
            location: { gradientStart: '#56b6c2', gradientEnd: '#56b6c2', textColor: '#060a07' },
            keyConcept: { gradientStart: '#c678dd', gradientEnd: '#c678dd', textColor: '#060a07' },
        },
    });

    // The test entity is type "Organization" -> the terminal's amber channel.
    const bubble = page.getByText(TEST_ENTITY.entity_name, { exact: true });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveAttribute('style', /rgb\(214, 143, 34\)/);

    // Themes change shape, not just color: terminals have square corners,
    // nothing floats above the glass, and the type is monospace.
    await expect(bubble).toHaveCSS('border-radius', '0px');
    await expect(bubble).toHaveCSS('font-family', /mono/i);
    await expect(bubble).toHaveCSS('text-transform', 'uppercase');

    // The wrapping container carries the theme's accent gradient for the
    // floating "show bubbles" button too.
    await expect(page.locator('[style*="--bn-accent-gradient"]').first()).toBeAttached();

    // The modal is a Mantine component inside a shadow root, so it does not
    // inherit the color scheme and has to be themed explicitly. Regression
    // guard: it must not fall back to stock Mantine dark grey / round corners.
    await bubble.click();
    const modal = page.locator('.mantine-Modal-content');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveCSS('background-color', 'rgb(6, 10, 7)');
    await expect(modal).toHaveCSS('border-radius', '0px');
    await expect(page.getByText(TEST_ENTITY.summary_from_text))
        .toHaveCSS('color', 'rgb(117, 207, 135)');
});
