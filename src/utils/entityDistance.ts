/** Vertical distance from the viewport to the nearest mention of an entity. */

export interface MeasuredRect {
    top: number;
    bottom: number;
    width: number;
    height: number;
}

/**
 * How far above or below the viewport the closest mention sits, in pixels.
 * Zero when any mention is on screen; null when nothing is measurable, which
 * means "unknown" rather than "far away".
 */
export const nearestViewportDistance = (
    rects: MeasuredRect[],
    viewportHeight: number,
): number | null => {
    let nearest: number | null = null;

    for (const rect of rects) {
        if (rect.width === 0 && rect.height === 0) continue;
        const above = -rect.bottom;              // >0 when scrolled past it
        const below = rect.top - viewportHeight; // >0 when still below the fold
        const distance = Math.max(0, above, below);
        if (nearest === null || distance < nearest) nearest = distance;
    }

    return nearest;
};

/**
 * Entities are kept while their nearest mention is within this many screens.
 *
 * Reading chapter four, the people named only in the introduction are dozens
 * of screens back: still important, still recent enough to survive the ranking,
 * but no longer about anything on the page. Distance is the honest signal for
 * that, and importance cannot substitute for it.
 */
export const REACH_IN_SCREENS = 3;

export const isWithinReach = (
    rects: MeasuredRect[],
    viewportHeight: number,
    screens: number = REACH_IN_SCREENS,
): boolean => {
    const distance = nearestViewportDistance(rects, viewportHeight);
    // Unmeasurable (no mention located at all) is not evidence of distance.
    if (distance === null) return true;
    return distance <= screens * viewportHeight;
};
