import showLauncher from '@/utils/storage/showLauncher';
import blockedSites from '@/utils/storage/blockedSites';
import { isSiteBlocked } from '@/utils/siteBlocking';
import bubblePosition from '@/utils/storage/bubblePosition';
import bubbleDistance from '@/utils/storage/bubbleDistance';
import themeStorage from '@/utils/storage/theme';
import themes from '@/utils/constants/themes';
import defaults from '@/utils/constants/defaults';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

/**
 * The discreet always-on launcher.
 *
 * Activation used to be reachable only through the right-click menu, which is
 * invisible: the toolbar icon opens settings, so the obvious first gesture
 * leads nowhere and the extension reads as broken.
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

        // A strong, solid colour from the theme. Painting the glyph white on
        // the accent gradient made it invisible on the light themes, where that
        // gradient is pale.
        const ink = preset.colorSettings.person.gradientStart;

        const style = document.createElement('style');
        style.textContent = `
            button {
                position: fixed;
                ${isTop ? 'top' : 'bottom'}: ${gap};
                ${isLeft ? 'left' : 'right'}: ${gap};
                z-index: 2147483000;
                width: 32px; height: 32px;
                display: grid; place-items: center;
                padding: 0; cursor: pointer;
                border-radius: ${preset.controlRadius === '50%' ? '50%' : preset.surfaceRadius};
                /* Its own opaque surface, so it reads on any page behind it. */
                background: ${preset.surfaceBackground};
                border: 1px solid ${preset.surfaceBorder};
                box-shadow: 0 1px 3px rgba(0,0,0,.18);
                /* Discreet until wanted, but never illegible. */
                opacity: .55;
                transition: opacity .18s ease, transform .18s ease;
            }
            button:hover, button:focus-visible { opacity: 1; transform: scale(1.08); }
            button:focus-visible { outline: 2px solid ${ink}; outline-offset: 2px; }
            svg { width: 18px; height: 18px; display: block; }
            @media (prefers-reduced-motion: reduce) { button { transition: none; } }
        `;

        const button = document.createElement('button');
        button.type = 'button';
        button.title = 'Analyse this page with Bubblener';
        button.setAttribute('aria-label', 'Analyse this page with Bubblener');
        // Filled discs: an outline this fine disappears at 18px.
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="${ink}">
            <circle cx="8.5" cy="14.5" r="5.5"/>
            <circle cx="16.5" cy="7.5" r="3.5"/>
            <circle cx="18.5" cy="16" r="2"/></svg>`;

        button.addEventListener('click', async (event) => {
            // A page can neither reach a closed shadow root nor forge a trusted
            // event, so this stays a genuine user gesture.
            if (!event.isTrusted) return;
            button.disabled = true;
            button.style.opacity = '1';
            await browser.runtime.sendMessage({ activate: true }).catch(() => { });
            host.remove();
        });

        shadow.append(style, button);
        document.body.append(host);

        // Once the analysis UI is up, the launcher has done its job.
        const observer = new MutationObserver(() => {
            if (document.querySelector('entity-bubbles-ui')) {
                host.remove();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    },
});
