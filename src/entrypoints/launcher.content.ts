import showLauncher from '@/utils/storage/showLauncher';
import blockedSites from '@/utils/storage/blockedSites';
import { isSiteBlocked } from '@/utils/siteBlocking';
import bubblePosition from '@/utils/storage/bubblePosition';
import bubbleDistance from '@/utils/storage/bubbleDistance';
import themeStorage from '@/utils/storage/theme';
import themes from '@/utils/constants/themes';
import defaults from '@/utils/constants/defaults';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';
import {
    EDGE_COLLAPSED, EDGE_GAP, EDGE_GLYPH, EDGE_PADDING, EDGE_TALL, edgeExpanded,
} from '@/utils/constants/edgeButton';

const LABEL_IDLE = 'Analyse';
const LABEL_BUSY = 'Working…';
// Sized to the wider of the two labels, so the button does not resize when it
// swaps them mid-click.
const EXPANDED = Math.max(edgeExpanded(LABEL_IDLE), edgeExpanded(LABEL_BUSY));
/** Long enough that a slow provider still reads as working, short enough that a
 *  failed activation does not spin for ever — the bug this project already hit
 *  once, where a stuck spinner read as a hang rather than an error. */
const BUSY_GIVE_UP_MS = 20_000;

/**
 * The discreet always-on launcher.
 *
 * Activation used to be reachable only through a right-click menu entry, which
 * is invisible: the toolbar icon opens settings, so the obvious first gesture
 * led nowhere and the extension read as broken. This replaced it outright —
 * the menu entry, and the `contextMenus` permission, are gone.
 *
 * Deliberately vanilla and tiny. The main content script carries React and
 * Mantine — about 360KB — and this one runs on every page the user visits, so
 * it must not import any of that.
 */
