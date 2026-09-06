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


/**
 * The providers stream now, so a plain JSON body is never parsed. This builds
 * the server-sent-events body an OpenAI-compatible stream actually returns.
 */
const sseBody = (content: string, usage = { prompt_tokens: 10, completion_tokens: 5 }) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
    + `data: ${JSON.stringify({ choices: [], usage })}\n\n`
    + 'data: [DONE]\n\n';

const streamEntities = (entities: unknown[]) => ({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: sseBody(JSON.stringify({ entities })),
});

// Sets up storage (API key + provider, plus any extra overrides such as
// theme/bubbleColors) and serves the fake article page, then activates the
// extension on it via the real background code path.
const activateOnArticle = async (
    { context, background }: { context: any; background: any },
    storageOverrides: Record<string, unknown> = {},
    url: string = ARTICLE_URL
) => {
    await background.evaluate(
        (overrides: Record<string, unknown>) =>
            chrome.storage.local.set({ apiKey: 'test-key', modelAPI: 'DeepSeek', ...overrides }),
        storageOverrides
    );

    await context.route(url, (route: any) =>
        route.fulfill({ contentType: 'text/html', body: ARTICLE_HTML })
    );

    const page = await context.newPage();
    await page.goto(url);

    const tabId = await background.evaluate(async (pageUrl: string) => {
        const tabs = await chrome.tabs.query({ url: pageUrl });
        return tabs[0]?.id;
    }, url);

    await background.evaluate(
        ({ id, pageUrl }: { id: number; pageUrl: string }) =>
            (self as any).__bubblenerTestActivate({ id, url: pageUrl }),
        { id: tabId, pageUrl: url }
    );

    return page;
};

