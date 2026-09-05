# Roadmap

Short notes on what's next and, more importantly, *why* — so the reasoning
behind each decision survives longer than the conversation it came from.

## 1. Site blocklist — done

Never analyse, and never show the launcher, on named sites.

Two separate things, and the second is the one that matters:

- **Hide the launcher** on a site — cosmetic.
- **Refuse to analyse** a site — privacy. Banking, webmail, internal tools.

Decisions taken:

- **Enforced in `background.ts`, not only in the UI.** The background is the
  only gatekeeper — the same reason the `activatedTabs` check exists. A
  blocklist that merely hides a button is theatre.
- **Hostname globs, never user-supplied regex.** Regex from a text box is a
  ReDoS foot-gun and painful to author.
- A bare `example.com` blocks its subdomains too. For a privacy feature the
  surprising direction should be the safe one: nobody who blocks `example.com`
  wants `mail.example.com` sent to a model.
- A one-click **"Never on this site"** matters more than the text box. A list
  of URL patterns is a thing people configure zero times.

## 2. Import / export

The sync story we deliberately don't have. Storage is `local:`, never `sync:`,
so the key never reaches a browser account — the price is that a new machine
means re-entering every setting and losing every starred entity.

- **Export must exclude `apiKey`,** and import must ignore an `apiKey` field
  even if a hand-edited file carries one. The popup's whole invariant is that
  the key cannot be read back out; an export that dumps it to `~/Downloads`
  in plaintext undoes that in one line.
- An imported file is untrusted input → validate with Zod rather than writing
  whatever it contains into storage.
- `tokenUsage` / `timingStats` are machine-local history, not settings.
  Exclude, or put behind their own checkbox.
- Belongs on the Library page rather than the popup: it's already a full page,
  and the starred/hidden lists are half of what you'd export.

## 3. Settings sync via the browser account

Free, no backend (`storage.sync`). A single opt-in toggle, default off.
**Settings only** — the quotas decide the rest:

| Limit (Chrome; Firefox is similar) | |
|---|---|
| Total | 100 KB |
| **Per item** | **8 KB** |
| Writes | 120/min, 1,800/hour |

- **`apiKey` never syncs.** Without a user-set sync passphrase the browser
  vendor holds the keys — exactly the middle party this extension doesn't have.
- **`tokenUsage` / `timingStats` never sync.** Written on every request; they'd
  burn the write quota, and per-machine totals are the sensible thing anyway.
- **`starredEntities` / `hiddenEntities` don't fit.** `SavedEntity extends
  Entity`, so each carries a summary and enrichment — roughly 1 KB apiece
  against an 8 KB *per-item* ceiling for the whole map. And `storage.sync` is
  last-write-wins per key with no merge, so two machines would silently erase
  each other's lists. This is why sync and import/export are complements, not
  alternatives.

Two prerequisites:

- `storage.defineItem('local:theme')` bakes the area in at module load, so a
  runtime toggle can't just flip a prefix. Needs a wrapper that prefers sync
  when enabled — and `BubblesContainer`'s `storage.onChanged` listener filters
  on key names, so it would have to watch the sync area too.
- **Firefox needs `browser_specific_settings.gecko.id`** in `wxt.config.ts`.
  Without it `storage.sync` is a silent no-op — it doesn't error, it just
  never syncs.

## 4. Smaller things

- **Keyboard access to the bubbles.** They're `<div onClick>` with no `role`,
  `tabIndex` or key handler, so they can't be reached without a mouse.
- **Draggable launcher.** Note it currently has no position of its own — it
  reads `bubblePosition`/`bubbleDistance` and shares corners with the bubbles,
  so this needs a new setting or it moves both. Snap-to-corner is a fraction of
  the work of free positioning and most of the benefit.
- **Firefox has never actually been verified**, despite the README and
  `CLAUDE.md` describing it as supported. The build works; nobody has loaded it.
- **Trim the prompt.** ~991 tokens, about 95% of a typical request's input.