export default defineContentScript({
    matches: ['*://*/*'],
    runAt: 'document_idle',
    async main() {
        if (window.top !== window) return;              // not in every iframe
        if (!(await showLauncher.getValue())) return;
        // Cosmetic only — the background refuses blocked sites regardless.
        // Offering a button that cannot work would read as a broken extension.
        if (isSiteBlocked(location.href, await blockedSites.getValue())) return;

        const [position, distance, theme] = await Promise.all([
            bubblePosition.getValue(),
            bubbleDistance.getValue(),
            themeStorage.getValue(),
        ]);
        const preset = themes[theme ?? defaults.theme];
        const spot = position ?? defaults.position;
        const gap = `${distance ?? defaults.bubbleDistance}px`;
        const isTop = spot === BubblePositionEnum.TopLeft || spot === BubblePositionEnum.TopRight;
        const isLeft = spot === BubblePositionEnum.TopLeft || spot === BubblePositionEnum.BottomLeft;

        const host = document.createElement('bubblener-launcher');
        // Closed: the page cannot reach in to find or synthesise a click on it.
        const shadow = host.attachShadow({ mode: 'closed' });

        // The wedge itself is painted in a strong, solid theme colour, and the
        // glyph in the theme's surface colour on top of it. That inversion is
        // deliberate: the glyph used to be drawn in this colour *on* the
        // surface, and on the pale themes it disappeared.
        const ink = preset.colorSettings.person.gradientStart;

        // Rounded on the inner side in every theme, Cyberpunk included. The
        // themes deliberately change shape elsewhere, but this one sits on top
        // of somebody else's page: the soft edge is what keeps it reading as
        // ours rather than as part of whatever is underneath.
        const corners = isLeft ? '0 999px 999px 0' : '999px 0 0 999px';

        // Opening it, the glyph travels *away* from the edge and the label
        // takes the space behind it. On the right that reads left-to-right as
        // "◐ Analyse"; on the left it mirrors, so the label is always on the
        // edge side and the glyph always leads into the page.
        const flow = isLeft ? 'row-reverse' : 'row';

        const style = document.createElement('style');
        style.textContent = `
            button {
                position: fixed;
                ${isTop ? 'top' : 'bottom'}: ${gap};
                /* Flush to the edge — the whole idea is that it is hiding. */
                ${isLeft ? 'left' : 'right'}: 0;
                z-index: 2147483000;
                width: ${EDGE_COLLAPSED}px; height: ${EDGE_TALL}px;
                box-sizing: border-box;
                display: flex; flex-direction: ${flow};
                align-items: center; gap: ${EDGE_GAP}px;
                padding: 0 ${EDGE_PADDING}px;
                cursor: pointer;
                border: none;
                /* The label is wider than the resting button, so it is clipped
                   rather than allowed to spill across the page. */
                overflow: hidden;
                border-radius: ${corners};
                /* Solid, never translucent: small enough to stay out of the
                   way, opaque enough to never read as a rendering artefact. */
                background: ${ink};
                box-shadow: 0 2px 6px rgba(0,0,0,.28);
                /* Width alone animates, so it leans out rather than inflating. */
                transition: width .2s cubic-bezier(.2,.7,.3,1);
            }
            button:hover, button:focus-visible, button[data-busy="true"] {
                width: ${EXPANDED}px;
            }
            button:focus-visible {
                /* Inset: an outer ring on a flush element is clipped by the
                   viewport edge and only half of it would ever be visible. */
                outline: 2px solid ${preset.surfaceBackground};
                outline-offset: -4px;
            }

            svg, .spin {
                width: ${EDGE_GLYPH}px; height: ${EDGE_GLYPH}px; display: block; flex: none;
            }

            .label {
                font: 600 13px ${preset.fontFamily};
                letter-spacing: .01em;
                color: ${preset.surfaceBackground};
                white-space: nowrap;
                opacity: 0;
                transition: opacity .12s ease;
            }
            button:hover .label,
            button:focus-visible .label,
            button[data-busy="true"] .label { opacity: 1; }

            /* Swapped for the glyph while an analysis is being asked for, so
               the click has visible consequences before the page UI arrives. */
            .spin {
                display: none;
                border-radius: 50%;
                border: 2px solid ${preset.surfaceBackground}59;
                border-top-color: ${preset.surfaceBackground};
                box-sizing: border-box;
                animation: turn .7s linear infinite;
            }
            button[data-busy="true"] .spin { display: block; }
            button[data-busy="true"] svg { display: none; }
            @keyframes turn { to { transform: rotate(360deg); } }

            @media (prefers-reduced-motion: reduce) {
                /* The spinner keeps turning: it is the only signal that
                   anything is happening, and a frozen one says the opposite. */
                button, .label { transition: none; }
            }
        `;

        const button = document.createElement('button');
        button.type = 'button';
        button.title = 'Analyse this page with Bubblener';
        button.setAttribute('aria-label', 'Analyse this page with Bubblener');
        // Filled discs: an outline this fine disappears at 16px.
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="${preset.surfaceBackground}">
                <circle cx="8.5" cy="14.5" r="5.5"/>
                <circle cx="16.5" cy="7.5" r="3.5"/>
                <circle cx="18.5" cy="16" r="2"/></svg>
            <span class="spin"></span>
            <span class="label">${LABEL_IDLE}</span>`;

        const label = button.querySelector('.label')!;

        const setBusy = (busy: boolean) => {
            button.dataset.busy = String(busy);
            button.disabled = busy;
            button.setAttribute('aria-busy', String(busy));
            label.textContent = busy ? LABEL_BUSY : LABEL_IDLE;
        };

        button.addEventListener('click', async (event) => {
            // A page can neither reach a closed shadow root nor forge a trusted
            // event, so this stays a genuine user gesture.
            if (!event.isTrusted || button.disabled) return;

            setBusy(true);

            // The MutationObserver below ends the spinner in the normal case,
            // by removing the launcher entirely. Nothing ends it if activation
            // reports success but the UI never mounts — and an endless spinner
            // is worse than none, because it reads as a hang rather than a
            // failure. Give up visibly instead, and let the user try again.
            const giveUp = setTimeout(() => setBusy(false), BUSY_GIVE_UP_MS);

            // Deliberately *not* removed here. The gap between the click and
            // the analysis UI mounting is exactly where the extension used to
            // look like it had done nothing at all.
            const failed = await browser.runtime.sendMessage({ activate: true })
                .then((reply: any) => !reply?.activated).catch(() => true);

            // Refused outright — blocked site, unsupported page, no injection
            // method. Hand the button straight back rather than spin at them.
            if (failed) {
                clearTimeout(giveUp);
                setBusy(false);
            }
        });

        shadow.append(style, button);
        document.body.append(host);

        // Once the analysis UI is up, the launcher has done its job — and that
        // is also what ends the spinner in the normal case.
        const observer = new MutationObserver(() => {
            if (document.querySelector('entity-bubbles-ui')) {
                host.remove();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });

    },
});
