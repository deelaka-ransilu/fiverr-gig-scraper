# Fiverr Gig Scraper

A personal Chrome extension for researching Fiverr gigs and seller profiles.
Scrapes publicly visible on-page data (pricing, packages, reviews, FAQ, skills,
work experience, etc.) into clean Markdown files for personal competitive research.

## Purpose

Built for personal market research when planning a new Fiverr gig — comparing
pricing, features, and positioning across established sellers in a niche before
launching. **Not intended for redistribution, resale, or automated bulk scraping
of Fiverr.** Use responsibly and in line with Fiverr's Terms of Service.

## Structure

```
manifest.json
background.js          (handles file downloads)
src/
  ui/
    widget.js           (floating button UI + label input)
  parsers/
    gig-parsers.js       (gig page field extraction)
    profile-parsers.js   (seller profile field extraction)
  markdown/
    gig-markdown.js
    profile-markdown.js
  content-main.js        (wires buttons to parsers)
```

## Install (unpacked, for local/personal use)

1. Clone this repo
2. Go to `chrome://extensions`
3. Enable Developer mode
4. Click "Load unpacked" and select the project folder
5. Visit any Fiverr gig or seller profile page — two floating buttons appear
   bottom-left (green = save gig, blue = save profile)

## Usage

- Optional: type a niche label in the small input above the buttons to prefix
  downloaded filenames (persists via localStorage during your session)
- Click the green button on a gig page to save gig details as Markdown
- Click the blue button on a seller profile page to save profile details as Markdown
