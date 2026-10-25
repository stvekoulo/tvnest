# TVNest

Lecteur IPTV et cinéma pour ordinateur : playlists M3U / M3U8, serveurs Xtream Codes,
portails Stalker, guide TV XMLTV (EPG) et lecteur intégré basé sur libmpv.

TVNest est un projet de **Steven K.**, basé sur [IPTVnator](https://github.com/4gray/iptvnator)
(licence MIT). La logique d'origine (Electron, base SQLite, lecteur libmpv) est conservée ;
l'interface a été entièrement refaite en React.

> TVNest est uniquement un **lecteur**. Il ne fournit ni chaînes, ni abonnements, ni playlists.

## Fonctionnalités

- Sources : playlist M3U par URL, fichier ou texte, Xtream Codes, portail Stalker
- Catalogue Live TV, films et séries, avec filtres (langue, qualité, note, groupe)
- Guide TV XMLTV : programme en cours, grille par jour, logos et vignettes
- Lecteur intégré libmpv : pistes audio et sous-titres, vitesse, format, enregistrement du direct,
  raccourcis clavier ; lecteurs externes MPV et VLC
- Favoris, historique et reprise de lecture

## Installation

Téléchargez l'installeur Windows (`tvnest-<version>-windows-x64-setup.exe`) depuis la page
[Releases](../../releases).

## Développement

Prérequis : Node.js, Visual Studio Build Tools (module natif libmpv) et pnpm 10.

```bash
pnpm install --frozen-lockfile
npm ci --prefix apps/web
pnpm run serve:frontend   # interface React (Vite) sur http://localhost:4200
pnpm run serve:backend    # application Electron
```

Générer l'installeur Windows en local :

```bash
pnpm run make:app -- --publishPolicy=never
```

L'installeur est écrit dans `dist/executables/`.

## Intégration continue

Le workflow [`build-windows.yml`](.github/workflows/build-windows.yml) tourne sur un runner
GitHub Actions auto-hébergé (Windows x64) :

- push sur `master` ou lancement manuel : installeur copié sur la machine du runner, dans le dossier
  `TVNEST_INSTALLERS_DIR` défini dans le fichier `.env` du runner ;
- tag `v*` (par exemple `v0.26.0`) : installeur publié dans une Release GitHub, utilisée par la
  mise à jour automatique.

## Licence

[MIT](LICENSE.md). Le nom et le logo « IPTVnator » appartiennent à leur auteur et ne sont pas
utilisés comme identité de ce projet (voir [TRADEMARK.md](TRADEMARK.md)).
