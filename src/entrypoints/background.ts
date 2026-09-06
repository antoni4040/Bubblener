import { GeminiAPIRequest, ChatGPTAPIRequest, DeepSeekAPIRequest, OllamaAPIRequest } from '@/utils/promptUtils';
import models from '@/utils/constants/models';
import timingStats from '@/utils/storage/timingStats';
import { estimateMs, recordSample } from '@/utils/timing';
import { logRequest, logResponse, logFailure } from '@/utils/logger';
import { REQUEST_TIMEOUT_MS } from '@/utils/promptUtils';
import extractStreamedEntities from '@/utils/streamEntities';
import modelTier from '@/utils/storage/modelTier';
import ollamaModel from '@/utils/storage/ollamaModel';
import parseEntitiesResponse from '@/utils/parseEntitiesResponse';
import tokenUsage from '@/utils/storage/tokenUsage';
import type { ProviderResponse } from '@/utils/promptUtils';
import apiKey from '@/utils/storage/apiKey';
import blockedSites from '@/utils/storage/blockedSites';
import { isSiteBlocked } from '@/utils/siteBlocking';
import modelAPI from '@/utils/storage/modelAPI';
import maxNumberOfElements from '@/utils/storage/maxNumberOfElements';
import ModelAPIsEnum from '@/utils/types/modelAPIsEnum';
import { createSerializer } from '@/utils/serialize';

/** The provider is up but refusing work right now: capacity or rate limits.
 *  Nothing is wrong with the request, so say "try again" rather than
 *  presenting it as a failure the user has to fix. */
const isBusyError = (error: any): boolean => {
  const status = error?.status ?? error?.code;
  if (status === 429 || status === 503) return true;
  return /unavailable|overloaded|high demand|rate.?limit|too many requests/i
    .test(error?.message ?? '');
};

/** A request that never reached the provider: DNS, offline, CORS, a blocker,
 *  or a local server that isn't running. The SDKs surface these as a bare
 *  TypeError or as APIConnectionError's "Connection error." */
const isNetworkError = (error: any): boolean =>
  error?.name === 'APIConnectionError'
  || /failed to fetch|networkerror|connection error|fetch failed|load failed/i
    .test(error?.message ?? '');

/**
 * Which tabs the user has activated.
 *
 * `session:`, not a plain `Set`: Chrome routinely terminates an idle Manifest
 * V3 service worker, and in-memory state dies with it while the injected
 * content script keeps running and keeps sending. The tab then looked
 * deactivated for no reason the user could see. Session storage survives the
 * restart, is cleared when the browser closes — which is the lifetime we want
 * — and never touches disk.
 */
const activatedTabsItem = storage.defineItem<number[]>('session:activatedTabs', {
  defaultValue: [],
});

