# Studio Fritz — website

Static site. No build step, no dependencies: HTML, CSS and vanilla JS served
straight from disk.

```
index.html          the homepage
css/style.css       all styling
js/main.js          header scroll sequence + carousels
images/             photography, video, logos
```

## Running it locally

1. Open this folder in VS Code (File → Open Folder).
2. Install the **Live Server** extension (Ritwick Dey) if it isn't already.
3. Right-click `index.html` → **Open with Live Server**.

It opens at `127.0.0.1:5500`. Live Server reloads on save, so leave it running
while you work.

## Working across two machines

The repo is the source of truth, not any one laptop. Do not put this folder in
Google Drive, Dropbox or iCloud Drive — those sync the many small files inside
`.git` independently and mid-write, which corrupts the history.

Start of a session, before touching anything:

```bash
git pull
```

End of a session, or any time you want the work safe:

```bash
git add -A
git commit -m "what changed"
git push
```

If `git pull` complains that you have local changes, commit them first, then
pull. If it reports a conflict, stop and ask Claude rather than resolving it by
hand — conflicts in CSS are easy to silently half-fix.

## Design source of truth

Figma file `5Cn1sXHUVREVMKGLUWM2WF`, page **Web**. Measurements come from the
Figma node data, never from measuring a screenshot — screenshots are scaled and
produce wrong numbers.

Layout scales from a single token, `--u` in `css/style.css`, which equals one
Figma pixel at the 1440px reference width. Sizes are written as
`calc(83 * var(--u))` rather than `83px` so the whole composition scales as one
unit instead of drifting apart.

Notes on the header scroll architecture, the deliberate departures from Figma,
and the open mobile-breakpoint question live in the Claude project doc
`claude/header-scroll-architecture.md`.

## Not yet built

Mobile. The rules under `@media (max-width: 900px)` are a placeholder, not a
design — mobile gets its own mobile-first pass.
