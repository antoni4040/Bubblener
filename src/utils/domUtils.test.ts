import { beforeEach, describe, expect, it } from 'vitest';
import getVisibleTextOnScreen from '@/utils/domUtils';

// jsdom has no layout engine, so `innerText` (which domUtils.ts relies on)
// is unimplemented there. Approximate it with textContent for these tests.
beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        get() {
            return this.textContent;
        },
        configurable: true,
    });
    document.body.innerHTML = '';
});

const mockRect = (el: Element, rect: Partial<DOMRect>) => {
    (el as HTMLElement).getBoundingClientRect = () => ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {},
        ...rect,
    });
};

describe('getVisibleTextOnScreen', () => {
    it('prefers <article> over any other priority selector', () => {
        document.body.innerHTML = `
            <main>Main content</main>
            <article>Article content</article>
        `;
        expect(getVisibleTextOnScreen()).toBe('Article content');
    });

    it('falls back to <main> when no <article> is present', () => {
        document.body.innerHTML = `
            <div id="content">Generic content div</div>
            <main>Main content</main>
        `;
        expect(getVisibleTextOnScreen()).toBe('Main content');
    });

    it('falls back to [role="main"] when no <article> or <main> is present', () => {
        document.body.innerHTML = `
            <div id="content">Generic content div</div>
            <div role="main">Role main content</div>
        `;
        expect(getVisibleTextOnScreen()).toBe('Role main content');
    });

    it('falls back to generic visible-element extraction when no priority container exists', () => {
        document.body.innerHTML = `
            <p id="visible">Visible paragraph</p>
            <p id="hidden" style="display: none;">Hidden paragraph</p>
            <p id="offscreen">Offscreen paragraph</p>
        `;

        mockRect(document.getElementById('visible')!, { top: 10, bottom: 30, left: 10, right: 100, width: 90, height: 20 });
        mockRect(document.getElementById('hidden')!, { top: 10, bottom: 30, left: 10, right: 100, width: 90, height: 20 });
        mockRect(document.getElementById('offscreen')!, { top: 5000, bottom: 5020, left: 10, right: 100, width: 90, height: 20 });

        const text = getVisibleTextOnScreen();
        expect(text).toContain('Visible paragraph');
        expect(text).not.toContain('Hidden paragraph');
        expect(text).not.toContain('Offscreen paragraph');
    });

    it('excludes elements with zero dimensions from the generic fallback', () => {
        document.body.innerHTML = `<p id="collapsed">Collapsed paragraph</p>`;
        mockRect(document.getElementById('collapsed')!, { top: 10, bottom: 10, left: 10, right: 10, width: 0, height: 0 });

        expect(getVisibleTextOnScreen()).not.toContain('Collapsed paragraph');
    });
});