export default defineBackground(() => {
  // Reads and writes are serialized: two tabs activating at once would
  // otherwise read the same list and one would erase the other.
  const serializeTabs = createSerializer();
  // Token totals and timing samples are read-modify-write against storage, and
  // several tabs share this worker. Without this the later of two concurrent
  // analyses simply erased the earlier one's numbers.
  const serializeStats = createSerializer();

  const isActivated = async (tabId: number) =>
    (await activatedTabsItem.getValue()).includes(tabId);

  const addActivatedTab = (tabId: number) => serializeTabs(async () => {
    const tabs = await activatedTabsItem.getValue();
    if (!tabs.includes(tabId)) await activatedTabsItem.setValue([...tabs, tabId]);
  });

  const removeActivatedTab = (tabId: number) => serializeTabs(async () => {
    const tabs = await activatedTabsItem.getValue();
    if (tabs.includes(tabId)) {
      await activatedTabsItem.setValue(tabs.filter((id) => id !== tabId));
    }
  });

  /**
   * The analysis currently running for each tab.
   *
   * Scrolling starts a new analysis while the previous one is still in flight.
   * Left alone, every abandoned request runs to completion — spending the
   * user's tokens and then delivering entities for a section they scrolled
   * past long ago, which is what made the bubbles look stale.
   */
  const inFlight = new Map<number, { id: number; controller: AbortController }>();
  let nextRequestId = 0;

  const isBlocked = async (url: string | undefined) =>
    isSiteBlocked(url, await blockedSites.getValue());

  /** Reports whether the content script is actually running, so callers
   *  (the on-page launcher) can stop showing progress when it is not. */
  const activateContentScript = async (tab: any): Promise<boolean> => {
    // Validate tab exists and has valid ID
    if (!tab || !tab.id || tab.id === -1) {
      console.log('Invalid tab - cannot activate content script');
      return false;
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
        return false;
      }
    }

    // The blocklist is a privacy control, so it is enforced here rather than
    // only in the UI: the background script is the one place that can actually
    // refuse, the same reason `activatedTabs` is checked before any paid call.
    if (await isBlocked(tab.url)) {
      console.log(`Bubblener is blocked on ${tab.url}`);

      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Bubblener Blocked Here',
        message: 'This site is on your blocklist. Remove it in the settings to analyse it.',
      });
      return false;
    }

    try {
      // Add tab to activated set
      await addActivatedTab(tab.id);

      // Use appropriate script injection method
      if (browser.scripting?.executeScript) {
        // Manifest V3 method (Chrome, newer Firefox)
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/content.js']
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
      return true;
    } catch (error) {
      console.error('Error activating content script:', error);

      // Show error notification to user
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Activation Failed',
        message: 'Could not activate Bubblener on this page.',
      });
      // Injection failed, so the tab is not really active after all.
      await removeActivatedTab(tab.id);
      return false;
    }
  };

  // Exposes the real activation path for e2e tests, which can't click the
  // native context menu. Harmless in production: only reachable from code
  // already running inside the background service worker.
  (globalThis as any).__bubblenerTestActivate = activateContentScript;

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

  /**
   * Forgets a tab, and stops whatever it was paying for.
   *
   * Dropping it from the activated list was never enough: the provider request
   * ran to completion regardless, spending tokens on a page nobody is reading.
   * Worse on navigation, where the tab id survives — the entry stayed in
   * `inFlight`, so `isCurrent()` was still true and a late answer from the
   * previous page could be delivered to the next one.
   */
  const forgetTab = async (tabId: number) => {
    inFlight.get(tabId)?.controller.abort();
    inFlight.delete(tabId);
    await removeActivatedTab(tabId);
  };

  /**
   * Blocking a site stops it *now*, including a request already in flight.
   *
   * The checks at activation and on the way in only govern the next request.
   * Somebody who blocks a site mid-analysis has said stop — waiting for that
   * analysis to finish, spend its tokens and paint its bubbles is not what
   * they asked for. The text has already been sent and cannot be recalled,
   * but nothing after it has to happen.
   */
  blockedSites.watch(async (patterns) => {
    if (!patterns?.length) return;

    for (const tabId of await activatedTabsItem.getValue()) {
      // Only tabs with work actually running. This exists to stop that work;
      // deactivating here as well would mean the *next* attempt reported
      // "not active" instead of the real reason, which is that it is blocked.
      const tab = await browser.tabs.get(tabId).catch(() => undefined);
      if (!tab || !isSiteBlocked(tab.url, patterns)) continue;

      // Read the entry only after the awaited tab lookup. A newer request may
      // replace the old one during that yield; capturing it beforehand could
      // abort the old controller and then accidentally delete the new entry.
      const running = inFlight.get(tabId);
      if (!running) continue;
      running.controller.abort();
      if (inFlight.get(tabId) === running) inFlight.delete(tabId);
      await browser.tabs.sendMessage(tabId, {
        error: {
          title: 'Blocked here',
          message: 'This site is now on your blocklist, so the analysis was stopped.',
        },
      }).catch(() => { /* page navigated away */ });
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => { void forgetTab(tabId); });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') void forgetTab(tabId);
  });

  // Process messages only from activated tabs
  browser.runtime.onMessage.addListener(async (request, sender) => {
    // The on-page launcher asking to start. Only our own content scripts can
    // send runtime messages (no externally_connectable), the launcher lives in
    // a closed shadow root, and it checks isTrusted — so a page cannot reach
    // this to trigger a paid call.
    if (request.activate) {
      // From a content script: the sender's own tab. From the popup (which is
      // not a tab) an explicit id, which is safe because only our own
      // extension pages can send runtime messages.
      const target = sender.tab?.id
        ? sender.tab
        : request.tabId
          ? await browser.tabs.get(request.tabId).catch(() => undefined)
          : undefined;
      // Reports what actually happened, so the launcher can drop its spinner
      // immediately on refusal instead of waiting out its safety timeout.
      const activated = target ? await activateContentScript(target) : false;
      return { activated };
    }

    if (!sender.tab?.id) return;   // nothing to answer to

    /**
     * Ends an analysis the page is already showing a spinner for.
     *
     * Every refusal below has to go through this. A bare `return` left the
     * spinner running for ever, which reads as a hang rather than as a reason
     * — and made a missing API key on a fresh install look identical to a slow
     * model. One accepted request, exactly one terminal outcome.
     */
    const refuse = async (tabId: number, title: string, message: string) => {
      console.log(`[Bubblener] ⊘ ${title}: ${message}`);
      await browser.tabs.sendMessage(tabId, { error: { title, message } })
        .catch(() => { /* page navigated away */ });
    };

    if (!request.text?.trim()) {
      return refuse(sender.tab.id, 'Nothing to analyse',
        'No readable text was found on the part of the page you are viewing.');
    }

    // Answered rather than ignored: an activation lost to a restarted service
    // worker lands here, and silence is indistinguishable from a hang.
    if (!(await isActivated(sender.tab.id))) {
      return refuse(sender.tab.id, 'Not active here',
        'Bubblener is no longer active on this tab. Start it again from the '
        + 'button on the page or from the extension popup.');
    }

    // Checked again on the way in, not just at activation. Blocking a site the
    // user already has open must stop it immediately — otherwise an activated
    // tab keeps sending until it happens to navigate.
    if (await isBlocked(sender.tab.url)) {
      inFlight.get(sender.tab.id)?.controller.abort();
      await removeActivatedTab(sender.tab.id);
      return refuse(sender.tab.id, 'Blocked here',
        'This site is on your blocklist, so nothing was read or sent. '
        + 'Remove it in the extension settings to analyse it.');
    }

    console.log('Received text from activated content script. Processing...');

    const currentModelAPI = await modelAPI.getValue();

    // Use the imported storage item to get the key. Ollama runs locally and
    // ignores the key entirely, so it must not be gated on one.
    const currentApiKey = await apiKey.getValue();
    if (!currentApiKey && currentModelAPI !== ModelAPIsEnum.Ollama) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'API Key Missing',
        message: 'Please set your API key in the extension options page.',
      });
      // Said on the page as well as in a notification: this is the first thing
      // a fresh install hits, and a notification is easy to miss entirely.
      return refuse(sender.tab.id, 'No API key',
        `Add your ${currentModelAPI} API key in the extension popup, or switch `
        + 'to Ollama to run a model locally without one.');
    }

    const maxElements = await maxNumberOfElements.getValue();
    const tier = await modelTier.getValue();
    const model = currentModelAPI === ModelAPIsEnum.Ollama
      ? (await ollamaModel.getValue()) || models[ModelAPIsEnum.Ollama][tier]
      : models[currentModelAPI][tier];

    const tabId = sender.tab.id;

    // The storage watcher can only abort requests that have entered inFlight.
    // Recheck after asynchronous provider/model preflight so a request that
    // passed the first check just before a blocklist write cannot slip through
    // and install itself after the watcher has already run.
    if (await isBlocked(sender.tab.url)) {
      inFlight.get(tabId)?.controller.abort();
      await removeActivatedTab(tabId);
      return refuse(tabId, 'Blocked here',
        'This site is on your blocklist, so nothing was read or sent. '
        + 'Remove it in the extension settings to analyse it.');
    }

    const requestId = ++nextRequestId;

    // Supersede whatever this tab was already waiting on.
    inFlight.get(tabId)?.controller.abort();
    const controller = new AbortController();
    inFlight.set(tabId, { id: requestId, controller });
    const isCurrent = () => inFlight.get(tabId)?.id === requestId;

    const stats = await timingStats.getValue();
    const estimate = estimateMs(stats, model, request.text.length);
    const startedAt = Date.now();

    logRequest(currentModelAPI, model, tier, request.text.length, estimate);

    // Tell the page what to expect so it can show progress rather than an
    // indeterminate spinner.
    if (sender.tab?.id) {
      browser.tabs.sendMessage(sender.tab.id, {
        requestId,
        started: { model, estimateMs: estimate },
      }).catch(() => { /* page may have navigated away */ });
    }

    try {
      // Push entities to the page the moment each one is complete, rather than
      // holding the whole set back until the model stops talking.
      let streamed = 0;
      const onPartial = (accumulated: string) => {
        const ready = extractStreamedEntities(accumulated);
        if (ready.length <= streamed || !sender.tab?.id) return;
        const fresh = ready.slice(streamed);
        streamed = ready.length;
        if (!isCurrent()) return;
        browser.tabs.sendMessage(sender.tab.id, {
          requestId,
          entities: { nodes: fresh, links: [] },
          streaming: true,
        }).catch(() => { /* page navigated away mid-stream */ });
      };

      const providerRequest = {
        signal: controller.signal,
        text: request.text, maxElements, apiKey: currentApiKey, model, onPartial,
      };

      let response: ProviderResponse | undefined;
      if (currentModelAPI === ModelAPIsEnum.ChatGPT) {
        response = await ChatGPTAPIRequest(providerRequest);
      } else if (currentModelAPI === ModelAPIsEnum.Gemini) {
        response = await GeminiAPIRequest(providerRequest);
      } else if (currentModelAPI === ModelAPIsEnum.DeepSeek) {
        response = await DeepSeekAPIRequest(providerRequest);
      } else if (currentModelAPI === ModelAPIsEnum.Ollama) {
        response = await OllamaAPIRequest(providerRequest);
      }

      if (!response) {
        throw new Error('No response text received from API.');
      }

      if (!isCurrent()) {
        console.log(`[Bubblener] ⊘ ${model} · answer arrived after the reader moved on`);
        return;
      }

      const durationMs = Date.now() - startedAt;
      // The full parse is still authoritative: it validates the whole payload
      // and repairs near-miss JSON the incremental scan skipped over.
      const entities = parseEntitiesResponse(response.text);
      logResponse(model, durationMs, response.usage, entities.length);

      await serializeStats(async () => {
        // Re-read inside the critical section. `stats` above was fetched
        // before the provider call — seconds ago, and another tab may have
        // recorded a sample since.
        const latestStats = await timingStats.getValue();
        await timingStats.setValue(
          recordSample(latestStats, model, request.text.length, response.usage.output, durationMs)
        );

        // Running total across every page, so the popup can show what the
        // user's own key has actually been spent on.
        const totals = await tokenUsage.getValue();
        await tokenUsage.setValue({
          input: totals.input + response.usage.input,
          output: totals.output + response.usage.output,
          calls: totals.calls + 1,
        });
      });

      if (sender.tab?.id) {
        await browser.tabs.sendMessage(sender.tab.id, {
          requestId,
          entities: { nodes: entities, links: [] },
          usage: response.usage,
          durationMs,
          complete: true,
        });
      }
    } catch (error: any) {
      // Cancelled because the reader scrolled on — not a failure to report.
      if (!isCurrent() || controller.signal.aborted) {
        console.log(`[Bubblener] ⊘ ${model} · superseded by a newer request`);
        return;
      }
      logFailure(model, Date.now() - startedAt, error);

      let errorMessage = 'An unknown error occurred while processing entities.';
      // Abort/timeout surfaces as an opaque SDK error; name it plainly.
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError'
        || /timed? ?out/i.test(error?.message ?? '')) {
        errorMessage = `The model did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. `
          + 'Try the Low tier, a smaller "Max Number of Elements", or another provider.';
      } else if (isBusyError(error)) {
        errorMessage = `${currentModelAPI} is busy right now — the model reported high demand `
          + 'or a rate limit. Nothing is wrong with your settings; try again in a moment, '
          + 'or switch tier or provider.';
      } else if (isNetworkError(error)) {
        // "Failed to fetch" is all the browser gives us — the request never
        // reached the provider. Say what that usually means for this provider
        // rather than passing the opaque message through.
        errorMessage = currentModelAPI === ModelAPIsEnum.Ollama
          ? 'Could not reach Ollama at localhost:11434. Check that "ollama serve" is running, '
            + 'and that OLLAMA_ORIGINS permits this extension — Ollama refuses unknown browser origins by default.'
          : `Could not reach ${currentModelAPI}. The request never left the browser: `
            + 'check your connection, VPN, or an ad/tracker blocker intercepting the API domain.';
      } else if (error?.message) {
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
            requestId,
            error: {
              title: 'Error',
              message: errorMessage
            }
          });
        } catch (msgError) {
          console.log('Could not send error message to content script:', msgError);
        }
      }
    } finally {
      // Only if it is still ours: a newer request for this tab has already
      // replaced the entry, and dropping that one would strand its controller.
      // Without this, every tab ever analysed left an AbortController behind.
      if (inFlight.get(tabId)?.id === requestId) inFlight.delete(tabId);
    }
  });
});
