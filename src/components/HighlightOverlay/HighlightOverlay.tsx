import { useEffect, useRef, useState } from 'react';
import Entity from '@/utils/types/Entity';
import EntityColors from '@/utils/types/EntityColors';
import { getEntityInk } from '@/utils/entityColors';

interface HighlightOverlayProps {
    entities: Entity[];
    mentions: Range[][];
    colors: EntityColors;
    /** Index of the entity being hovered, or null. */
    focused: number | null;
    /** Viewport rect of an entity's bubble, re-read on every measure pass. */
    getBubbleRect: (entityIndex: number) => DOMRect | null;
    /** Fires when the pointer enters/leaves a mention in the page text. */
    onMentionFocus: (entityIndex: number | null) => void;
}

interface Mark {
    entityIndex: number;
    /** Which mention of that entity — one mention wrapping a line has two rects. */
    mentionIndex: number;
    rect: DOMRect;
}

/** A dense text ("Raskolnikov" in a whole novel) would otherwise carpet the
 *  screen in connectors, each one raking across the prose. The boxes already
 *  show where every mention is; the line only has to establish which bubble
 *  they belong to, and one line does that. */
const MAX_CONNECTORS = 1;

/**
 * Paints mention marks and bubble connectors on a fixed, pointer-events-none
 * SVG layer. Nothing here touches the host page's DOM — the cost is that rects
 * are a snapshot and must be recomputed whenever the page moves.
 */
const HighlightOverlay = ({
    entities, mentions, colors, focused, getBubbleRect, onMentionFocus,
}: HighlightOverlayProps) => {
    const [marks, setMarks] = useState<Mark[]>([]);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const marksRef = useRef<Mark[]>([]);

    useEffect(() => {
        let frame = 0;

        const measure = () => {
            frame = 0;
            const next: Mark[] = [];
            mentions.forEach((ranges, entityIndex) => {
                ranges.forEach((range, mentionIndex) => {
                    // A mention wrapping across lines yields one rect per line.
                    for (const rect of Array.from(range.getClientRects())) {
                        if (rect.width === 0 && rect.height === 0) continue;
                        next.push({ entityIndex, mentionIndex, rect });
                    }
                });
            });
            marksRef.current = next;
            setMarks(next);
            setViewport({ width: window.innerWidth, height: window.innerHeight });
        };

        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(measure);
        };

        measure();
        window.addEventListener('scroll', schedule, { passive: true, capture: true });
        window.addEventListener('resize', schedule, { passive: true });

        // Late-loading fonts and images reflow the text under our snapshot.
        const observer = new ResizeObserver(schedule);
        observer.observe(document.documentElement);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule, { capture: true });
            window.removeEventListener('resize', schedule);
            observer.disconnect();
        };
    }, [mentions]);

    // Hover detection for the text side of the link. Hit-testing rather than
    // pointer-events on the marks: the overlay must never shadow a link,
    // button, or text selection in the page underneath.
    useEffect(() => {
        let frame = 0;
        let last: number | null = null;

        const test = (event: MouseEvent) => {
            frame = 0;
            const hit = marksRef.current.find(
                ({ rect }) =>
                    event.clientX >= rect.left && event.clientX <= rect.right &&
                    event.clientY >= rect.top && event.clientY <= rect.bottom
            );
            const next = hit ? hit.entityIndex : null;
            if (next !== last) {
                last = next;
                onMentionFocus(next);
            }
        };

        const onMove = (event: MouseEvent) => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => test(event));
        };

        document.addEventListener('mousemove', onMove, { passive: true });
        return () => {
            if (frame) cancelAnimationFrame(frame);
            document.removeEventListener('mousemove', onMove);
        };
    }, [onMentionFocus]);

    if (!marks.length) return null;

    const onScreen = (rect: DOMRect) =>
        rect.bottom > 0 && rect.top < viewport.height && rect.right > 0 && rect.left < viewport.width;

    const focusedMarks = focused === null ? [] : marks.filter((m) => m.entityIndex === focused);
    const bubbleRect = focused === null ? null : getBubbleRect(focused);

    // One anchor per mention, not per rect. Anchoring on the rightmost rect of
    // a wrapped mention keeps the line out of the prose.
    const anchorFor = (list: Mark[]) =>
        Array.from(
            list
                .reduce((best, mark) => {
                    const current = best.get(mark.mentionIndex);
                    if (!current || mark.rect.right > current.right) best.set(mark.mentionIndex, mark.rect);
                    return best;
                }, new Map<number, DOMRect>())
                .values()
        );

    const visibleAnchors = anchorFor(focusedMarks.filter((m) => onScreen(m.rect)));

    // How far outside the viewport a rect sits, for picking the nearest one.
    const distanceOutside = (rect: DOMRect) =>
        rect.bottom <= 0 ? -rect.bottom : rect.top - viewport.height;

    // A single full-length line toward the closest mention beyond the fold —
    // it runs off the edge, which reads as "this continues that way".
    const nearestOffscreen = anchorFor(focusedMarks.filter((m) => !onScreen(m.rect)))
        .sort((a, b) => distanceOutside(a) - distanceOutside(b))[0];

    const connectors = [
        ...visibleAnchors
            .slice()
            .sort((a, b) => (bubbleRect ? Math.abs(a.top - bubbleRect.top) - Math.abs(b.top - bubbleRect.top) : 0))
            .slice(0, MAX_CONNECTORS),
        ...(nearestOffscreen ? [nearestOffscreen] : []),
    ];

    return (
        <svg
            aria-hidden="true"
            width={viewport.width}
            height={viewport.height}
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 2147483000,
                overflow: 'visible',
            }}
        >
            {marks.map((mark, i) => {
                const entity = entities[mark.entityIndex];
                if (!entity) return null;
                const ink = getEntityInk(entity.entity_type, colors);
                const isFocused = focused === mark.entityIndex;
                const { rect } = mark;

                // Resting state is a quiet underline; hovering promotes it to a
                // box. Boxes on every mention compete with the prose.
                return isFocused ? (
                    <rect
                        key={i}
                        x={rect.left - 2}
                        y={rect.top - 1}
                        width={rect.width + 4}
                        height={rect.height + 2}
                        rx={2}
                        fill={ink}
                        fillOpacity={0.14}
                        stroke={ink}
                        strokeWidth={1.5}
                    />
                ) : (
                    <rect
                        key={i}
                        x={rect.left}
                        y={rect.bottom - 1.5}
                        width={rect.width}
                        height={1.5}
                        fill={ink}
                        fillOpacity={0.55}
                    />
                );
            })}

            {focused !== null && bubbleRect && connectors.map((anchor, i) => {
                const ink = getEntityInk(entities[focused].entity_type, colors);
                // Leave from the baseline, so the connector reads as the
                // underline continuing outward rather than a strikethrough...
                const from = { x: anchor.right + 2, y: anchor.bottom };
                const to = { x: bubbleRect.left, y: bubbleRect.top + bubbleRect.height / 2 };
                // ...and stay flat until clear of the text column before rising.
                const span = to.x - from.x;
                return (
                    <path
                        key={`link-${i}`}
                        d={`M ${from.x} ${from.y} C ${from.x + span * 0.45} ${from.y}, ${to.x - span * 0.25} ${to.y}, ${to.x} ${to.y}`}
                        fill="none"
                        stroke={ink}
                        strokeWidth={1.5}
                        strokeOpacity={0.75}
                    />
                );
            })}
        </svg>
    );
};

export default HighlightOverlay;
