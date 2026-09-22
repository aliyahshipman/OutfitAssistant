# Outfit Planner

Your wardrobe, and a tight capsule plan for every trip.

The **Closet** is the home screen: everything you own, once. A **trip** is its
own little section that borrows from it — you pick what is coming, build looks
from those pieces only, and pack what earned its place.

No backend, no accounts, no build step. Open `index.html` and it works,
including offline.

## The shape of it

```
Closet                     ← home. Everything you own.
Looks like this            ← a photo in, an outfit out of the closet.
└── Paris · Fashion Week   ← a trip. Draws on the closet.
    ├── What's coming      pick the capsule from your closet
    ├── Looks              build outfits from the picked pieces
    ├── Combinations       every top × bottom those pieces make
    ├── 13 days            assign looks to days
    └── Packing            the list, from looks you actually saved
```

Add a trip with **+** in the top nav. Trips are independent — their own looks,
calendar and packing — but they all draw on the one closet, so a piece is
described once and reused forever.

## The Closet

Each piece carries a name, brand, size, colour, photo, an *agency-appropriate*
tag and a *day / night / both* tag. Filter by category, colour, agency or time.

Shelves run **newest first**: the most recently ordered piece leads, so what
just arrived is at the top of the rail rather than buried alphabetically. Each
card names its shop and the date it was ordered. A piece added by hand counts
as ordered today. The trip picker and the packing list follow the same order.

The shelves are: **Tops · Jeans · Pants & Trousers · Shorts · Skirts · Dresses
· Outerwear · Shoes · Bags · Accessories · Activewear · Swim · Pyjamas &
Loungewear · Underwear & Bras · Other**, and each one gets its own header,
which stays put at the top of the screen while you scroll that shelf. The lower
half is four shelves rather than one because *what jeans do I have* and *what
skirts do I have* are different questions when you are packing — but the outfit
builder, the combination grid and the capsule maths still treat all four as
"a bottom", so nothing downstream had to learn the difference.

A piece whose shelf the app does not recognise — an old backup, an order file
written against an earlier version — is re-filed on the way in rather than
left invisible.

Pictures come from three places, in order: a photo you added from your camera
roll, the product image from the order it was imported from, or — failing both
— a block of the piece's own colour, so a photo-less closet still reads
visually rather than as a spreadsheet.

### Importing from your order emails

Claude can read your shop order confirmations and write them to a JSON file in
the `outfit-planner/orders@1` format. **Closet → Import from orders** takes
that file and shows every line item — picture, brand, colour, size — for
review before anything is added.

The review step is the point. An order email records what you *bought*, not
what you *kept*: returns, wrong sizes and gifts all look identical to a
receipt. Untick those. Pieces already in the closet are detected and unticked
for you.

Product images are hot-linked from the shop by default, so they need a
connection. Tick **Save pictures for offline** on import to copy them into the
file itself — this only works if the shop allows cross-origin reads, and the
app says so plainly if it doesn't.

The order file is *your* data — it holds what you bought and when. It is
deliberately not part of this repository; keep it wherever you keep personal
files.

## Looks like this

Drop in a photo you saved because you wanted to dress like it, and the app
builds the nearest version of it out of what you actually own.

Be clear about what is happening, because it is not magic and there is no
server involved. What the app reads off the picture is **colour, and which part
of the frame that colour sits in** — what is up by the shoulders, what is
around the legs, what is down at the floor. It throws away the backdrop (taken
from the corners) and skin tones, which are otherwise the largest thing in a
full-length shot and not something you can wear.

What it cannot read is the *cut*. That comes from a small library of ten
silhouettes this kind of photo keeps repeating — the off-duty uniform you see
on Bella Hadid between shows and outside every Paris Fashion Week venue: big
denim with a small top, all black with the cut doing the talking, blazer and
jeans, trench over everything, a slip dress with a blunt shoe, micro skirt and
a tall boot, show-day tailoring, leather with a fine knit, gym clothes worn
like real clothes, and one loud piece against neutrals. The app picks the
shape it thinks fits your photo and says so; one tap changes it if it guessed
wrong.

