// Dictionnaire i18n TVNest (FR / EN / ES) et configuration des langues audio/contenu.
export type UiLanguage = 'fr' | 'en' | 'es';

export type ContentLanguageCode =
  | 'ALL'
  | 'FR'
  | 'EN'
  | 'ES'
  | 'AR'
  | 'DE'
  | 'IT'
  | 'PT'
  | 'NL'
  | 'TR';

export const INTERFACE_LANGUAGES: Array<{ value: UiLanguage; label: string }> = [
  { value: 'fr', label: 'Français (FR)' },
  { value: 'en', label: 'English (EN)' },
  { value: 'es', label: 'Español (ES)' },
];

export const CONTENT_LANGUAGES: Array<{
  value: ContentLanguageCode;
  label: string;
  mpvCodes?: string;
}> = [
  { value: 'ALL', label: 'Toutes les langues' },
  { value: 'FR', label: 'Français (FR / VF / VOSTFR)', mpvCodes: 'fr,fre,fra' },
  { value: 'EN', label: 'Anglais (EN / UK / US)', mpvCodes: 'en,eng' },
  { value: 'ES', label: 'Espagnol (ES / LATINO)', mpvCodes: 'es,spa' },
  { value: 'AR', label: 'Arabe (AR)', mpvCodes: 'ar,ara' },
  { value: 'DE', label: 'Allemand (DE)', mpvCodes: 'de,ger,deu' },
  { value: 'IT', label: 'Italien (IT)', mpvCodes: 'it,ita' },
  { value: 'PT', label: 'Portugais (PT / BR)', mpvCodes: 'pt,por' },
  { value: 'NL', label: 'Néerlandais (NL)', mpvCodes: 'nl,dut,nld' },
  { value: 'TR', label: 'Turc (TR)', mpvCodes: 'tr,tur' },
];

// Génère les arguments MPV `--alang` et `--slang` pour la langue de préférence.
export function buildMpvLanguageArgs(code: ContentLanguageCode): string {
  const entry = CONTENT_LANGUAGES.find((l) => l.value === code);
  if (!entry?.mpvCodes) return '';
  return `--alang=${entry.mpvCodes} --slang=${entry.mpvCodes}`;
}

const DICT = {
  fr: {
    dashboard: 'Accueil',
    live: 'Live TV',
    movies: 'Films VOD',
    series: 'Séries',
    epg: 'Guide EPG',
    favorites: 'Favoris',
    history: 'Historique',
    downloads: 'Téléchargements',
    playlists: 'Sources IPTV',
    settings: 'Paramètres',
    searchPlaceholder: 'Rechercher chaîne, film, série, acteur...',
    addSource: 'Source IPTV',
    watchNow: 'Regarder',
    resumeWatch: 'Reprendre',
    backToCatalog: 'Retour au catalogue',
    allGroups: 'Tous les groupes',
    loadMore: 'Afficher plus de résultats',
    resetFilters: 'Réinitialiser',
    noPlaylist: 'Aucune source configurée',
  },
  en: {
    dashboard: 'Home',
    live: 'Live TV',
    movies: 'Movies VOD',
    series: 'Series',
    epg: 'EPG Guide',
    favorites: 'Favorites',
    history: 'History',
    downloads: 'Downloads',
    playlists: 'IPTV Sources',
    settings: 'Settings',
    searchPlaceholder: 'Search channel, movie, series, cast...',
    addSource: 'IPTV Source',
    watchNow: 'Watch Now',
    resumeWatch: 'Resume',
    backToCatalog: 'Back to catalog',
    allGroups: 'All groups',
    loadMore: 'Load more results',
    resetFilters: 'Reset',
    noPlaylist: 'No source configured',
  },
  es: {
    dashboard: 'Inicio',
    live: 'TV en Vivo',
    movies: 'Películas VOD',
    series: 'Series',
    epg: 'Guía EPG',
    favorites: 'Favoritos',
    history: 'Historial',
    downloads: 'Descargas',
    playlists: 'Fuentes IPTV',
    settings: 'Ajustes',
    searchPlaceholder: 'Buscar canal, película, serie...',
    addSource: 'Fuente IPTV',
    watchNow: 'Ver ahora',
    resumeWatch: 'Reanudar',
    backToCatalog: 'Volver al catálogo',
    allGroups: 'Todos los grupos',
    loadMore: 'Cargar más resultados',
    resetFilters: 'Restablecer',
    noPlaylist: 'Sin fuente configurada',
  },
} as const;

export type TranslationKey = keyof (typeof DICT)['fr'];

export function t(lang: UiLanguage | undefined, key: TranslationKey): string {
  const dict = DICT[lang || 'fr'] || DICT.fr;
  return dict[key] || DICT.fr[key];
}