test('renders an entity bubble and opens its detail modal', async ({ context, background }) => {
    await context.route(DEEPSEEK_URL, (route) =>
        route.fulfill(streamEntities([TEST_ENTITY])));

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

test('clears the spinner when a request fails, and shows timing while it runs', async ({ context, background }) => {
    // A failed request used to leave "Processing entities..." on screen
    // forever, which reads as a hang rather than an error.
    let release: (() => void) | null = null;
    await context.route(DEEPSEEK_URL, async (route) => {
        await new Promise<void>((resolve) => { release = resolve; });
        // 400 rather than 500: the SDK retries 5xx, which would fire the
        // route handler again and hang on a fresh gate.
        return route.fulfill({ status: 400, json: { error: { message: 'boom' } } });
    });

    const page = await activateOnArticle({ context, background });

    // While in flight: the indicator is up and counting.
    await expect(page.getByText('Processing entities...')).toBeVisible();
    await expect(page.getByText(/^\d+(\.\d+)?(ms|s)$/)).toBeVisible();

    release!();

    // After failure: error surfaces AND the spinner goes away.
    await expect(page.getByText('Error', { exact: true })).toBeVisible();
    await expect(page.getByText('Processing entities...')).toHaveCount(0);
});

test('explains a network failure instead of passing "Failed to fetch" through', async ({ context, background }) => {
    // The request never leaves the browser: no response, just a dead socket.
    await context.route(DEEPSEEK_URL, (route) => route.abort('failed'));

    const page = await activateOnArticle({ context, background });

    await expect(page.getByText(/Could not reach DeepSeek/)).toBeVisible();
    await expect(page.getByText(/connection, VPN, or an ad/)).toBeVisible();
    await expect(page.getByText('Processing entities...')).toHaveCount(0);
});

test('accumulates entities across sections instead of replacing them', async ({ context, background }) => {
    // Streaming itself is covered by unit tests (promptUtils reports each
    // partial; streamEntities extracts entities from an incomplete buffer).
    // What matters here is the visible consequence: nothing already on screen
    // disappears when the next batch arrives.
    const entity = (name: string) => ({
        entity_name: name, entity_type: 'Person', mentions: [name],
        description: `${name} appears here.`, summary_from_text: 's',
        contextual_enrichment: null,
    });

    const batches = [['Raskolnikov', 'Dounia'], ['Razumihin', 'Sonia']];
    let call = 0;
    await context.route(DEEPSEEK_URL, (route) => {
        const names = batches[Math.min(call++, batches.length - 1)]!;
        // The SDK is streaming, so answer with an SSE body.
        return route.fulfill(streamEntities(names.map(entity)));
    });

    const LONG_URL = 'https://example.com/sections';
    await context.route(LONG_URL, (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html><body style="font-size:18px;line-height:1.8"><article>`
            + Array.from({ length: 60 }, (_, i) =>
                `<h2>Part ${i + 1}</h2><p>Raskolnikov and Razumihin spoke at length in part ${i + 1}.</p>`).join('')
            + `</article></body></html>`,
    }));
    await background.evaluate(() =>
        chrome.storage.local.set({ apiKey: 'test-key', modelAPI: 'DeepSeek' }));

    const page = await context.newPage();
    await page.goto(LONG_URL);
    const tabId = await background.evaluate(async (url: string) => {
        const tabs = await chrome.tabs.query({ url });
        return tabs[0]?.id as number;
    }, LONG_URL);
    await background.evaluate(
        ({ id, url }: { id: number; url: string }) => (self as any).__bubblenerTestActivate({ id, url }),
        { id: tabId as number, url: LONG_URL }
    );

    const bubbles = page.locator('#entity-bubbles-container');
    await expect(bubbles.getByText('Raskolnikov', { exact: true })).toBeVisible();
    await expect(bubbles.getByText('Dounia', { exact: true })).toBeVisible();

    // Read on: a fresh section yields different entities.
    for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(900);
    }

    await expect(bubbles.getByText('Razumihin', { exact: true })).toBeVisible();
    // ...and the first section's entities are still listed.
    await expect(bubbles.getByText('Raskolnikov', { exact: true })).toBeVisible();
    await expect(bubbles.getByText('Dounia', { exact: true })).toBeVisible();
});

test('honours Max Number of Elements, keeping the most important', async ({ context, background }) => {
    const entity = (name: string, importance: number) => ({
        entity_name: name, entity_type: 'Person', mentions: [name], importance,
        description: `${name} appears here.`, summary_from_text: 's',
        contextual_enrichment: null,
    });

    // Two sections, three entities each, but only three bubbles allowed.
    const batches = [
        [entity('Central', 0.95), entity('Minor', 0.1), entity('Passing', 0.05)],
        [entity('NewLead', 0.9), entity('Bystander', 0.08), entity('Extra', 0.02)],
    ];
    let call = 0;
    await context.route(DEEPSEEK_URL, (route) =>
        route.fulfill(streamEntities(batches[Math.min(call++, 1)]!)));

    const LONG_URL = 'https://example.com/ranked';
    await context.route(LONG_URL, (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html><body style="font-size:18px;line-height:1.8"><article>`
            + Array.from({ length: 60 }, (_, i) =>
                `<h2>Part ${i + 1}</h2><p>Central and NewLead spoke in part ${i + 1}.</p>`).join('')
            + `</article></body></html>`,
    }));
    await background.evaluate(() => chrome.storage.local.set({
        apiKey: 'test-key', modelAPI: 'DeepSeek', maxNumberOfElements: 3,
    }));

    const page = await context.newPage();
    await page.goto(LONG_URL);
    const tabId = await background.evaluate(async (url: string) => {
        const tabs = await chrome.tabs.query({ url });
        return tabs[0]?.id as number;
    }, LONG_URL);
    await background.evaluate(
        ({ id, url }: { id: number; url: string }) => (self as any).__bubblenerTestActivate({ id, url }),
        { id: tabId as number, url: LONG_URL }
    );

    const bubbles = page.locator('#entity-bubbles-container');
    await expect(bubbles.getByText('Central', { exact: true })).toBeVisible();

    for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(900);
    }
    await expect(bubbles.getByText('NewLead', { exact: true })).toBeVisible();

    // Never more than the configured limit, however many sections were read.
    const shown = await bubbles.locator('[data-entity-index]').count();
    expect(shown).toBeLessThanOrEqual(3);

    // The strong entity from section one held its slot; the filler did not.
    await expect(bubbles.getByText('Central', { exact: true })).toBeVisible();
    await expect(bubbles.getByText('Passing', { exact: true })).toHaveCount(0);
    await expect(bubbles.getByText('Extra', { exact: true })).toHaveCount(0);
});

