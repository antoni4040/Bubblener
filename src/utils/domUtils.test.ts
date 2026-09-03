import { beforeEach, describe, expect, it } from 'vitest';
import getVisibleTextOnScreen, { getContentRoot } from '@/utils/domUtils';

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

const ON_SCREEN = { top: 10, bottom: 30, left: 10, right: 100, width: 90, height: 20 };
const BELOW_FOLD = { top: 5000, bottom: 5020, left: 10, right: 100, width: 90, height: 20 };

const place = (selector: string, rect: Partial<DOMRect>) => {
    const element = document.querySelector(selector) as HTMLElement;
    element.getBoundingClientRect = () => ({
        x: 0, y: 0, toJSON() {}, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0,
        ...rect,
    });
};

describe('getContentRoot', () => {
    it('prefers <article> over any other priority container', () => {
        document.body.innerHTML = '<main>Main</main><article>Article</article>';
        expect(getContentRoot().tagName).toBe('ARTICLE');
    });

    it('falls back through <main> and [role="main"]', () => {
        document.body.innerHTML = '<div id="content">Generic</div><main>Main</main>';
        expect(getContentRoot().tagName).toBe('MAIN');

        document.body.innerHTML = '<div id="content">Generic</div><div role="main">Role</div>';
        expect(getContentRoot().getAttribute('role')).toBe('main');
    });

    it('falls back to <body> when nothing matches', () => {
        document.body.innerHTML = '<div>Loose text</div>';
        expect(getContentRoot()).toBe(document.body);
    });
});

describe('getVisibleTextOnScreen', () => {
    it('reads only the blocks currently on screen, not the whole article', () => {
        document.body.innerHTML = `
            <article>
                <p id="seen">Visible paragraph</p>
                <p id="unseen">Paragraph far below the fold</p>
            </article>
        `;
        place('#seen', ON_SCREEN);
        place('#unseen', BELOW_FOLD);

        const text = getVisibleTextOnScreen();
        expect(text).toContain('Visible paragraph');
        expect(text).not.toContain('far below the fold');
    });

    it('changes as the viewport moves, so scrolling yields new content', () => {
        document.body.innerHTML = `
            <article>
                <p id="a">First section</p>
                <p id="b">Second section</p>
            </article>
        `;
        place('#a', ON_SCREEN);
        place('#b', BELOW_FOLD);
        expect(getVisibleTextOnScreen()).toBe('First section');

        // Scroll: the second paragraph comes into view, the first leaves.
        place('#a', { top: -400, bottom: -380, left: 10, right: 100, width: 90, height: 20 });
        place('#b', ON_SCREEN);
        expect(getVisibleTextOnScreen()).toBe('Second section');
    });

    it('ignores content outside the main container', () => {
        document.body.innerHTML = `
            <nav><p id="nav">Navigation junk</p></nav>
            <article><p id="body">Real content</p></article>
        `;
        place('#nav', ON_SCREEN);
        place('#body', ON_SCREEN);

        expect(getVisibleTextOnScreen()).toBe('Real content');
    });

    it('does not double-count text from nested blocks', () => {
        document.body.innerHTML = `
            <article>
                <li id="item">Outer <p id="inner">inner text</p></li>
            </article>
        `;
        place('#item', ON_SCREEN);
        place('#inner', ON_SCREEN);

        expect(getVisibleTextOnScreen().match(/inner text/g)).toHaveLength(1);
    });

    it('skips hidden and zero-sized blocks', () => {
        document.body.innerHTML = `
            <article>
                <p id="shown">Shown</p>
                <p id="hidden" style="display: none;">Hidden</p>
                <p id="collapsed">Collapsed</p>
            </article>
        `;
        place('#shown', ON_SCREEN);
        place('#hidden', ON_SCREEN);
        place('#collapsed', { top: 10, bottom: 10, left: 10, right: 10, width: 0, height: 0 });

        const text = getVisibleTextOnScreen();
        expect(text).toContain('Shown');
        expect(text).not.toContain('Hidden');
        expect(text).not.toContain('Collapsed');
    });

    it('falls back to the whole root when no block is measurable', () => {
        document.body.innerHTML = '<article>Bare text with no block children</article>';
        expect(getVisibleTextOnScreen()).toBe('Bare text with no block children');
    });
});
