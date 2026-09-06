import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import HighlightOverlay from './HighlightOverlay';
import defaults from '@/utils/constants/defaults';
import type Entity from '@/utils/types/Entity';

const rect = (left: number, top: number, width = 90, height = 18): DOMRect => ({
    left, top, width, height,
    right: left + width, bottom: top + height,
    x: left, y: top, toJSON() { return {}; },
}) as DOMRect;

const entity: Entity = {
    entity_name: 'Raskolnikov', entity_type: 'Person', mentions: ['Raskolnikov'],
    importance: 0.9, description: '', summary_from_text: '',
    contextual_enrichment: null,
};

/** A mention at x 300-390, with the bubble either side of the viewport. */
const BUBBLE_LEFT = rect(20, 40, 150, 24);
const BUBBLE_RIGHT = rect(830, 40, 150, 24);

const mentionRange = (rects: DOMRect[]) => ({
    getClientRects: () => rects as unknown as DOMRectList,
    getBoundingClientRect: () => rects[0]!,
}) as unknown as Range;

const renderOverlay = (bubblesOnLeft: boolean, bubble: DOMRect, rects: DOMRect[]) =>
    render(
        <HighlightOverlay
            entities={[entity]}
            mentions={[[mentionRange(rects)]]}
            colors={defaults.colorSettings}
            focused={0}
            getBubbleRect={() => bubble}
            onMentionFocus={() => { }}
            bubblesOnLeft={bubblesOnLeft}
        />
    );

/** The `M x y C ...` start point and final point of the connector path. */
const connector = (container: HTMLElement) => {
    const path = container.querySelector('path');
    const d = path?.getAttribute('d') ?? '';
    const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    return { startX: numbers[0]!, endX: numbers[numbers.length - 2]! };
};

beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});

describe('HighlightOverlay connectors', () => {
    it('runs from the right of the text to the left of a right-hand bubble', () => {
        const { container } = renderOverlay(false, BUBBLE_RIGHT, [rect(300, 100)]);

        const { startX, endX } = connector(container);
        expect(startX).toBeGreaterThanOrEqual(390);   // mention's right edge
        expect(endX).toBe(BUBBLE_RIGHT.left);
    });

    it('runs from the left of the text to the right of a left-hand bubble', () => {
        // Meeting the bubble's left edge here would send the line past the
        // bubble and back across the prose to reach its far side.
        const { container } = renderOverlay(true, BUBBLE_LEFT, [rect(300, 100)]);

        const { startX, endX } = connector(container);
        expect(startX).toBeLessThanOrEqual(300);      // mention's left edge
        expect(endX).toBe(BUBBLE_LEFT.right);
    });

    it('anchors a wrapped mention on the rect nearest the bubbles', () => {
        // A mention broken across two lines has two rects. Picking the far one
        // drags the connector back over the text it is pointing out of.
        const wrapped = [rect(600, 100, 60), rect(200, 120, 60)];

        const right = renderOverlay(false, BUBBLE_RIGHT, wrapped);
        expect(connector(right.container).startX).toBeGreaterThanOrEqual(660);
        right.unmount();

        const left = renderOverlay(true, BUBBLE_LEFT, wrapped);
        expect(connector(left.container).startX).toBeLessThanOrEqual(200);
    });
});
