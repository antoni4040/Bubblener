import { describe, expect, it } from 'vitest';
import { nearestViewportDistance, isWithinReach, MeasuredRect } from '@/utils/entityDistance';

const VIEWPORT = 800;
const at = (top: number, height = 20): MeasuredRect =>
    ({ top, bottom: top + height, width: 100, height });

describe('nearestViewportDistance', () => {
    it('is zero for a mention on screen', () => {
        expect(nearestViewportDistance([at(400)], VIEWPORT)).toBe(0);
    });

    it('measures how far above the viewport a mention has scrolled', () => {
        expect(nearestViewportDistance([at(-1020)], VIEWPORT)).toBe(1000);
    });

    it('measures how far below the fold a mention still sits', () => {
        expect(nearestViewportDistance([at(2800)], VIEWPORT)).toBe(2000);
    });

    it('takes the closest of several mentions', () => {
        expect(nearestViewportDistance([at(-5000), at(900), at(9000)], VIEWPORT)).toBe(100);
    });

    it('returns null when nothing is measurable', () => {
        expect(nearestViewportDistance([], VIEWPORT)).toBeNull();
        expect(nearestViewportDistance([{ top: 0, bottom: 0, width: 0, height: 0 }], VIEWPORT)).toBeNull();
    });
});

describe('isWithinReach', () => {
    it('keeps an entity mentioned on screen', () => {
        expect(isWithinReach([at(300)], VIEWPORT)).toBe(true);
    });

    it('keeps an entity a screen or two back', () => {
        expect(isWithinReach([at(-1200)], VIEWPORT)).toBe(true);
    });

    it('drops one left dozens of screens behind, however important', () => {
        // The introduction, while reading chapter four.
        expect(isWithinReach([at(-40_000)], VIEWPORT)).toBe(false);
    });

    it('drops one still far below the fold', () => {
        expect(isWithinReach([at(40_000)], VIEWPORT)).toBe(false);
    });

    it('keeps an entity whose mentions could not be located at all', () => {
        // Unknown position is not evidence of distance.
        expect(isWithinReach([], VIEWPORT)).toBe(true);
    });

    it('honours a custom reach', () => {
        expect(isWithinReach([at(-2400)], VIEWPORT, 3)).toBe(true);
        expect(isWithinReach([at(-2400)], VIEWPORT, 1)).toBe(false);
    });
});