Each slot is then filled from your own closet by colour distance to that part
of your photo, whether the piece's name matches the shape, and how it sits
against everything already chosen. Every pick says why it was picked.
**Swap this** replaces one piece and leaves the rest alone; **Try another**
re-deals the whole look. **Save as a look** writes it into the trip and brings
those pieces along.

### Telling it when it is wrong

The matcher is argued with rather than configured.

**Not this** under a piece mutes it for that slot — a jumper you own but never
wear stops being offered as a Top, for good, across every silhouette. Muted
pieces are listed under *Tuned by you* with an **Unmute** next to each, so
nothing vanishes without a way back.

**Yes, this works** / **No, not it** rates the whole outfit. A yes brings those
pieces and that silhouette up next time; a no pushes them down and deals again.
Saving a look counts as a yes, because keeping something is a stronger vote
than tapping one.

It is deliberately blunt arithmetic — a running tally per piece, worth about as
much as getting the shape right. It will reorder pieces that were close to
begin with; it will not drag a colour that clashes outright to the top, because
the photo is still the brief. *Tuned by you* shows the tally, and **Forget it**
clears the lot without touching your closet or your saved looks.

The photo stays in this browser. It is downscaled, kept in `localStorage` with
everything else so the board survives a refresh, and nothing about it is sent
anywhere or looked up online. You can also build any of the ten shapes with no
photo at all, from the closet's own colours.

## A trip

**What's coming** — tap pieces from the closet to bring them. The counters show
how many distinct looks your picks can produce against how many days you are
away, which is the whole anti-overpacking argument in one line.

**Looks** — tap a slot in the flat lay to fill it. Candidates are ordered by how
well they sit with what you have already chosen and badged **Match**, **Works**
or **Clash**, so you never decide what goes together. A dress locks out the top
and bottom slots. *Suggest a look* builds a complete, colour-coherent outfit.

**Combinations** — every top × bottom pairing from the picked pieces, showing
which work and which you have already saved. Any piece in fewer than two looks
is flagged: that is the one not earning its space.

**Day by day** — one tile per date, split into a day look and a night look.
Mark the agency days. Drag a look from the rail onto a tile, or tap to choose.
You are warned about repeated looks, agency days holding untagged pieces, and
days still unplanned.

**Packing** — builds itself from saved looks. Assign each piece to carry-on,
checked bag or personal item and tick it off as you pack. Anything picked for
the trip but never worn in a look is listed as *Staying home*. **Print** gives a
clean list; **Save as page** downloads a self-contained HTML file to send on.

## Trip dates

Trip settings holds the name and dates; the calendar follows them. Note that
26 September – 8 October inclusive is **13 dates**, not 12 — set the last day to
7 October if you want exactly twelve tiles. The tab always shows the real count.

## The starter wardrobe

`js/seed.js` holds a closet that is loaded **once per piece**, per browser. It
is what makes the hosted site arrive populated on any device instead of asking
you to import something first. Each piece is remembered by name, size and
photo after it is applied, so it never arrives twice and a piece you removed
stays removed — while pieces added to the seed later still turn up on your next
visit, alongside everything you have already changed. It was generated from every shop order-confirmation email from January 2025
onwards, across REVOLVE, The RealReal, Zara, SKIMS, FWRD, Alo Yoga, Jaded London,
MOTHER and Cult Naked.

Because it comes from *orders*, it lists what was bought, not what was kept.
The closet has a **Select** mode for exactly this: tap everything you returned
or no longer own. **Archive** keeps a piece on file but out of the way, which is
the safe choice; **Remove** is permanent and the starter wardrobe never
reappears.

Four pieces arrive already archived: the mailbox holds a return request for
their orders, so they are on file rather than in the closet. If a return never
went through, **Archived → Restore** puts the piece back.

