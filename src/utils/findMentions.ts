/** Locating entity mentions in the live DOM as Ranges.
 *
 *  Ranges rather than wrapped elements: the overlay paints from
 *  `getClientRects()`, so the host page's DOM is never mutated. Ranges also
 *  survive scrolling — only their client rects need recomputing.
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SELECT']);

// Text nodes in separate blocks must not be glued together: "…Punishment" +
// "Dounia went out" would read as "PunishmentDounia" and the word-boundary
// check would reject a mention that starts a paragraph. Inline splits
// ("New <b>Jersey</b>") must still join seamlessly, so only block changes
// insert a break.
const BLOCK_CONTAINER = [
    'address', 'article', 'aside', 'blockquote', 'dd', 'details', 'div', 'dl', 'dt',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
    'h5', 'h6', 'header', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
    'table', 'td', 'th', 'tr', 'ul',
].join(',');

// A model that returns "he" or "the man" as a surface form would light up half
// the page, so those are dropped rather than trusted.
const TOO_COMMON = new Set([
    'he', 'she', 'it', 'they', 'him', 'her', 'them', 'his', 'hers', 'their',
    'i', 'we', 'us', 'you', 'this', 'that', 'these', 'those', 'who', 'which',
    'the man', 'the woman', 'the company', 'the city', 'the country',
    'the young man', 'the old man', 'the old woman', 'the girl', 'the boy',
]);

/** Filters surface forms that would match far more than the entity. */
export const usableTerms = (terms: string[]): string[] => {
    const seen = new Set<string>();
    return terms
        .map((term) => term.trim())
        .filter((term) => {
            const key = term.toLowerCase();
            if (term.length < 2 || TOO_COMMON.has(key) || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

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
    let lastBlock: Element | null = null;
    let current = walker.nextNode() as Text | null;

    while (current) {
        const block = current.parentElement?.closest(BLOCK_CONTAINER) ?? null;
        // The separator belongs to no chunk, so offsets inside chunks still
        // map back to their node cleanly.
        if (chunks.length && block !== lastBlock) text += '\n';
        lastBlock = block;

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
