# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bubblener: a browser extension that runs Named-Entity Recognition over the page you're reading and
floats the entities as interactive bubbles on top of it. React 19 + Mantine 8, built with WXT
(Vite under the hood), targeting Chrome MV3 and Firefox from one codebase.

Bring-your-own-key by design: the user's own API key talks to Gemini, ChatGPT or DeepSeek directly
from the extension, or to Ollama on localhost with no key at all. There is no backend and no middle
party — which is also why the key handling in the popup has rules (see below).

## Commands

```bash
npm run dev              # Chrome dev build + auto-reload
npm run dev:firefox

npm run compile          # tsc --noEmit — run this before declaring anything done
npm test                 # Vitest unit suite (241 tests / 24 files, ~50s)
npm run test:watch
npm run test:coverage    # v8 coverage; components + utils, entrypoints excluded

npm run test:e2e         # Playwright, real Chrome with the extension loaded
                         # `pretest:e2e` runs `wxt build` first — don't skip it,
                         # Playwright loads .output/chrome-mv3, not source

npm run test:live        # real provider calls — opt-in, needs keys, costs ~a cent
npm run build            # or build:firefox → .output/<target>/
npm run zip              # store-ready archive
```

### Live provider tests

The unit suite mocks all four SDKs, so it verifies what we *send* and can never
observe what a provider *accepts*. Every API break this project has hit was
invisible to it: a thinking parameter Gemini 3.x rejected, a model id retired
out from under us, a response schema that made `null` unrepresentable, a
streaming body that parsed as empty. `npm run test:live` is the suite that
catches those.

```bash
cp .env.example .env.local   # gitignored; never commit real keys
# fill in whichever providers you want, then:
npm run test:live
```

**Providers are independent — one key is enough.** Each suite skips itself when
its variable is absent, and every run prints which providers are enabled and
which are skipped before calling anything:

```
  Gemini    skipped  — set BUBBLENER_GEMINI_KEY to include it
  DeepSeek  enabled  — BUBBLENER_DEEPSEEK_KEY is set
```

Variables are `BUBBLENER_GEMINI_KEY`, `BUBBLENER_OPENAI_KEY`,
`BUBBLENER_DEEPSEEK_KEY`, and `BUBBLENER_OLLAMA=1` (no key — needs
`ollama serve`, likely with `OLLAMA_ORIGINS='chrome-extension://*'`).
`.env.example` documents where to get each one.

Running it with **nothing** configured fails deliberately, rather than
reporting "16 skipped", which reads exactly like a pass. Keys are read for
presence only and never logged; the extension itself always takes its key from
browser storage and never reads these files.

One seam does get checked offline: `schemaFormat.test.ts` runs the real
`zodTextFormat(EntitiesSchema, ...)` and asserts the JSON Schema ChatGPT is
actually constrained by — strictness, the required fields, the entity-type
enum, and that `contextual_enrichment` stays `["string", "null"]`. No network,
no key, and it is the one place a Zod or OpenAI major that reshaped that schema
would show up before a real call failed.

Live tests are `*.live.test.ts` and are excluded from `vitest.config.ts`, so
`npm test` and CI stay offline and free. They run only through
`vitest.live.config.ts`.

`npm install` runs `wxt prepare`, which generates `.wxt/` — **`tsconfig.json` extends
`./.wxt/tsconfig.json`, so without it both `tsc` and Vitest fail to resolve anything.** `.wxt/` is
gitignored; if a fresh clone won't typecheck, run `npx wxt prepare` before debugging anything else.

`npm test` and `npm run test:e2e` touch no network and no real API: the four provider SDKs are mocked
in unit tests and the provider endpoints are intercepted with `context.route()` in e2e — no key
required, nothing billable. `npm run test:live` is the deliberate exception, described above.

## Architecture

Three entrypoints, one message hop between them:

```
popup/          settings UI. Writes storage. Never reads the API key back out.
content.tsx     shadow-root React app: extract visible text → send → render bubbles
background.ts   the only place that holds the API key and calls a provider
```

The content script never sees the key. It sends `{ text }`; the background script picks the provider,
calls it, and sends back `{ entities }` or `{ error }`.

| File | What it decides |
|---|---|
| `entrypoints/background.ts` | Activation, tab gating, provider dispatch, error shaping |
| `utils/promptUtils.ts` | The NER prompt and each provider's request shape |
| `utils/parseEntitiesResponse.ts` | Turning whatever the model returned into `Entity[]`, or throwing |
| `utils/domUtils.ts` | Which text on the page gets sent |
| `components/BubblesContainer.tsx` | Settings load, scroll re-extraction, theme → CSS variables |
| `utils/constants/themes.ts` | Every visual decision, per theme |

### Every accepted request gets exactly one terminal outcome

`onMessage` must never return silently once the page is showing a spinner. Each
refusal goes through the local `refuse()` helper — no usable text, not active
here, blocked here, no API key — because a bare `return` left the spinner
running for ever, which reads as a hang rather than as a reason. On a fresh
install with no key that was the very first thing a user hit.

`BubblesContainer` also arms a 120s watchdog per request, cleared wherever
loading ends. That covers the one case no message can: an MV3 service worker
terminated mid-request, which answers nothing at all.

### Activation is opt-in, per tab

Bubblener does nothing until the user activates it, from the on-page launcher or the popup's
"Analyse this page" (the toolbar icon opens the settings popup instead). There is deliberately no
context-menu entry any more, and no `contextMenus` permission.

**Activated tabs live in `session:` storage, not in a `Set`.** Chrome routinely terminates an idle
MV3 service worker; in-memory state dies with it while the injected content script keeps running
and keeps sending, so the tab looked deactivated for no visible reason. Session storage outlives
the worker, is cleared when the browser closes — the lifetime we want — and never touches disk.
**Don't move this back into memory.**

`forgetTab` (tab closed, or navigated) aborts the in-flight controller and deletes the `inFlight`
entry as well as clearing activation. Dropping activation alone let a provider request run on
after the reader had gone, and — because the tab id survives navigation — let a late answer from
the previous page reach the next one.

`activateContentScript` injects the content script and records the tab; **`onMessage` ignores text
from any tab that is not recorded** (`isActivated`), so an arbitrary page can't trigger a paid API
call. Keep that check if you touch the message handler — it now answers rather than returning
silently, because an activation lost to a restarted worker lands there too.

Storage read-modify-writes go through `utils/serialize.ts`. Several tabs share one worker, and
token totals and timing samples are read-modify-write against storage: without it the later of two
concurrent analyses simply erased the earlier one's numbers.

### The blocklist is enforced in the background, twice

`blockedSites` is a privacy control, so `utils/siteBlocking.ts` is consulted in
`background.ts` at **activation** *and* again in `onMessage` before any text is
dispatched. The second check is not redundant: blocking a site the user already
has open has to stop it immediately, and without it an already-activated tab
keeps sending until it happens to navigate. The launcher also hides itself on a
blocked site, but that is cosmetic only — **never make hiding the button the
enforcement.**

Patterns are hostnames, never user-supplied regex (ReDoS, and unauthorable). A
bare `example.com` deliberately covers subdomains: for a privacy control the
surprising direction should be the safe one. `*.example.com` is accepted as a
synonym. The blocklist is saved on click rather than staged behind **Save**, and
`handleResetAll` deliberately leaves it alone.

MV2 and MV3 script injection are both handled (`browser.scripting` / `browser.tabs.executeScript`)
because Firefox and Chrome don't agree.

### Storage: one item per setting, `local:` for everything the user owns

