/**
 * Which sites Bubblener must leave alone.
 *
 * Patterns are hostnames, not regular expressions. A regex typed into a
 * settings box is a ReDoS foot-gun and painful to author correctly, and the
 * blocklist is a privacy control — it has to be predictable.
 */

/**
 * Reduces whatever the user typed to a bare hostname.
 *
 * People paste URLs, so accept them: `https://mail.example.com/inbox?x=1`
 * and `mail.example.com` should mean the same thing. A leading `*.` is kept,
 * because that is how people write "and its subdomains" — though it is only
 * ever a synonym here, since a bare hostname already covers subdomains.
 */
export const normalizePattern = (input: string): string => {
    let value = input.trim().toLowerCase();
    if (!value) return '';

    value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
    value = value.replace(/^[^/@]*@/, '');                // credentials
    value = value.split('/')[0]!.split('?')[0]!.split('#')[0]!;
    value = value.replace(/:\d+$/, '');                   // port
    value = value.replace(/\.+$/, '');                    // trailing root dot

    return value;
};

/** True when `host` is `pattern` or sits underneath it. */
const hostMatches = (host: string, pattern: string): boolean => {
    // `*.example.com` is accepted as a synonym for `example.com`, so that
    // someone who writes the glob out of habit gets what they expect.
    const base = pattern.startsWith('*.') ? pattern.slice(2) : pattern;
    if (!base) return false;
    // Compared label-wise: `notexample.com` must not match `example.com`.
    return host === base || host.endsWith(`.${base}`);
};

/**
 * Whether this URL is blocked.
 *
 * A bare `example.com` blocks its subdomains too. For a privacy control the
 * surprising direction should be the safe one — nobody who blocks
 * `example.com` wants `mail.example.com` sent to a model.
 *
 * An unparseable URL is reported as not blocked: callers gate on protocol
 * separately, and guessing at a host we could not read would make the rule
 * unpredictable in the one place it needs to be trustworthy.
 */
export const isSiteBlocked = (url: string | undefined, patterns: string[]): boolean => {
    if (!url || !patterns.length) return false;

    let host: string;
    try {
        host = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
    } catch {
        return false;
    }
    if (!host) return false;

    return patterns.some((raw) => {
        const pattern = normalizePattern(raw);
        return pattern ? hostMatches(host, pattern) : false;
    });
};

/** The hostname to offer as "never on this site", or '' if there isn't one. */
export const siteLabel = (url: string | undefined): string => {
    if (!url) return '';
    try {
        const { hostname, protocol } = new URL(url);
        // Only the schemes the extension can run on are worth offering.
        if (protocol !== 'http:' && protocol !== 'https:') return '';
        return hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
};

/** Adds a pattern, normalized and deduped, preserving order. */
export const addPattern = (patterns: string[], input: string): string[] => {
    const pattern = normalizePattern(input);
    if (!pattern) return patterns;
    const existing = patterns.map(normalizePattern);
    if (existing.includes(pattern)) return patterns;
    return [...patterns, pattern];
};
