// Types et constantes linguistiques du moteur de filtrage SQLite TVNest.
export type {
    CatalogContentKind,
    CatalogFilterQuery,
    CatalogFilterResult,
    CatalogQualityFilter,
    CatalogSortBy,
    CatalogStreamRow,
    CategoryWithCountRow,
    DashboardHighlightsResult,
    PlaylistStreamCounts,
} from '@iptvnator/shared/interfaces';

function tagPatterns(...codes: string[]): string[] {
    return codes.flatMap((c) => [
        `${c} -%`,
        `${c}-%`,
        `${c}|%`,
        `${c} |%`,
        `${c}:%`,
        `%[${c}]%`,
        `%(${c})%`,
        `%|${c}|%`,
        `%| ${c} |%`,
    ]);
}

export const LANGUAGE_PATTERNS: Record<string, string[]> = {
    FR: [
        ...tagPatterns('FR'),
        '%FRENCH%',
        '%FRANCAIS%',
        '%VOSTFR%',
        '%TRUEFRENCH%',
        '% VF %',
        '% VFF %',
    ],
    EN: [...tagPatterns('EN', 'UK', 'US'), '%ENGLISH%'],
    ES: [...tagPatterns('ES'), '%ESPANOL%', '%LATINO%', '%CASTELLANO%'],
    AR: [...tagPatterns('AR'), '%ARAB%', '%SHAHID%'],
    DE: [...tagPatterns('DE'), '%GERMAN%', '%DEUTSCH%'],
    IT: [...tagPatterns('IT'), '%ITALIA%'],
    PT: [...tagPatterns('PT', 'BR'), '%PORTUG%', '%BRASIL%'],
    NL: [...tagPatterns('NL'), '%DUTCH%', '%NEDERLAND%'],
    TR: [...tagPatterns('TR'), '%TURK%'],
};
