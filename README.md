# Fiverr Gig Scraper

A personal Chromium extension (Manifest V3, tested in Brave) for researching Fiverr
gigs and seller profiles. It saves publicly visible on-page data (packages, reviews,
FAQ, skills, services, work experience and more) as clean Markdown files for
personal competitive research.

## Purpose

Built for personal market research when planning a new Fiverr gig: comparing pricing,
features and positioning across established sellers in a niche before launching.
**Not intended for redistribution, resale, or automated bulk scraping of Fiverr.**
Use responsibly and in line with Fiverr's Terms of Service.

## How it works

1. On a gig page a green **Save Gig** button appears bottom-right; on a seller
   profile page a dark **Save Profile** button appears.
2. Clicking it scrapes the page and stores the result in `chrome.storage.local`,
   grouped by seller. The button then shows a "saved" animation and an
   "Already saved" look. Clicking it again re-scrapes and overwrites.
3. The toolbar popup lists everything saved: search, category chips, select,
   view, copy Markdown, open on Fiverr, download and delete. "Download all"
   writes one combined `.md` file per seller.
4. Fiverr is a single-page app, so the buttons are added and removed as you
   navigate, without a page reload.

### Incomplete scrapes

Fiverr changes its page layout often and serves more than one layout. After every
gig scrape `checkGigCompleteness()` lists the sections that came back empty
(seller name, seller details, description, package prices, reviews, category,
and reviews or review prices that are only partly loaded). FAQ, tags and package
features are not checked, because some gigs legitimately have none.

An incomplete gig is saved anyway, with its warnings and a page diagnostic. The
button reads "Gig saved (incomplete)", and the gig shows a yellow warning icon in
the popup. Clicking the icon copies the diagnostic (selector counts, class-name
inventories and HTML snippets), which is enough to fix the parser without any
manual console work.

### Layouts supported

- Seller header: text directly after the `h1` (older), or the `.seller-card`
  block (newer).
- Description: `.description-wrapper` (older), or found from the "About this Gig"
  heading with its "Read More" expanded (newer).
- Packages: the Basic/Standard/Premium comparison table, or the tabbed /
  single-package order box.

## Structure

```
manifest.json
src/
  content-main.js            buttons, scrape -> store, saved state, SPA polling
  ui/
    widget.js                floating pill button, saved animation, page detection
  parsers/
    gig-parsers.js           gig page field extraction (both layouts)
    single-package-parser.js tabbed / single package order box
    profile-parsers.js       seller profile extraction (skills, services, work experience)
    diagnostics.js           completeness check + diagnostic report
  markdown/
    gig-markdown.js          builds the gig .md
    profile-markdown.js      builds the profile .md
  background/
    background.js            stores items; forces download filenames
  popup/
    popup.html               popup UI and styles
    popup.js                 popup logic and Blob downloads
```

Script load order is set in `manifest.json` (`content_scripts.js`); the parsers and
markdown builders are plain globals shared by `content-main.js`.

## Install (unpacked, for local/personal use)

1. Clone this repo.
2. Open `brave://extensions` (or `chrome://extensions`).
3. Turn on Developer mode.
4. Click "Load unpacked" and select the project folder.
5. Open any Fiverr gig or seller profile page. A button appears bottom-right.

After reloading the extension, hard-refresh the Fiverr tab (Ctrl+Shift+R), or the
old page script will report "Extension context invalidated".

## Output files

- Gig: `<category-path>_<seller>_<short-title>.md`
- Profile: `<seller>_profile.md`
- Combined per seller: `<seller>_combined.md`; a multi-item selection downloads as
  `<seller>_selected.md`

Names are built at download time. To avoid a Save dialog for every file, turn off
"Ask where to save each file" at `brave://settings/downloads`.

## Known limits

- Selectors depend on Fiverr's current markup and can break; use the diagnostic.
- Work experience is sorted by what each line looks like (company, employment type,
  dates, role, description), not by position.
- Some seller details (member since, response time, orders completed) aren't
  captured on the newer gig layout.
- Package feature rows are only captured where the page shows them; a feature a
  tier does not include is not distinguished on the tabbed layout.
- The red `ERR_BLOCKED_BY_CLIENT` messages in the page console come from Brave
  Shields blocking Fiverr's trackers, not from this extension.