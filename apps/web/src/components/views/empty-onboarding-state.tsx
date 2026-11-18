// Écran d'accueil initial TVNest lorsqu'aucune source IPTV n'est encore configurée.
import { FolderOpen, Globe, Server } from 'lucide-react';
import { TvNestLogo } from '@/components/shell/tvnest-logo';

export function EmptyOnboardingState({
  onOpenAddSource,
}: {
  onOpenAddSource: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center p-8">
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-[32px] border border-border bg-card p-10 shadow-2xl">
        <TvNestLogo size="lg" showWordmark subtitle="Universal IPTV & Cinema Hub" />
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-foreground">
          Connectez votre première source IPTV
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Aucune donnée fictive n’est chargée. Connectez une playlist M3U8, un fichier
          local, un serveur Xtream Codes ou un portail Stalker MAC pour alimenter le
          catalogue, le guide des programmes et le lecteur TVNest Cinema.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={onOpenAddSource}
            className="flex flex-col items-start gap-2 rounded-[24px] border border-border bg-elevated p-5 text-left transition-colors hover:border-primary/50"
          >
            <Globe className="size-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Playlist M3U / URL</span>
            <span className="text-xs text-muted-foreground">
              Lien distant .m3u / .m3u8 ou texte brut
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAddSource}
            className="flex flex-col items-start gap-2 rounded-[24px] border border-border bg-elevated p-5 text-left transition-colors hover:border-primary/50"
          >
            <Server className="size-5 text-foreground" />
            <span className="text-sm font-bold text-foreground">Xtream & Stalker</span>
            <span className="text-xs text-muted-foreground">
              Live TV, films et séries
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAddSource}
            className="flex flex-col items-start gap-2 rounded-[24px] border border-border bg-elevated p-5 text-left transition-colors hover:border-primary/50"
          >
            <FolderOpen className="size-5 text-foreground" />
            <span className="text-sm font-bold text-foreground">Fichier M3U Local</span>
            <span className="text-xs text-muted-foreground">
              Ouverture directe depuis votre disque
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