test('retires entities left screens behind, however important', async ({ context, background }) => {
    // The shape of the reported bug: names from the introduction still sitting
    // in the list while the reader is deep into chapter four.
    const entity = (name: string, importance: number) => ({
        entity_name: name, entity_type: 'Person', mentions: [name], importance,
        description: `${name} appears here.`, summary_from_text: 's',
        contextual_enrichment: null,
    });

    // Deliberately the *most* important entities, so only distance can retire
    // them — ranking alone would keep them forever.
    const batches = [
        [entity('Dostoevsky', 1.0), entity('Nekrassov', 0.95)],
        [entity('Porfiry', 0.6)],
    ];
    let call = 0;
    await context.route(DEEPSEEK_URL, (route) =>
        route.fulfill(streamEntities(batches[Math.min(call++, 1)]!)));

    const LONG_URL = 'https://example.com/novel';
    await context.route(LONG_URL, (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html><body style="font-size:18px;line-height:1.9">
            <article>
              <h1>Introduction</h1>
              <p>Dostoevsky and Nekrassov are discussed only here, at the very front.</p>`
            + Array.from({ length: 120 }, (_, i) =>
                `<h2>Chapter ${i + 1}</h2><p>Porfiry questioned him again in chapter ${i + 1}, at length and without haste.</p>`).join('')
            + `</article></body></html>`,
    }));
    await background.evaluate(() => chrome.storage.local.set({
        apiKey: 'test-key', modelAPI: 'DeepSeek', maxNumberOfElements: 8,
    }));

    const page = await context.newPage();
    await page.goto(LONG_URL);
    const tabId = await background.evaluate(async (url: string) => {
        const tabs = await chrome.tabs.query({ url });
        return tabs[0]?.id as number;
    }, LONG_URL);
    await background.evaluate(
        ({ id, url }: { id: number; url: string }) => (self as any).__bubblenerTestActivate({ id, url }),
        { id: tabId as number, url: LONG_URL }
    );

    const bubbles = page.locator('#entity-bubbles-container');
    await expect(bubbles.getByText('Dostoevsky', { exact: true })).toBeVisible();

    // Read far past the introduction.
    for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 3000);
        await page.waitForTimeout(700);
    }

    await expect(bubbles.getByText('Porfiry', { exact: true })).toBeVisible();
    await expect(bubbles.getByText('Dostoevsky', { exact: true })).toHaveCount(0);
    await expect(bubbles.getByText('Nekrassov', { exact: true })).toHaveCount(0);
});

test('says the provider is busy rather than showing a raw 503', async ({ context, background }) => {
    // A capacity failure is not the user's fault and not a settings problem.
    await context.route(DEEPSEEK_URL, (route) => route.fulfill({
        status: 503,
        json: { error: { message: 'This model is currently experiencing high demand.' } },
    }));

    const page = await activateOnArticle({ context, background });

    await expect(page.getByText(/DeepSeek is busy right now/)).toBeVisible();
    await expect(page.getByText(/Nothing is wrong with your settings/)).toBeVisible();
    await expect(page.getByText('Processing entities...')).toHaveCount(0);
});

test('discards answers for sections the reader has already scrolled past', async ({ context, background }) => {
    // Real providers take seconds. Scrolling starts a new analysis while the
    // previous is still in flight; every abandoned one used to complete and
    // merge its entities, so the bubbles filled with passages long gone.
    let n = 0;
    await context.route(DEEPSEEK_URL, async (route) => {
        const id = n++;
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return route.fulfill(streamEntities([{
            entity_name: `req-${id}`, entity_type: 'Person', mentions: [],
            importance: 0.9, description: 'd', summary_from_text: 's',
            contextual_enrichment: null,
        }]));
    });

    const LONG_URL = 'https://example.com/slow';
    await context.route(LONG_URL, (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html><html><body style="font-size:18px;line-height:1.9"><article>`
            + Array.from({ length: 200 }, (_, i) =>
                `<h2>Part ${i + 1}</h2><p>Section ${i + 1} carries its own distinct prose, `
                + `long enough to change what is on screen as the reader moves.</p>`).join('')
            + `</article></body></html>`,
    }));
    await background.evaluate(() =>
        chrome.storage.local.set({ apiKey: 'test-key', modelAPI: 'DeepSeek' }));

    const page = await context.newPage();
    await page.goto(LONG_URL);
    const tabId = await background.evaluate(async (url: string) => {
        const tabs = await chrome.tabs.query({ url });
        return tabs[0]?.id as number;
    }, LONG_URL);
    await background.evaluate(
        ({ id, url }: { id: number; url: string }) => (self as any).__bubblenerTestActivate({ id, url }),
        { id: tabId as number, url: LONG_URL }
    );

    // Read on while answers are still outstanding.
    for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 2500);
        await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(6000);

    const bubbles = page.locator('#entity-bubbles-container');
    const shown = await bubbles.locator('[data-entity-index]').allInnerTexts();

    // Several requests raced; only the newest may show.
    expect(n).toBeGreaterThan(1);
    expect(shown.length).toBeGreaterThan(0);
    const newest = `req-${n - 1}`;
    expect(shown.map((t) => t.trim())).toEqual([newest]);
});

