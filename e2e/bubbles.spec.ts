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

// Sets up storage (API key + provider) and serves the fake article page,
// then activates the extension on it via the real background code path.
const activateOnArticle = async ({ context, background }: { context: any; background: any }) => {
    await background.evaluate(() =>
        chrome.storage.local.set({ apiKey: 'test-key', modelAPI: 'DeepSeek' })
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
