// Augmentation TypeScript des méthodes IPC SQLite TVNest sur ElectronBridgeApi.
// Les types viennent du backend : une seule source de vérité pour le contrat IPC.
import '@iptvnator/shared/interfaces';
import type {
  CatalogFilterQuery,
  CatalogFilterResult,
  CatalogStreamRow,
  CategoryWithCountRow,
  DashboardHighlightsResult,
  PlaylistStreamCounts,
} from '../../../electron-backend/src/app/database/operations/catalog-filter.types';

export type DbCatalogQueryPayload = CatalogFilterQuery;
export type DbCatalogRow = CatalogStreamRow;

declare module '@iptvnator/shared/interfaces' {
  interface ElectronBridgeApi {
    dbQueryCatalog: (query: CatalogFilterQuery) => Promise<CatalogFilterResult>;
    dbGetCategoriesWithCounts: (
      playlistId: string,
      language?: string
    ) => Promise<CategoryWithCountRow[]>;
    dbGetPlaylistStreamCounts: () => Promise<
      Record<string, PlaylistStreamCounts>
    >;
    dbGetDashboardHighlights: (
      playlistId: string,
      preferredLanguage?: string
    ) => Promise<DashboardHighlightsResult>;
  }
}