`apiKey`, `modelAPI`, `modelTier`, `ollamaModel`, `theme`, `bubbleColors`, `bubblePosition`,
`bubbleDistance`, `bubbleSize`, `bubbleTransparency`, `textHighlighting`, `pixelDistance`,
`maxNumberOfElements`, `maxNumberOfCharacters`, `tokenUsage`, `timingStats`, `starredEntities`,
`hiddenEntities`, `blockedSites` — each a `storage.defineItem` module under `utils/storage/`. `local:`, never
`sync:`, so the key is never uploaded to a browser account.

The one exception is `session:activatedTabs` in `background.ts`, which is runtime state rather than
a setting: it must outlive a terminated service worker but not the browser session, and it must not
be written to disk. See *Activation is opt-in, per tab* above.

`BubblesContainer` re-reads settings on `storage.onChanged`, so the popup's Save updates live pages
without a reload. **Add new settings to that listener's key check or they won't apply until reload.**

### Themes change shape, not just color

A theme is a `ThemePreset` (`utils/types/ThemePreset.ts`): color scheme, primary palette, font,
surface tokens, `dangerColor`, and a `bubble` block carrying radius / shadow / border / weight /
tracking / text-transform. Library is 3px corners with no shadow and small-caps Baskerville;
Cyberpunk is 0px corners with a phosphor bloom instead of a shadow. Changing only the colors of a
theme is how they end up looking like recolors of each other.

Two rules that are easy to break:

- **The Mantine theme (primary color, font, color scheme) must live *above* `MantineProvider`.**
  That's why `popup/PopupRoot.tsx` exists: `App` reports its selection upward via `onThemeChange`
  and `PopupRoot` rebuilds the provider. Setting `primaryColor` inside a static provider silently
  does nothing.
- **Bubble palette and `theme` are saved together.** Picking a theme stages
  `themes[t].colorSettings` into the color pickers; Save writes both. Per-entity pickers then
  override the preset — the theme is a starting point, not a lock.

## Known sharp edges

Each of these cost real debugging time here.

- **Mantine's color-scheme attribute lives on `<html>`, outside the content script's shadow root.**
  Mantine components in there (Modal, Popover, Badge) therefore ignore the color scheme and fall
  back to defaults — this shipped once as a black-on-dark-grey unreadable modal while the bubbles
  looked fine. The theme reaches them by setting `--mantine-color-*`, `--mantine-radius-*` and the
  font vars on the wrapper `<div>` in `BubblesContainer`, plus explicit `color` on modal text.
  Anything relying on scheme-derived inheritance inside the shadow root will look wrong.
- **`public/` is copied verbatim into the shipped extension.** Anything dropped
  in there is published to users and counted in the store bundle — README
  screenshots belong in `docs/`, not `public/`. Only the four icons are needed.
- **Node >= 22 is required** by vitest 5, wxt 0.21 and openai 7; CI pins it.
- **`scripting` must stay in `wxt.config.ts` permissions.** Without it `browser.scripting` is
  `undefined`, activation dies with "No script injection method available", and the failure is a
  console log plus a generic notification — the extension just silently does nothing.
- **Only Gemini and ChatGPT get schema-enforced JSON.** DeepSeek is prompt-instructed
  (`createPrompt(..., withJson: true)`), so it's the one that returns fenced or wrapped JSON.
  `parseEntitiesResponse` is the safety net: it strips fences, accepts a bare array *or*
  `{entities: [...]}`, and Zod-validates every entity. Don't `JSON.parse` a model response directly.
- **Playwright can't load an extension headless** — `fixtures.ts` uses
  `launchPersistentContext` with `headless: false`. CI must wrap it (`xvfb-run`, as
  `.github/workflows/ci.yml` does).
- **The launcher is a closed shadow root, so it cannot be tested by selector.** Only its host
  (`<bubblener-launcher>`) is in the light DOM; the wedge inside is unreachable to
  `page.locator`. The e2e test therefore clicks it by real coordinates, which is also the only
  thing that verifies it is actually hittable where the CSS puts it. Its geometry lives in the
  `COLLAPSED` / `EXPANDED` / `TALL` constants — change those and the coordinates in that test
  have to move with them. It is rounded in **every** theme, Cyberpunk included: it sits on top of
  someone else's page, and the soft edge is what keeps it reading as ours.
