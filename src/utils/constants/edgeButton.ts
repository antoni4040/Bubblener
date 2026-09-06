/**
 * Shape of the edge-tucked buttons.
 *
 * Two separate things use it — the always-on launcher (a vanilla content
 * script) and the "show bubbles" control inside the React app — and they sit
 * in the same spot on screen, one replacing the other. Keeping the numbers
 * here is what stops them drifting into two slightly different buttons.
 */

/** Resting: peeking out of the edge, showing its glyph and nothing else. */
export const EDGE_COLLAPSED = 38;
export const EDGE_TALL = 40;
/** Inner padding, gap between glyph and label, and the label's size. */
export const EDGE_PADDING = 10;
export const EDGE_GAP = 7;
export const EDGE_GLYPH = 16;

/**
 * Width when opened, sized to the label it carries.
 *
 * Deliberately per-label rather than one shared number: a width generous
 * enough for the longest label leaves dead space between a shorter one and the
 * window edge, which reads as the button being badly aligned.
 */
export const edgeExpanded = (label: string): number =>
    // ~7.1px per character at 13px/600 across the four theme fonts, the widest
    // of which is Cyberpunk's monospace. Rounded up; a few px of slack is
    // invisible, whereas clipping the label is not.
    EDGE_PADDING * 2 + EDGE_GLYPH + EDGE_GAP + Math.ceil(label.length * 7.1);
