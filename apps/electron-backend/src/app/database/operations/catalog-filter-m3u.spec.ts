import { extractM3uCategoriesWithCounts } from './catalog-filter-m3u';

const payload = JSON.stringify({
    items: [
        { name: 'TF1 HD', url: 'http://x/1.ts', group: { title: 'FR | GENERALISTE' } },
        { name: 'France 2', url: 'http://x/2.ts', group: { title: 'FR | GENERALISTE' } },
        { name: 'La 1', url: 'http://x/3.ts', group: { title: 'SRS - SPAIN [ES]' } },
        { name: 'RTP', url: 'http://x/4.ts', group: { title: 'SRS - PORTUGAL [PT]' } },
    ],
});

describe('extractM3uCategoriesWithCounts', () => {
    it('returns every group when no language is requested', () => {
        const names = extractM3uCategoriesWithCounts(payload, null).map((c) => c.name);
        expect(names).toEqual(['FR | GENERALISTE', 'SRS - SPAIN [ES]', 'SRS - PORTUGAL [PT]']);
        expect(extractM3uCategoriesWithCounts(payload, null, 'ALL')).toHaveLength(3);
    });

    it('keeps only the groups of the requested language, with their counts', () => {
        expect(extractM3uCategoriesWithCounts(payload, null, 'FR')).toEqual([
            expect.objectContaining({ name: 'FR | GENERALISTE', stream_count: 2 }),
        ]);
        expect(
            extractM3uCategoriesWithCounts(payload, null, 'es').map((c) => c.name)
        ).toEqual(['SRS - SPAIN [ES]']);
    });
});