A handful of Zara confirmations split an order across several deliveries and
list only a size and a price — no product name. Those arrive as *Zara Piece
…* with their real photo attached, so they can be renamed from the picture.

Jaded London's receipts carry no product pictures at all. Their photos come
from the review request that follows each delivery — one email per piece, the
product shot tagged `alt="Product Image"` — matched back to the order by name.

It is applied once and only once: delete a seeded piece, or erase everything,
and it stays gone. Regenerate it from an order file, edit it by hand, or delete
the file (and its `<script>` tag in `index.html`) to go back to starting empty.

Note what this means — the pieces in `seed.js` are part of the deployed site.
Anyone who can open the URL, or read this repository, can read them. Keep the
repo private, or put a password on the Netlify site, if that matters to you.

## Your data

Everything lives in this browser's `localStorage` under one key, on the one
device you used. It is never sent anywhere, and the app works with no network.

- **Clearing your browsing data erases it.** Use *Closet → Settings → Export
  backup* first; *Import backup* restores it, photos included. This is also how
  you move between machines, or from the local file to a hosted copy.
- **Storage is finite** (roughly 5 MB). Camera-roll photos are downscaled to
  620px JPEGs on import — about 30–60 KB each. The footer shows usage and turns
  red near the limit.

## Weather

Inside a trip, the masthead shows that city's weather from
[Open-Meteo](https://open-meteo.com) (no API key). The forecast reaches about
16 days out; beyond that it falls back to late-September / early-October
climate normals for Paris, labelled *Seasonal average*. The last forecast is
cached per trip, so it still shows something sensible offline.

## Seeing it without hosting anything

```
node build-single-file.js
```

bundles the stylesheet and every script into `dist/outfit-planner.html` — one
self-contained file you can double-click, email to yourself, or drop onto any
host. It behaves exactly like the multi-file version; `localStorage` is keyed
per origin, so the single file keeps its own closet separate from a hosted copy
(move between them with Export/Import backup).

## Hosting on Netlify

Pushing this repo to GitHub does **not** create a website. `netlify.toml` only
tells Netlify how to serve the repo once a site exists — you still have to
create that site once:

`netlify.toml` sets the publish directory to the repo root and leaves the build
command empty.

1. Sign in at [app.netlify.com](https://app.netlify.com).
2. *Add new site → Import an existing project → GitHub*, and pick this repo.
3. Netlify reads `netlify.toml`: no build command, publish directory `.`.
   Leave the branch as the repo's default.
4. Deploy. You get a `something.netlify.app` URL in under a minute, and every
   later push redeploys it automatically.

Faster, without Git at all: run the bundle step above and drag
`dist/outfit-planner.html` onto the Netlify drop zone.

`localStorage` is scoped to an origin, so a closet built by opening
`index.html` locally will **not** appear on the Netlify URL. Move it with
*Export backup* → *Import backup*, and keep the closet in one place.

The hosted page is public to anyone with the URL, but your closet is not — the
data stays in your browser, never on the server. Netlify's *Site configuration
→ Access control → Password protection* covers the page itself.

## Project layout

```
index.html        markup shell and script order
css/styles.css    all styling, including print and mobile
js/util.js        DOM helpers, photo handling, modal and toast
js/colors.js      colour model and the pairing-score rules
js/store.js       closet + trips, localStorage, derived stats
js/closet.js      the closet grid, filters, add/edit form
js/import.js      order-file import with a review step
js/trip.js        picking a trip's capsule from the closet
js/builder.js     flat lay, suggestions, saved looks
js/matrix.js      combination grid and underused-piece flags
js/calendar.js    day tiles, agency days, drag-and-drop assignment
js/packing.js     derived packing list, luggage, printable export
js/inspo.js       photo palette reading and the reference looks
js/weather.js     Open-Meteo fetch, caching, seasonal fallback
js/seed.js        the starter wardrobe this deployment ships with
js/app.js         two-level navigation, masthead, settings, backup
```

Plain ES5-compatible scripts, no modules or bundler, so the app runs from
`file://` with nothing installed.