test('applies the selected theme to bubble colors and the accent gradient', async ({ context, background }) => {
    await context.route(DEEPSEEK_URL, (route) =>
        route.fulfill(streamEntities([TEST_ENTITY])));

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

const activateOn = async (
    { context, background }: { context: any; background: any },
    url: string,
    body: string,
) => {
    await context.route(url, (route: any) =>
        route.fulfill({ contentType: 'text/html', body }));
    await background.evaluate(() =>
        chrome.storage.local.set({ apiKey: 'test-key', modelAPI: 'DeepSeek' }));

    const page = await context.newPage();
    await page.goto(url);
    const tabId = await background.evaluate(async (target: string) => {
        const tabs = await chrome.tabs.query({ url: target });
        return tabs[0]?.id as number;
    }, url);
    await background.evaluate(
        ({ id, target }: { id: number; target: string }) =>
            (self as any).__bubblenerTestActivate({ id, url: target }),
        { id: tabId as number, target: url }
    );
    await page.locator('#entity-bubbles-container').waitFor();
    return page;
};

const recordPayloads = async (context: any) => {
    const payloads: string[] = [];
    await context.route(DEEPSEEK_URL, (route: any) => {
        payloads.push(route.request().postData() || '');
        return route.fulfill(streamEntities([TEST_ENTITY]));
    });
    return payloads;
};

test('scrolling analyses the section being read, not the whole article', async ({ context, background }) => {
    const URL = 'https://example.com/long';
    const sections = Array.from({ length: 60 }, (_, i) =>
        `<h2>Section ${i + 1}</h2><p>In section ${i + 1}, Acme Corporation met delegation ${i + 1}, ` +
        `and the discussion continued at length before the room emptied again.</p>`
    ).join('');

    const payloads = await recordPayloads(context);
    const page = await activateOn({ context, background }, URL,
        `<!DOCTYPE html><html><body style="font-size:18px;line-height:1.8">
         <nav><p>Home | About | Subscribe</p></nav>
         <article><h1>Long</h1>${sections}</article></body></html>`);

    await expect.poll(() => payloads.length).toBe(1);
    for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(900);
    }

    const sent = payloads.map((p) => JSON.parse(p).messages[1].content as string);

    // Every request carries different content — the part actually on screen.
    expect(new Set(sent).size).toBe(sent.length);
    expect(sent.length).toBeGreaterThan(1);

    // ...which is a small slice, not the whole article, and excludes the nav.
    for (const text of sent) {
        expect(text.length).toBeLessThan(3000);
        expect(text).not.toContain('Subscribe');
    }
});

test('unchanged visible text is not re-sent', async ({ context, background }) => {
    // One block taller than the viewport: scrolling keeps the same element on
    // screen, so the extracted text is identical and must not be re-requested.
    const URL = 'https://example.com/tall';
    const payloads = await recordPayloads(context);
    const page = await activateOn({ context, background }, URL,
        `<!DOCTYPE html><html><body>
         <article><p style="height:6000px">Acme Corporation fills the whole page.</p></article>
         </body></html>`);

    await expect.poll(() => payloads.length).toBe(1);
    for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(900);
    }
    expect(payloads).toHaveLength(1);
});

test('never contacts the provider on a blocked site', async ({ context, background }) => {
    // The real guarantee is not that the bubbles are hidden — it is that the
    // page text never leaves the browser. So assert on the network, not the UI.
    let providerCalls = 0;
    await context.route(DEEPSEEK_URL, (route) => {
        providerCalls++;
        return route.fulfill(streamEntities([TEST_ENTITY]));
    });

    const page = await activateOnArticle({ context, background }, {
        blockedSites: ['example.com'],
    });

    await page.waitForTimeout(2500);

    expect(providerCalls).toBe(0);
    await expect(page.getByText(TEST_ENTITY.entity_name, { exact: true })).toHaveCount(0);
});

