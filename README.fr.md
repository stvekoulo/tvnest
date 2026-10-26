<p align="right"><a href="README.md">English</a> · <b>Français</b></p>

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="TVNest — votre abonnement IPTV dans un lecteur rapide, façon cinéma, pour Windows. Compatible M3U, Xtream Codes, Stalker et guide EPG/XMLTV.">
</p>

<p align="center">
  <a href="../../releases/latest"><img src="https://img.shields.io/github/v/release/stvekoulo/tvnest?label=T%C3%A9l%C3%A9charger%20pour%20Windows&style=for-the-badge&color=111111&labelColor=262626" alt="Télécharger la dernière version de TVNest pour Windows"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-111111?style=for-the-badge&labelColor=262626" alt="Windows 10 et 11">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/Licence-MIT-111111?style=for-the-badge&labelColor=262626" alt="Licence MIT"></a>
</p>

**TVNest** transforme votre abonnement IPTV en une application de bureau qui ressemble à un service de streaming : chaînes en direct, films et séries dans une seule bibliothèque sombre et rapide, avec un lecteur intégré qui se souvient où vous vous êtes arrêté.

> TVNest est **uniquement un lecteur**. Il ne fournit ni chaînes, ni abonnements, ni playlists : vous utilisez les vôtres.

<p align="center">
  <img src="./assets/readme/screen-movies.webp" width="100%" alt="Page Films de TVNest : carrousel à la une, panneau des groupes et une rangée par groupe">
</p>

<table>
  <tr>
    <td width="33%"><img src="./assets/readme/screen-home.webp" alt="Accueil : titre à la une, groupes, tuile Reprendre et rangées"></td>
    <td width="33%"><img src="./assets/readme/screen-live.webp" alt="Live TV : chaînes rangées par groupe avec le badge DIRECT"></td>
    <td width="33%"><img src="./assets/readme/screen-movie-detail.webp" alt="Fiche d'un film avec les boutons Lire, mode Cinéma et favori"></td>
  </tr>
  <tr>
    <td align="center"><sub>Accueil</sub></td>
    <td align="center"><sub>Live TV</sub></td>
    <td align="center"><sub>Fiche film</sub></td>
  </tr>
</table>

<sub>Les captures utilisent un contenu d'exemple fictif.</sub>

## Ce que vous obtenez

- **Toutes vos sources au même endroit** — liens ou fichiers M3U / M3U8, comptes Xtream Codes, portails Stalker et guides XMLTV.
- **Une bibliothèque comme un service de streaming** — titres à la une, une rangée par groupe, filtres rapides (langue, qualité, note, année) et recherche dans toutes les sources.
- **Un lecteur pensé pour regarder** — mpv intégré avec pistes audio et sous-titres, vitesse et format d'image, enregistrement du direct, raccourcis clavier, et MPV ou VLC si vous préférez.
- **Reprenez où vous en étiez** — reprendre ou recommencer un film ou un épisode, épisode suivant automatique, historique et favoris.
- **Le direct avec son guide** — programme en cours et suivant, grille des programmes jour par jour.
- **Fait pour l'ordinateur** — thème noir intégral, mise en page adaptée à toutes les tailles de fenêtre, mises à jour automatiques.

## Comment ça marche

<p align="center">
  <img src="./assets/readme/how-it-works.svg" width="100%" alt="1. Ajoutez votre fournisseur (M3U, Xtream Codes, Stalker, XMLTV). 2. TVNest crée une bibliothèque sur votre PC. 3. Regardez dans le lecteur intégré, ou dans MPV ou VLC.">
</p>

Votre catalogue est importé dans une base locale sur votre PC : la navigation reste instantanée, même avec plus de 100 000 titres. Vos sources et vos identifiants restent sur votre PC.

## Bien démarrer

1. Téléchargez `tvnest-<version>-windows-x64-setup.exe` depuis la [dernière version](../../releases/latest) et installez-le.
2. Ouvrez TVNest et cliquez sur **Source IPTV**.
3. Choisissez **Xtream**, **M3U URL**, **Fichier**, **Texte** ou **Stalker**, puis saisissez les informations de votre fournisseur.
4. Parcourez Live TV, Films et Séries, et lancez la lecture.

TVNest vérifie les nouvelles versions sur GitHub et se met à jour tout seul.

**Bon à savoir**

- Windows 10 et 11 (x64) uniquement pour l'instant.
- L'interface est en français ; l'anglais et l'espagnol sont traduits en partie.
- Si votre fournisseur refuse la connexion, TVNest vous dit pourquoi (identifiants incorrects, abonnement expiré, trop de connexions…).

## Compiler depuis les sources

Prérequis : Node.js (voir `.nvmrc`), pnpm 10 et Visual Studio Build Tools (module natif mpv).

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

<details>
<summary>Intégration continue</summary>

Le workflow [`build-windows.yml`](.github/workflows/build-windows.yml) tourne sur un runner Windows x64 auto-hébergé :

- push sur `master` ou lancement manuel : installeur copié sur la machine du runner, dans le dossier `TVNEST_INSTALLERS_DIR` défini dans le fichier `.env` du runner ;
- tag `v*` : installeur publié dans une Release GitHub, utilisée par la mise à jour automatique.

</details>

## Crédits et licence

TVNest est un projet de **Steven K.**, basé sur [IPTVnator](https://github.com/4gray/iptvnator) de 4gray (licence MIT) : le backend Electron, la base de données et le lecteur mpv d'origine sont conservés, l'interface a été entièrement refaite en React.

[MIT](LICENSE.md). Le nom et le logo « IPTVnator » appartiennent à leur auteur et ne sont pas utilisés comme identité de ce projet (voir [TRADEMARK.md](TRADEMARK.md)).
