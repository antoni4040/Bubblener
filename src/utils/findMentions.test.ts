import { describe, expect, it } from 'vitest';
import findMentions, { usableTerms } from '@/utils/findMentions';

const rangesFor = (html: string, terms: string[][]) => {
    document.body.innerHTML = html;
    return findMentions(document.body, terms);
};

describe('usableTerms', () => {
    it('keeps proper names and specific noun phrases', () => {
        expect(usableTerms(['Alyona Ivanovna', 'the pawnbroker']))
            .toEqual(['Alyona Ivanovna', 'the pawnbroker']);
    });

    it('drops pronouns and bare common nouns, which would match half the page', () => {
        expect(usableTerms(['Raskolnikov', 'he', 'him', 'the young man', 'the old woman']))
            .toEqual(['Raskolnikov']);
    });

    it('is case-insensitive about what counts as too common', () => {
        expect(usableTerms(['He', 'THEY', 'Sonia'])).toEqual(['Sonia']);
    });

    it('de-duplicates differing only by case or whitespace', () => {
        expect(usableTerms(['Acme', ' acme ', 'ACME'])).toEqual(['Acme']);
    });

    it('drops single characters, which cannot be matched safely', () => {
        expect(usableTerms(['R', 'Razumihin'])).toEqual(['Razumihin']);
    });

    it('survives an entity with no surface forms at all', () => {
        expect(usableTerms([])).toEqual([]);
    });
});

describe('findMentions block boundaries', () => {
    it('matches a mention that starts a block after one ending in a word', () => {
        // "...Punishment" + "Dounia..." must not read as "PunishmentDounia".
        const [dounia] = rangesFor(
            '<h1>Crime and Punishment</h1><p>Dounia would have been the cause.</p>',
            [['Dounia']],
        );
        expect(dounia).toHaveLength(1);
    });

    it('finds every occurrence across several blocks', () => {
        const [dounia] = rangesFor(
            '<p>Dounia spoke.</p><p>Dounia left.</p><p>And then Dounia returned.</p>',
            [['Dounia']],
        );
        expect(dounia).toHaveLength(3);
    });

    it('still joins text split across inline elements', () => {
        const [jersey] = rangesFor(
            '<p>He worked in New <b>Jersey</b> that year.</p>',
            [['New Jersey']],
        );
        expect(jersey).toHaveLength(1);
    });

    it('does not match a phrase that spans a block boundary', () => {
        const [phrase] = rangesFor(
            '<p>He went to New</p><p>Jersey afterwards.</p>',
            [['New Jersey']],
        );
        expect(phrase).toHaveLength(0);
    });

    it('respects word boundaries rather than matching inside longer words', () => {
        const [acme] = rangesFor('<p>Acme and Acmeter are different.</p>', [['Acme']]);
        expect(acme).toHaveLength(1);
    });
});
