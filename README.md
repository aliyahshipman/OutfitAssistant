# Paris Trip · Outfit Planner

A single-page planner for a capsule wardrobe: photograph what you own, build
looks from it, see every combination those pieces actually produce, assign
looks to days, and pack only what earned its place.

Built for **26 September – 8 October 2026**, including five agency days during
Paris Fashion Week. No backend, no accounts, no build step — open
`index.html` and it works, including offline.

## Running it

**On your laptop:** double-click `index.html`. That is the whole setup.

**Hosted (optional):** see [Hosting on Netlify](#hosting-on-netlify) below.

## The five sections

**Closet** — Add each piece with a name, colour, photo, an *agency-appropriate*
tag, and a *day / night / both* tag. Filter the grid by category, colour,
agency, or time of day. Photos come straight from your camera roll.

**Outfit Builder** — Tap a slot in the flat lay to fill it. Pieces are ordered
by how well they sit with what you have already chosen, and badged **Match**,
**Works** or **Clash**, so you never have to decide what goes together. A dress
locks out the top and bottom slots automatically. *Suggest a look* builds a
complete, colour-coherent outfit from whatever is in the closet. Saved looks
feed the calendar and the packing list.

**Combinations** — Every top × bottom pairing in one grid, showing which
pairings work and which you have already saved as a look. The counters tell you
how many distinct looks a small wardrobe is really producing. Below the grid,
any piece appearing in fewer than two saved looks is flagged — that is the
piece not earning its space in the suitcase. Tap any cell to build that pairing.

**Day by Day** — One tile per date of the trip, each split into a day look and
a night look. Mark the agency days. Drag a look from the rail onto a tile, or
tap a slot to choose one. You get warned when the same look is worn twice, when
an agency day contains a piece you have not tagged agency-appropriate, and when
days are still unplanned.

**Packing** — Builds itself from your saved looks: a piece only appears once it
is in at least one outfit. Assign each to carry-on, checked bag or personal
item, and tick it off as you physically pack. Everything that never made it
into a look is listed separately as *Staying home*. **Print** gives a clean
printable list; **Save as page** downloads a self-contained HTML file you can
open anywhere or send to someone.

## Trip dates

Settings holds the trip name and dates, and the calendar follows them. Note
that 26 September – 8 October inclusive is **13 dates**, not 12 — if you want
exactly twelve tiles, set the last day to 7 October. The tab label always shows
the real count.

## Your data

Everything is stored in your browser's `localStorage` under a single key, on
the one device and browser you used. It is never sent anywhere, and the app
works with no network connection.

Two consequences worth knowing:

- **Clearing your browsing data erases the plan.** Use *Settings → Export
  backup* to save a JSON file first; *Import backup* restores it, photos
  included. This is also how you move the plan to another laptop or from the
  local file to a hosted copy.
- **Storage is finite** (roughly 5 MB). Photos are automatically downscaled to
  620px JPEGs on import — a typical photo lands around 30–60 KB — so a capsule
  wardrobe fits comfortably. The footer shows how much you have used and turns
  red as you approach the limit.

## Weather

The masthead shows Paris weather for the trip from
[Open-Meteo](https://open-meteo.com) (no API key). The forecast only reaches
about 16 days out, so any date beyond that falls back to late-September /
early-October climate normals, labelled *Seasonal average*. The last forecast
is cached, so the strip still shows something sensible offline.

## Hosting on Netlify

The repo is a static site, so Netlify needs no build configuration —
`netlify.toml` sets the publish directory to the repo root and leaves the build
command empty.

- **From Git:** in Netlify, *Add new site → Import an existing project*, pick
  this repository, and deploy. No build command, publish directory `.`.
- **Without Git:** drag the project folder onto the Netlify drop zone.

One thing to expect: `localStorage` is scoped to an origin, so a plan built by
opening `index.html` locally will **not** appear on the Netlify URL, and vice
versa. Move it across with *Settings → Export backup* and then *Import backup*
on the hosted site. Pick one home for the plan and stay there.

The hosted page is public to anyone who has the URL, but your closet is not —
the data lives in your browser, not on the server. Netlify's *Site
configuration → Access control → Password protection* adds a password if you
would rather the page itself not be public.

## Project layout

```
index.html        markup shell and script order
css/styles.css    all styling, including print and mobile
js/util.js        DOM helpers, photo downscaling, modal and toast
js/colors.js      colour model and the pairing-score rules
js/store.js       state, localStorage persistence, derived stats
js/closet.js      closet grid, filters, add/edit form
js/builder.js     flat lay, suggestions, saved looks
js/matrix.js      combination grid and underused-piece flags
js/calendar.js    day tiles, agency days, drag-and-drop assignment
js/packing.js     derived packing list, luggage, printable export
js/weather.js     Open-Meteo fetch, caching, seasonal fallback
js/app.js         tab routing, masthead, settings, backup
```

Plain ES5-compatible scripts with no modules or bundler, deliberately: it means
the app runs from `file://` with nothing installed.
