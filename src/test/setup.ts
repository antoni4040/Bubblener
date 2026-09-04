import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetStorage } from './mockWxtStorage';
import { resetBrowser } from './mockBrowser';

afterEach(() => {
    cleanup();
    // Settings and captured messages must not leak from one test to the next.
    resetStorage();
    resetBrowser();
});

// jsdom doesn't implement matchMedia or ResizeObserver, both of which
// Mantine components rely on internally.
window.matchMedia = window.matchMedia || function (query: string) {
    return {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    } as unknown as MediaQueryList;
};

// jsdom has no layout engine, so Ranges cannot report geometry. Zero-sized
// rects are the honest answer here, and the code reads that as "position
// unknown" rather than "far away" — so nothing is wrongly retired.
const emptyRect = () => ({
    top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON() { return {}; },
}) as DOMRect;

if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = emptyRect;
}
if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function () {
        return Object.assign([], { item: () => null }) as unknown as DOMRectList;
    };
}

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || ResizeObserverStub;