test('blocking a parent domain also covers its subdomains', async ({ context, background }) => {
    let providerCalls = 0;
    await context.route(DEEPSEEK_URL, (route) => {
        providerCalls++;
        return route.fulfill(streamEntities([TEST_ENTITY]));
    });

    const page = await activateOnArticle(
        { context, background },
        { blockedSites: ['example.com'] },
        'https://news.example.com/story',
    );

    await page.waitForTimeout(2500);
    expect(providerCalls).toBe(0);
});

test('an unblocked site still works, so the gate is not simply off', async ({ context, background }) => {
    // The counterpart to the two tests above: a blocklist that blocked
    // everything would pass them both and be useless.
    await context.route(DEEPSEEK_URL, (route) => route.fulfill(streamEntities([TEST_ENTITY])));

    const page = await activateOnArticle({ context, background }, {
        blockedSites: ['unrelated.test'],
    });

    await expect(page.getByText(TEST_ENTITY.entity_name, { exact: true })).toBeVisible();
});

test('exports a real file from the Library page, without the API key', async ({
    context, background, extensionId,
}) => {
    // The download path — Blob, object URL, anchor click — is stubbed out
    // entirely under jsdom, so this is the only place it is really exercised.
    await background.evaluate(() => chrome.storage.local.set({
        apiKey: 'sk-super-secret-value',
        theme: 'Cyberpunk',
        blockedSites: ['bank.example.com'],
    }));

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/library.html`);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^bubblener-settings-\d{4}-\d{2}-\d{2}\.json$/);

    const stream = await download.createReadStream();
    const contents = await new Promise<string>((resolve, reject) => {
        let text = '';
        stream.on('data', (chunk) => { text += chunk; });
        stream.on('end', () => resolve(text));
        stream.on('error', reject);
    });

    expect(contents).not.toContain('sk-super-secret-value');
    expect(contents).not.toContain('apiKey');

    const parsed = JSON.parse(contents);
    expect(parsed.settings.theme).toBe('Cyberpunk');
    expect(parsed.settings.blockedSites).toEqual(['bank.example.com']);
});

test('the resting edge button is clickable, and starts an analysis', async ({ context, background }) => {
    // The launcher lives in a *closed* shadow root, so it cannot be queried or
    // clicked by selector — only by real mouse events at real coordinates.
    // That makes this the only check that the button is actually where we think
    // it is and hittable while it is still tucked into the edge.
    await context.route(DEEPSEEK_URL, (route) => route.fulfill(streamEntities([TEST_ENTITY])));
    await background.evaluate(() => chrome.storage.local.set({
        apiKey: 'test-key', modelAPI: 'DeepSeek', showLauncher: true,
    }));
    await context.route(ARTICLE_URL, (route: any) =>
        route.fulfill({ contentType: 'text/html', body: ARTICLE_HTML }));

    const page = await context.newPage();
    await page.goto(ARTICLE_URL);

    // The host is in the light DOM even though its contents are not.
    await expect(page.locator('bubblener-launcher')).toHaveCount(1);

    // Top Right, 20px down by default: 38x40, resting against the edge.
    const size = page.viewportSize()!;
    await page.mouse.move(size.width - 4, 41);
    await page.mouse.click(size.width - 4, 41);

    await expect(page.getByText(TEST_ENTITY.entity_name, { exact: true })).toBeVisible();
    // Having done its job, it gets out of the way.
    await expect(page.locator('bubblener-launcher')).toHaveCount(0);
});

test('no launcher appears on a blocked site', async ({ context, background }) => {
    await background.evaluate(() => chrome.storage.local.set({
        apiKey: 'test-key', modelAPI: 'DeepSeek', showLauncher: true,
        blockedSites: ['example.com'],
    }));
    await context.route(ARTICLE_URL, (route: any) =>
        route.fulfill({ contentType: 'text/html', body: ARTICLE_HTML }));

    const page = await context.newPage();
    await page.goto(ARTICLE_URL);
    await page.waitForTimeout(1200);

    await expect(page.locator('bubblener-launcher')).toHaveCount(0);
});