- **`npx playwright test` skips the build.** Only `npm run test:e2e` runs `pretest:e2e`, so calling
  Playwright directly tests whatever is already in `.output/`. A new background feature will look
  broken when the bundle simply predates it — this has already cost one wrong diagnosis.
- **Playwright can't reach the launcher by selector** (closed shadow root), so tests call
  `__bubblenerTestActivate`, exposed on the service worker's global scope in `background.ts`. Keep
  that export if you refactor activation.
- **Browsers normalize hex to `rgb()`** in the `style` attribute — e2e color assertions must expect
  `rgb(214, 143, 34)`, not `#d68f22`.
- **`browser.action.onClicked` never fires**, because the manifest sets `default_popup` — the click
  opens the popup instead. `handleBrowserActionClick` in `background.ts` is therefore unreachable
  today; leave it or delete it, but don't debug it expecting the toolbar icon to activate a page.
- **Vitest's default glob picks up `e2e/*.spec.ts`** and dies on Playwright's `test()`. `e2e/**` is
  excluded in `vitest.config.ts`; keep it that way when adding test globs.
- **Vitest does not auto-run Testing Library's cleanup** the way Jest does. `src/test/setup.ts`
  registers `afterEach(cleanup)`; without it, DOM leaks between tests in the same file and
  `getByText` starts finding several matches.
- **jsdom implements neither `innerText`, `matchMedia`, nor `ResizeObserver`** — all three are
  shimmed (`src/test/setup.ts`, and a local `innerText` shim in `domUtils.test.ts`, since jsdom has
  no layout engine and `getVisibleTextOnScreen` is built on `innerText` + `getBoundingClientRect`).
- **WXT's `storage` global is injected at build time and doesn't exist under plain Vitest.**
  `src/test/mockWxtStorage.ts` provides an in-memory stand-in, which is what makes anything built on
  `storage.defineItem` unit-testable.

## API key handling — treat as invariants

The popup **must never load the stored key into React state or render it into the DOM.** It reads
only whether a key exists, shows a green "Key saved" line plus a *Change Key* button, and any typed
replacement goes into a separate draft. There is nothing to copy out of the settings UI, and
`popup/App.test.tsx` asserts the key string never appears in `document.body.innerHTML`.

Saving is guarded by `apiKeyDirty`: **an unrelated settings save must not touch the stored key.**
Only typing a replacement or hitting reset marks it dirty. Dropping that guard silently wipes
people's keys when they change an unrelated setting.

**Export and import must not become a hole in that.** `utils/settingsTransfer.ts`
works from an allowlist (`SETTING_SCHEMAS`), and `apiKey` is simply not in it —
so the key cannot travel in either direction, including when someone hand-edits
it into a JSON file. `tokenUsage`/`timingStats` are excluded too, as
machine-local history. An imported file is untrusted input: every field is
Zod-validated on its own and a bad one is skipped rather than aborting the
import, the same per-item approach `parseEntitiesResponse` takes. Settings
always replace; for the starred/hidden lists the user picks *Add* or *Replace*
after seeing both counts, and nothing is written until they do — replacing can
destroy curated lists, so it must never be a silent default. A file with no
entities skips the question. `storage/exportableSettings.ts` is
`satisfies Record<SettingKey, …>`, so the storage map and the allowlist cannot
drift apart without failing `tsc`.

What this does *not* protect against, so don't claim otherwise: `chrome.storage.local` is plaintext
on disk, readable by anything with filesystem access to the browser profile or an unlocked DevTools
window. Extensions have no access to OS keychains — that requires a native companion app over Native
Messaging, which this project deliberately doesn't ship.
