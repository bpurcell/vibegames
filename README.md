# Vibe Games & Experiments

A collection of browser games, interactive visualizations, music tools, and small web experiments by **Bennington Purcell**.

**Explore the site: [random.bennpurcell.com](https://random.bennpurcell.com/)**

The repository is the source for a static GitHub Pages site. Most projects use plain HTML, CSS, and JavaScript, with no repository-wide package installation or build step. Each experiment can evolve independently.

## What's here

| Area | Examples | Source |
| --- | --- | --- |
| Games | Flappy Birds, JezzBall, Minesweeper, maze and forest experiments | `flappybirds/`, `jezzball/`, `minesweeper.html`, `mazecar/`, `spookyforest/` |
| Creative tools | Komorebi drawing and equation experiments, procedural gourds | `komorebi/`, `komorebi-formula/`, `gourds/`, `chatgourdspt/` |
| Music and motion | Instrument Cabinet, theremin, gesture synth, Headbop | `instruments/`, `theremin/`, `gesturesynth/`, `headbop/` |
| Science and exploration | Wind and terrain, solar system, Earth speed, tree of life | `wind-terrain/`, `solar-system/`, `earth-speed.html`, `tree-of-life.html` |
| Data and planning | Timeline, weather records, garden planner, For Every Life | `timeline.html`, `weather-records.html`, `gardenplanner/`, `half-staff/` |

The homepage also links to separately hosted projects. Their source and deployment are not necessarily part of this repository.

## Run locally

From the repository root, with Python 3 installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://localhost:8000/), then choose an experiment. Serve the root rather than opening HTML files directly: some pages fetch local data or depend on relative asset paths.

Use a recent browser. Particular experiments may require WebGL, audio interaction, device permissions, or an internet connection for remote data. A local server does not make remote services available offline.

## Repository layout

- `index.html` — homepage and project directory.
- `shared/` — shared styles, navigation, and site assets.
- Project directories — self-contained pages, scripts, styles, and sometimes tests or bundled data.
- Root-level `.html` files — standalone experiments and some legacy entry points.
- `archive/` — retained historical material; see its dated README files.
- `tools/` — maintenance utilities, including timeline synchronization.
- `CNAME` — custom domain configuration for GitHub Pages.

Project READMEs contain more detailed controls, implementation notes, data sources, attribution, and validation instructions. Start with the README in the directory you want to change.

## Songbook

The `songs` directory contains a song reader intentionally omitted from the homepage and shared navigation. It provides search, playlist filtering, sorting, selectable arrangements, text-size controls, and continuous auto-scroll. Manual repositioning does not cancel auto-scroll.

Its chord viewer shows standard-tuning guitar diagrams with previous/next voicing controls. Diagrams are suggested fingerings, not a guarantee of the exact arrangement's fingering or tuning. Unsupported chords show an explanatory message.

JSON and text files imported through the reader are stored in that browser's local storage; they are not uploaded or synchronized. In contrast, the arrangements committed in `songs/library.js` and the bundled printbook are public repository assets. See the directory's README for the record format and import limits.

## Making changes

1. Edit the relevant project, keeping its assets and data alongside it where practical.
2. Run it through the local server and check desktop and narrow-screen layouts.
3. Exercise keyboard controls and any audio, permissions, loading, or error states affected by the change.
4. Run the project's applicable checks. Avoid changing unrelated experiments.
5. Update the project README when behavior, data sources, or maintenance steps change.

For JavaScript syntax checks, Node.js can check a changed file without running it:

```sh
node --check songs/songs.js
```

Some projects also have focused automated checks, for example:

```sh
node half-staff/core.test.cjs
node half-staff/app.test.cjs
node --test wind-terrain/geo.test.mjs wind-terrain/atmosphere.test.mjs
```

There is no single repository-wide test command. Consult each project before running its tests; some use additional tooling.

## Publishing

The existing GitHub Pages setup publishes this repository from `main`. Pushing changes to that branch updates the live site after the Pages build completes. Check the deployment status and the affected live page after publishing.

Keep `CNAME` intact unless intentionally changing the domain. Prefer relative asset links so experiments work both locally and on the deployed site.

## Public content, privacy, and reuse

This is a **public repository**. Committed files, bundled downloads, and Git history may be viewed or copied. An unlinked page or a `noindex` request is not access control. Never commit credentials, private exports, or material intended only for authenticated viewers.

Some pages contact external services or load third-party assets. Browser-local storage behavior and data provenance vary by project; consult its source and README rather than assuming every experiment is offline or has identical privacy behavior.

There is currently **no repository-wide license granting reuse rights**. Public availability does not establish permission to reuse all code, media, datasets, lyrics, or arrangements. Third-party components retain their own notices and terms; preserve the bundled license and attribution files.

The songbook includes supplied lyrics, chord arrangements, and a PDF printbook. Their redistribution permissions have not been verified. Supplying or exporting a file does not itself establish permission to publish it. Confirm the relevant permissions before treating those assets as cleared for public redistribution; this README does not grant those rights.

## Feedback

Use this repository's GitHub issues for bugs or suggestions. Include the experiment, browser/device, steps to reproduce, and what you expected. Avoid posting private data or credentials in public issues.
