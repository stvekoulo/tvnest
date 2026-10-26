<p align="right"><b>English</b> · <a href="README.fr.md">Français</a></p>

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="TVNest — your IPTV subscription in a fast, cinema-style player for Windows. Supports M3U, Xtream Codes, Stalker and EPG/XMLTV.">
</p>

<p align="center">
  <a href="../../releases/latest"><img src="https://img.shields.io/github/v/release/stvekoulo/tvnest?label=Download%20for%20Windows&style=for-the-badge&color=111111&labelColor=262626" alt="Download the latest TVNest release for Windows"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-111111?style=for-the-badge&labelColor=262626" alt="Windows 10 and 11">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/License-MIT-111111?style=for-the-badge&labelColor=262626" alt="MIT license"></a>
</p>

**TVNest** turns your IPTV subscription into a desktop app that feels like a streaming service: live TV, movies and series in one dark, fast library, with a built-in player that remembers where you stopped.

> TVNest is **only a player**. It does not provide any channels, subscriptions or playlists. Bring your own.

<p align="center">
  <img src="./assets/readme/screen-movies.webp" width="100%" alt="TVNest Movies page: featured carousel, active groups panel and one row per group">
</p>

<table>
  <tr>
    <td width="33%"><img src="./assets/readme/screen-home.webp" alt="Home: featured title, groups, resume tile and rows"></td>
    <td width="33%"><img src="./assets/readme/screen-live.webp" alt="Live TV: channels sorted by group with a LIVE badge"></td>
    <td width="33%"><img src="./assets/readme/screen-movie-detail.webp" alt="Movie page with play, cinema mode and favorite buttons"></td>
  </tr>
  <tr>
    <td align="center"><sub>Home</sub></td>
    <td align="center"><sub>Live TV</sub></td>
    <td align="center"><sub>Movie page</sub></td>
  </tr>
</table>

<sub>Screenshots use fictional sample content.</sub>

## What you get

- **All your sources in one place** — M3U / M3U8 links or files, Xtream Codes accounts, Stalker portals and XMLTV guides.
- **A library that feels like streaming** — featured titles, one row per group, quick filters (language, quality, rating, year) and a global search across sources.
- **A player built for watching** — embedded mpv with audio and subtitle tracks, speed and aspect controls, live recording, keyboard shortcuts, and MPV or VLC if you prefer.
- **Pick up where you left off** — resume or restart any movie or episode, automatic next episode, history and favorites.
- **Live TV with a guide** — what's on now and next, and a day-by-day programme grid.
- **Made for the desktop** — pure black theme, responsive layout, automatic updates.

## How it works

<p align="center">
  <img src="./assets/readme/how-it-works.svg" width="100%" alt="1. Add your provider (M3U, Xtream Codes, Stalker, XMLTV). 2. TVNest builds one library on your PC. 3. Watch in the built-in player, or in MPV or VLC.">
</p>

Your catalog is imported into a local database on your PC, so browsing stays instant even with more than 100,000 titles. Your sources and credentials stay on your PC.

## Get started

1. Download `tvnest-<version>-windows-x64-setup.exe` from the [latest release](../../releases/latest) and install it.
2. Open TVNest and click **Source IPTV**.
3. Choose **Xtream**, **M3U URL**, **Fichier** (file), **Texte** (paste) or **Stalker**, then enter the details from your provider.
4. Browse Live TV, Movies and Series, and press play.

TVNest checks GitHub for new versions and updates itself.

**Good to know**

- Windows 10 and 11 (x64) only for now.
- The interface is in French. English and Spanish are partially translated.
- If your provider refuses the connection, TVNest tells you why (wrong credentials, expired subscription, too many connections…).

## Build from source

Requirements: Node.js (see `.nvmrc`), pnpm 10 and Visual Studio Build Tools (for the native mpv module).

```bash
pnpm install --frozen-lockfile
npm ci --prefix apps/web
pnpm run serve:frontend   # React interface (Vite) on http://localhost:4200
pnpm run serve:backend    # Electron app
```

Build the Windows installer locally:

```bash
pnpm run make:app -- --publishPolicy=never
```

The installer is written to `dist/executables/`.

<details>
<summary>Continuous integration</summary>

The [`build-windows.yml`](.github/workflows/build-windows.yml) workflow runs on a self-hosted Windows x64 runner:

- push to `master` or manual run: the installer is copied on the runner machine, into the `TVNEST_INSTALLERS_DIR` folder set in the runner's `.env` file;
- `v*` tag: the installer is published in a GitHub Release, which the automatic updater uses.

</details>

## Credits and license

TVNest is made by **Steven K.** It is based on [IPTVnator](https://github.com/4gray/iptvnator) by 4gray (MIT license): the original Electron backend, database and mpv player are kept, and the interface has been rebuilt in React.

[MIT](LICENSE.md). The name and logo "IPTVnator" belong to their author and are not used as this project's identity (see [TRADEMARK.md](TRADEMARK.md)).
