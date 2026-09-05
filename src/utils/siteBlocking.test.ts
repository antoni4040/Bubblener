import { describe, expect, it } from 'vitest';
import { addPattern, isSiteBlocked, normalizePattern, siteLabel } from '@/utils/siteBlocking';

describe('normalizePattern', () => {
    it('reduces a pasted URL to its hostname', () => {
        expect(normalizePattern('https://mail.example.com/inbox?tab=1#top'))
            .toBe('mail.example.com');
    });

    it('drops the port, credentials and casing', () => {
        expect(normalizePattern('HTTPS://User:Pw@Example.COM:8443/x')).toBe('example.com');
    });

    it('keeps a leading glob, which is only ever a synonym', () => {
        expect(normalizePattern('*.example.com')).toBe('*.example.com');
    });

    it('treats blank input as nothing rather than as a match-all', () => {
        expect(normalizePattern('   ')).toBe('');
    });
});

describe('isSiteBlocked', () => {
    it('blocks the named host', () => {
        expect(isSiteBlocked('https://example.com/page', ['example.com'])).toBe(true);
    });

    it('blocks subdomains of the named host', () => {
        // The whole point: blocking example.com must not leave mail.example.com
        // being sent to a model.
        expect(isSiteBlocked('https://mail.example.com/inbox', ['example.com'])).toBe(true);
    });

    it('accepts the glob spelling as the same rule', () => {
        expect(isSiteBlocked('https://mail.example.com', ['*.example.com'])).toBe(true);
        expect(isSiteBlocked('https://example.com', ['*.example.com'])).toBe(true);
    });

    it('matches on label boundaries, not on a bare suffix', () => {
        // `notexample.com` ends with `example.com` as a string, and must not match.
        expect(isSiteBlocked('https://notexample.com', ['example.com'])).toBe(false);
    });

    it('does not block a parent of the named host', () => {
        expect(isSiteBlocked('https://example.com', ['mail.example.com'])).toBe(false);
    });

    it('ignores the path, so one rule covers the whole site', () => {
        expect(isSiteBlocked('https://example.com/a/b?c=d', ['example.com'])).toBe(true);
    });

    it('is unaffected by casing or a trailing root dot', () => {
        expect(isSiteBlocked('https://Example.COM./x', ['example.com'])).toBe(true);
    });

    it('allows everything when the list is empty', () => {
        expect(isSiteBlocked('https://example.com', [])).toBe(false);
    });

    it('skips blank entries instead of blocking everything', () => {
        // A stray empty line in the list must not turn into a match-all.
        expect(isSiteBlocked('https://example.com', ['', '   '])).toBe(false);
    });

    it('reports an unparseable URL as not blocked', () => {
        expect(isSiteBlocked('not a url', ['example.com'])).toBe(false);
        expect(isSiteBlocked(undefined, ['example.com'])).toBe(false);
    });

    it('blocks when any one pattern matches', () => {
        expect(isSiteBlocked('https://bank.example', ['foo.com', 'bank.example']))
            .toBe(true);
    });
});

describe('siteLabel', () => {
    it('offers the bare hostname, without www', () => {
        expect(siteLabel('https://www.example.com/page')).toBe('example.com');
    });

    it('offers nothing for pages the extension cannot run on', () => {
        expect(siteLabel('chrome://extensions')).toBe('');
        expect(siteLabel('file:///home/x.html')).toBe('');
        expect(siteLabel(undefined)).toBe('');
    });
});

describe('addPattern', () => {
    it('stores what the user typed as a hostname', () => {
        expect(addPattern([], 'https://example.com/x')).toEqual(['example.com']);
    });

    it('does not add the same site twice', () => {
        expect(addPattern(['example.com'], 'https://example.com')).toEqual(['example.com']);
    });

    it('ignores blank input', () => {
        expect(addPattern(['example.com'], '  ')).toEqual(['example.com']);
    });
});
