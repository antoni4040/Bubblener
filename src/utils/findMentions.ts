/** Locating entity mentions in the live DOM as Ranges.
 *
 *  Ranges rather than wrapped elements: the overlay paints from
 *  `getClientRects()`, so the host page's DOM is never mutated. Ranges also
 *  survive scrolling — only their client rects need recomputing.
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SELECT']);

interface TextIndex {
    text: string;
    /** Parallel array: where each text node's content starts in `text`. */
    chunks: { node: Text; start: number }[];
}

const buildTextIndex = (root: Node): TextIndex => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const chunks: { node: Text; start: number }[] = [];
    let text = '';
    let current = walker.nextNode() as Text | null;
    while (current) {
        chunks.push({ node: current, start: text.length });
        text += current.nodeValue;
        current = walker.nextNode() as Text | null;
    }
    return { text, chunks };
};

/** Maps an offset in the flattened text back to (node, offsetWithinNode). */
const locate = (index: TextIndex, offset: number) => {
    let lo = 0;
    let hi = index.chunks.length - 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (index.chunks[mid].start <= offset) lo = mid;
        else hi = mid - 1;
    }
    const chunk = index.chunks[lo];
    return { node: chunk.node, offset: offset - chunk.start };
};

// JS `\b` is defined over [A-Za-z0-9_], so it misfires on Greek, Cyrillic and
// every other non-Latin script. Test the adjacent characters instead.
const WORDLIKE = /[\p{L}\p{N}]/u;

const isBoundary = (text: string, position: number): boolean => {
    if (position < 0 || position >= text.length) return true;
    return !WORDLIKE.test(text[position]);
};

/** Every whole-word occurrence of `term`, as Ranges, in document order. */
const findTerm = (index: TextIndex, haystack: string, term: string): Range[] => {
    const needle = term.trim().toLowerCase();
    if (needle.length < 2) return [];

    const ranges: Range[] = [];
    let from = 0;
    for (;;) {
        const at = haystack.indexOf(needle, from);
        if (at === -1) break;
        from = at + needle.length;

        if (!isBoundary(haystack, at - 1) || !isBoundary(haystack, at + needle.length)) {
            continue;
        }

        const start = locate(index, at);
        const end = locate(index, at + needle.length);
        const range = document.createRange();
        try {
            range.setStart(start.node, start.offset);
            range.setEnd(end.node, end.offset);
            ranges.push(range);
        } catch {
            // Offsets can fall outside a node if the DOM shifted mid-walk;
            // skipping one mention is better than losing the whole set.
        }
    }
    return ranges;
};

/** Drops ranges that overlap one already claimed by an earlier, longer term. */
const withoutOverlaps = (ranges: Range[]): Range[] => {
    const kept: Range[] = [];
    for (const range of ranges) {
        const clashes = kept.some(
            (other) =>
                range.compareBoundaryPoints(Range.END_TO_START, other) < 0 &&
                range.compareBoundaryPoints(Range.START_TO_END, other) > 0
        );
        if (!clashes) kept.push(range);
    }
    return kept;
};

/**
 * Finds mentions for each entity within `root`.
 *
 * Terms are matched longest-first so "Acme Corporation" wins over "Acme", and
 * an entity never claims text already claimed by a more specific one.
 */
export const findMentions = (root: Node, termsByEntity: string[][]): Range[][] => {
    const index = buildTextIndex(root);
    if (!index.text) return termsByEntity.map(() => []);
    const haystack = index.text.toLowerCase();

    const ordered = termsByEntity
        .map((terms, entityIndex) => ({ entityIndex, terms }))
        .sort((a, b) => {
            const longest = (t: string[]) => Math.max(0, ...t.map((s) => s.length));
            return longest(b.terms) - longest(a.terms);
        });

    const results: Range[][] = termsByEntity.map(() => []);
    const claimed: Range[] = [];

    for (const { entityIndex, terms } of ordered) {
        const found = terms
            .slice()
            .sort((a, b) => b.length - a.length)
            .flatMap((term) => findTerm(index, haystack, term));

        const unique = withoutOverlaps([...claimed, ...found]).filter((r) => found.includes(r));
        results[entityIndex] = unique;
        claimed.push(...unique);
    }

    return results;
};

export default findMentions;
