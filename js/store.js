/*
 * State for the whole app.
 *
 * Two levels:
 *   items[]  — the closet. Everything you own. Not tied to any trip.
 *   trips[]  — each trip picks a shortlist of closet items (itemIds) and keeps
 *              its own looks, calendar and packing state.
 *
 * All of it lives in one localStorage key, so the app works offline.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;
  const KEY = 'paris-outfit-planner/v1';

  /* The closet's shelves. Bottoms are split by kind rather than lumped
     together, because "what trousers do I have" and "what skirts do I have"
     are two different questions when you are packing. */
  const CATEGORIES = [
    { id: 'tops', label: 'Tops', subtypes: ['Sleeveless', 'Short-sleeve', 'Long-sleeve', 'Shirt', 'Sweater'] },
    { id: 'jeans', label: 'Jeans', subtypes: ['Straight leg', 'Wide leg', 'Baggy', 'Skinny', 'Bootcut', 'Flare'] },
    { id: 'pants', label: 'Pants & Trousers', subtypes: ['Tailored', 'Wide leg', 'Cargo', 'Leather', 'Linen'] },
    { id: 'shorts', label: 'Shorts', subtypes: ['Denim', 'Tailored', 'Micro', 'Bermuda'] },
    { id: 'skirts', label: 'Skirts', subtypes: ['Mini', 'Midi', 'Maxi', 'Denim'] },
    { id: 'dresses', label: 'Dresses', subtypes: ['Day dress', 'Evening dress', 'Jumpsuit'] },
    { id: 'outerwear', label: 'Outerwear', subtypes: ['Blazer', 'Coat', 'Jacket', 'Trench'] },
    { id: 'shoes', label: 'Shoes', subtypes: ['Flats', 'Heels', 'Boots', 'Trainers'] },
    { id: 'bags', label: 'Bags', subtypes: ['Day bag', 'Evening bag', 'Tote'] },
    { id: 'accessories', label: 'Accessories', subtypes: ['Scarf', 'Jewellery', 'Belt', 'Hat', 'Sunglasses', 'Hosiery'] },
    { id: 'activewear', label: 'Activewear', subtypes: ['Sports bra', 'Leggings', 'Shorts', 'Top', 'Jacket'] },
    { id: 'swim', label: 'Swim', subtypes: ['Bikini top', 'Bikini bottom', 'One-piece', 'Cover-up'] },
    { id: 'sleep', label: 'Pyjamas & Loungewear', subtypes: ['Pyjamas', 'Robe', 'Nightdress', 'Lounge set'] },
    { id: 'underwear', label: 'Underwear & Bras', subtypes: ['Bra', 'Bralette', 'Briefs', 'Thong', 'Shapewear'] },
    // A catch-all so an imported piece whose kind we could not work out still
    // shows up in the closet instead of quietly going missing.
    { id: 'other', label: 'Other', subtypes: [] }
  ];

  /* Places that still think in terms of "a bottom" — the outfit builder's
     lower-half slot, the combination grid, the capsule maths — ask for the
     group and get all four shelves back. */
  const GROUPS = {
    bottoms: ['jeans', 'pants', 'shorts', 'skirts']
  };

  /* A category id, or a group id, to the list of shelves it covers. */
  function expand(id) {
    return GROUPS[id] || [id];
  }

  const BAGS = [
    { id: 'carry', label: 'Carry-on' },
    { id: 'checked', label: 'Checked bag' },
    { id: 'personal', label: 'Personal item' }
  ];

  function newTrip(patch) {
    return Object.assign({
      id: util.uid('trip'),
      name: 'New trip',
      start: '',
      end: '',
      itemIds: [],
      outfits: [],
      days: {},
      packing: {},
      weather: null,
      createdAt: Date.now()
    }, patch || {});
  }

  function parisTrip() {
    return newTrip({
      id: 'trip-paris-2026',
      name: 'Paris · Fashion Week',
      start: '2026-09-26',
      end: '2026-10-08'
    });
  }

  /* Identifies a starter-wardrobe piece across seed updates. The same product
     photo can cover two sizes of one piece, so the size counts too. */
  function seedKey(item) {
    return [(item && item.photoUrl) || '', item && item.name, item && item.brand, item && item.size]
      .map(function (part) { return String(part || '').toLowerCase().trim(); }).join('|');
  }

  function defaultState() {
    const paris = parisTrip();
    return {
      version: 3,
      items: [],
      trips: [paris],
      activeTripId: paris.id,
      ui: {}
    };
  }

  let state = defaultState();
  const listeners = [];

  /* v2 kept every lower-half piece on one "bottoms" shelf and put swimwear in
     with the pyjamas. Work out which of the new shelves each one belongs on
     from its own name, so a closet saved before the split comes back sorted. */
  const RESHELVE = [
    ['skirts', /\b(skirts?|skorts?)\b/],
    ['shorts', /\b(shorts?|jorts?)\b(?!\s*sleeve)/],
    ['jeans', /\b(jeans?|denim)\b/],
    ['pants', /.*/]
  ];
  const SWIMWEAR = /\b(swim\w*|bikinis?|tankinis?|one[- ]piece|cover[- ]ups?|bathing ?suits?|rash ?guards?|board shorts?)\b/;

  function reshelve(item) {
    const text = ((item && item.name) || '') + ' ' + ((item && item.subtype) || '');
    if (item.category === 'sleepswim') {
      return SWIMWEAR.test(text.toLowerCase()) ? 'swim' : 'sleep';
    }
    if (item.category !== 'bottoms') return item.category;
    // A bathing suit is not a pair of trousers, whatever shelf it was on.
    if (SWIMWEAR.test(text.toLowerCase())) return 'swim';
    const hit = RESHELVE.filter(function (rule) { return rule[1].test(text.toLowerCase()); })[0];
    return hit ? hit[0] : 'pants';
  }

  /* A piece that arrives naming a shelf we no longer have — an old backup, an
     order file written against the previous scheme — is re-filed rather than
     left invisible in the closet. */
  function normalizeCategory(item) {
    const id = item && item.category;
    if (CATEGORIES.some(function (c) { return c.id === id; })) return id;
    if (id === 'bottoms' || id === 'sleepswim') return reshelve(item);
    return 'other';
  }

  function migrateShelves(parsed) {
    if (!parsed) return parsed;
    (Array.isArray(parsed.items) ? parsed.items : []).forEach(function (item) {
      item.category = normalizeCategory(item);
    });
    parsed.version = 3;
    return parsed;
  }

  /* v1 kept a single trip's outfits/days/packing at the top level. */
  function migrate(parsed) {
    if (!parsed || parsed.version >= 2) return migrateShelves(parsed);
    const trip = newTrip({
      id: 'trip-paris-2026',
      name: (parsed.trip && parsed.trip.name) || 'Paris · Fashion Week',
      start: (parsed.trip && parsed.trip.start) || '2026-09-26',
      end: (parsed.trip && parsed.trip.end) || '2026-10-08',
      outfits: Array.isArray(parsed.outfits) ? parsed.outfits : [],
      days: parsed.days || {},
      packing: parsed.packing || {},
      weather: parsed.weather || null
    });
    // Everything already in the closet was, by definition, for this trip.
    trip.itemIds = (Array.isArray(parsed.items) ? parsed.items : []).map(function (i) { return i.id; });
    return migrateShelves({
      version: 2,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      trips: [trip],
      activeTripId: trip.id,
      ui: parsed.ui || {}
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = migrate(JSON.parse(raw));
      const merged = Object.assign(defaultState(), parsed);
      merged.items = Array.isArray(parsed.items) ? parsed.items : [];
      merged.trips = Array.isArray(parsed.trips) && parsed.trips.length ? parsed.trips : [parisTrip()];
      merged.trips = merged.trips.map(function (t) { return Object.assign(newTrip(), t); });
      if (!merged.trips.some(function (t) { return t.id === merged.activeTripId; })) {
        merged.activeTripId = merged.trips[0].id;
      }
      return merged;
    } catch (err) {
      console.warn('Could not read saved data; starting fresh.', err);
      return defaultState();
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      util.toast('Out of browser storage — remove a few photos or export a backup.');
      console.error('Save failed', err);
      return false;
    }
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (err) { console.error(err); }
    });
  }

  function update(mutator) {
    mutator(state);
    persist();
    emit();
  }

  const store = {
    CATEGORIES: CATEGORIES,
    GROUPS: GROUPS,
    BAGS: BAGS,
    expand: expand,

    get() { return state; },
    subscribe(fn) { listeners.push(fn); },

    /* Small scraps of interface state that should survive a refresh. */
    ui() { return state.ui; },
    setUI(patch) {
      update(function (s) { s.ui = Object.assign({}, s.ui, patch); });
    },
    update: update,

    /* Which shelf a piece belongs on, given whatever its file says. */
    shelfFor(item) { return normalizeCategory(item); },

    category(id) {
      return CATEGORIES.filter(function (c) { return c.id === id; })[0] || null;
    },

    /* ---- trips -------------------------------------------------------- */

    trips() { return state.trips; },

    trip() {
      return state.trips.filter(function (t) { return t.id === state.activeTripId; })[0] || state.trips[0];
    },

    setActiveTrip(id) {
      update(function (s) {
        if (s.trips.some(function (t) { return t.id === id; })) s.activeTripId = id;
      });
    },

    createTrip(patch) {
      const trip = newTrip(patch);
      update(function (s) {
        s.trips.push(trip);
        s.activeTripId = trip.id;
      });
      return trip.id;
    },

    updateTrip(patch, tripId) {
      update(function (s) {
        const id = tripId || s.activeTripId;
        const index = s.trips.findIndex(function (t) { return t.id === id; });
        if (index > -1) s.trips[index] = Object.assign({}, s.trips[index], patch);
      });
    },

    deleteTrip(id) {
      update(function (s) {
        if (s.trips.length <= 1) return;
        s.trips = s.trips.filter(function (t) { return t.id !== id; });
        if (s.activeTripId === id) s.activeTripId = s.trips[0].id;
      });
    },

    /* ---- the closet (global) ------------------------------------------ */

    itemById(id) {
      return state.items.filter(function (i) { return i.id === id; })[0] || null;
    },

    /*
     * When a piece entered the wardrobe: the date of the order it came from,
     * or failing that when it was added by hand. Used to show the newest
     * things first on every shelf.
     */
    orderedTime(item) {
      if (item && item.orderedAt) {
        const t = Date.parse(item.orderedAt);
        if (!isNaN(t)) return t;
      }
      return (item && item.createdAt) || 0;
    },

    /* Newest first, then by name so the order never jitters between renders. */
    byRecency(items) {
      return items.slice().sort(function (a, b) {
        const diff = store.orderedTime(b) - store.orderedTime(a);
        if (diff) return diff;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    },

    /* Accepts a category id or a group id ("bottoms"). */
    closetIn(categoryId) {
      const ids = expand(categoryId);
      return state.items.filter(function (i) { return ids.indexOf(i.category) > -1; });
    },

    saveItem(draft) {
      let savedId = draft.id;
      update(function (s) {
        if (draft.id) {
          const index = s.items.findIndex(function (i) { return i.id === draft.id; });
          if (index > -1) {
            const merged = Object.assign({}, s.items[index], draft);
            merged.category = normalizeCategory(merged);
            s.items[index] = merged;
          }
        } else {
          savedId = util.uid('item');
          s.items.push(Object.assign({
            id: savedId,
            name: 'Untitled',
            brand: '',
            size: '',
            retailer: '',
            archived: false,
            status: 'have',   // 'have' = in your hands, 'ontheway' = ordered
            eta: '',          // expected arrival, ISO date

            category: 'tops',
            subtype: '',
            color: '#141414',
            colorName: '',
            photo: '',        // a data URL the user added
            photoUrl: '',     // a remote product image from an order
            link: '',
            source: 'manual',
            agency: false,
            time: 'both',
            createdAt: Date.now()
          }, draft, { id: savedId }));
          const added = s.items[s.items.length - 1];
          added.category = normalizeCategory(added);
        }
      });
      return savedId;
    },

    deleteItem(id) {
      update(function (s) {
        s.items = s.items.filter(function (i) { return i.id !== id; });
        s.trips.forEach(function (trip) {
          trip.itemIds = trip.itemIds.filter(function (i) { return i !== id; });
          delete trip.packing[id];
          trip.outfits.forEach(function (outfit) {
            Object.keys(outfit.slots).forEach(function (slot) {
              if (slot === 'accessories') {
                outfit.slots.accessories = (outfit.slots.accessories || []).filter(function (a) { return a !== id; });
              } else if (outfit.slots[slot] === id) {
                outfit.slots[slot] = null;
              }
            });
          });
        });
      });
    },

    /*
     * Archive, rather than delete.
     *
     * An archived piece stays in the closet's records - with its photo, brand
     * and history - but drops out of every trip, the builder and the packing
     * list. It is the honest answer for something returned, lent out, or simply
     * not in rotation, and it is reversible.
     */
    setArchived(ids, archived) {
      const set = {};
      ids.forEach(function (id) { set[id] = true; });
      update(function (s) {
        s.items.forEach(function (item) {
          if (set[item.id]) item.archived = Boolean(archived);
        });
        if (!archived) return;
        // An archived piece cannot stay on a trip or inside its looks.
        s.trips.forEach(function (trip) {
          trip.itemIds = trip.itemIds.filter(function (i) { return !set[i]; });
          trip.outfits.forEach(function (outfit) {
            Object.keys(outfit.slots).forEach(function (slot) {
              if (slot === 'accessories') {
                outfit.slots.accessories = (outfit.slots.accessories || []).filter(function (a) { return !set[a]; });
              } else if (set[outfit.slots[slot]]) {
                outfit.slots[slot] = null;
              }
            });
          });
        });
      });
    },

    /*
     * Will an ordered piece actually arrive before the trip?
     *
     *   ok      - lands with a day or more to spare
     *   tight   - lands the day before you leave, or the day you leave
     *   late    - lands after you have gone
     *   unknown - on the way, but no arrival date recorded
     *
     * Returns null for anything already in your hands.
     */
    arrivalRisk(item, tripStart) {
      if (!item || item.status !== 'ontheway') return null;
      const start = tripStart || store.trip().start;
      if (!item.eta || !start) return 'unknown';
      const days = Math.round(
        (util.parseISO(start) - util.parseISO(item.eta)) / 86400000
      );
      if (isNaN(days)) return 'unknown';
      if (days < 0) return 'late';
      if (days <= 1) return 'tight';
      return 'ok';
    },

    /* Pieces on the trip that may not arrive in time. */
    atRiskForTrip() {
      return store.tripItems().filter(function (item) {
        const risk = store.arrivalRisk(item);
        return risk === 'late' || risk === 'tight' || risk === 'unknown';
      });
    },

    onTheWayCount() {
      return state.items.filter(function (i) { return !i.archived && i.status === 'ontheway'; }).length;
    },

    archivedCount() {
      return state.items.filter(function (i) { return i.archived; }).length;
    },

    /* Remove several pieces at once - pruning a seeded or imported closet. */
    deleteItems(ids) {
      const set = {};
      ids.forEach(function (id) { set[id] = true; });
      update(function (s) {
        s.items = s.items.filter(function (i) { return !set[i.id]; });
        s.trips.forEach(function (trip) {
          trip.itemIds = trip.itemIds.filter(function (i) { return !set[i]; });
          ids.forEach(function (id) { delete trip.packing[id]; });
          trip.outfits.forEach(function (outfit) {
            Object.keys(outfit.slots).forEach(function (slot) {
              if (slot === 'accessories') {
                outfit.slots.accessories = (outfit.slots.accessories || []).filter(function (a) { return !set[a]; });
              } else if (set[outfit.slots[slot]]) {
                outfit.slots[slot] = null;
              }
            });
          });
        });
      });
    },

    /* Add several items at once (the order importer). */
    addItems(drafts) {
      const ids = [];
      update(function (s) {
        drafts.forEach(function (draft) {
          const id = util.uid('item');
          ids.push(id);
          s.items.push(Object.assign({
            id: id, name: 'Untitled', brand: '', size: '', retailer: '', archived: false,
            status: 'have', eta: '', category: 'tops', subtype: '',
            color: '#141414', colorName: '', photo: '', photoUrl: '', link: '',
            source: 'import', agency: false, time: 'both', createdAt: Date.now()
          }, draft, { id: id }));
          const added = s.items[s.items.length - 1];
          added.category = normalizeCategory(added);
        });
      });
      return ids;
    },

    /* Does the closet already hold this piece? Used to skip duplicate imports. */
    findDuplicate(draft) {
      const key = function (i) {
        return String(i.name || '').toLowerCase().trim() + '|' +
               String(i.brand || '').toLowerCase().trim() + '|' +
               String(i.size || '').toLowerCase().trim();
      };
      const target = key(draft);
      return state.items.filter(function (i) { return key(i) === target; })[0] || null;
    },

    /* ---- the trip's shortlist ------------------------------------------ */

    inTrip(itemId) {
      return store.trip().itemIds.indexOf(itemId) > -1;
    },

    toggleTripItem(itemId) {
      update(function (s) {
        const trip = s.trips.filter(function (t) { return t.id === s.activeTripId; })[0];
        if (!trip) return;
        const index = trip.itemIds.indexOf(itemId);
        if (index > -1) trip.itemIds.splice(index, 1);
        else trip.itemIds.push(itemId);
      });
    },

    setTripItems(ids) {
      update(function (s) {
        const trip = s.trips.filter(function (t) { return t.id === s.activeTripId; })[0];
        if (trip) trip.itemIds = ids.slice();
      });
    },

    /* Items shortlisted for the trip — what the builder and matrix work from. */
    tripItems() {
      const trip = store.trip();
      return trip.itemIds.map(store.itemById).filter(function (i) { return i && !i.archived; });
    },

    tripItemsIn(categoryId) {
      const ids = expand(categoryId);
      return store.tripItems().filter(function (i) { return ids.indexOf(i.category) > -1; });
    },

    /* ---- looks (per trip) ----------------------------------------------- */

    outfits() { return store.trip().outfits; },

    outfitById(id) {
      return store.outfits().filter(function (o) { return o.id === id; })[0] || null;
    },

    outfitItems(outfit) {
      if (!outfit) return [];
      const slots = outfit.slots || {};
      const ids = [slots.top, slots.bottom, slots.dress, slots.outerwear, slots.shoes, slots.bag]
        .concat(slots.accessories || []);
      return ids.filter(Boolean).map(store.itemById).filter(Boolean);
    },

    saveOutfit(draft) {
      let savedId = draft.id;
      update(function (s) {
        const trip = s.trips.filter(function (t) { return t.id === s.activeTripId; })[0];
        if (!trip) return;
        if (draft.id) {
          const index = trip.outfits.findIndex(function (o) { return o.id === draft.id; });
          if (index > -1) trip.outfits[index] = Object.assign({}, trip.outfits[index], draft);
        } else {
          savedId = util.uid('fit');
          trip.outfits.push(Object.assign({
            id: savedId, name: 'Untitled look', tag: '',
            slots: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null, accessories: [] },
            createdAt: Date.now()
          }, draft, { id: savedId }));
        }
      });
      return savedId;
    },

    deleteOutfit(id) {
      update(function (s) {
        const trip = s.trips.filter(function (t) { return t.id === s.activeTripId; })[0];
        if (!trip) return;
        trip.outfits = trip.outfits.filter(function (o) { return o.id !== id; });
        Object.keys(trip.days).forEach(function (date) {
          const entry = trip.days[date];
          if (entry.day === id) entry.day = null;
          if (entry.night === id) entry.night = null;
        });
      });
    },

    /* How many of this trip's looks use the piece. */
    usageCount(itemId) {
      return store.outfits().filter(function (outfit) {
        return store.outfitItems(outfit).some(function (i) { return i.id === itemId; });
      }).length;
    },

    /* How many looks across every trip use it — the closet's own measure. */
    closetUsage(itemId) {
      let total = 0;
      state.trips.forEach(function (trip) {
        trip.outfits.forEach(function (outfit) {
          const ids = [outfit.slots.top, outfit.slots.bottom, outfit.slots.dress, outfit.slots.outerwear,
            outfit.slots.shoes, outfit.slots.bag].concat(outfit.slots.accessories || []);
          if (ids.indexOf(itemId) > -1) total++;
        });
      });
      return total;
    },

    packedItems() {
      return store.tripItems().filter(function (item) { return store.usageCount(item.id) > 0; });
    },

    /* ---- days ------------------------------------------------------------ */

    tripDates() {
      const trip = store.trip();
      return util.datesBetween(trip.start, trip.end);
    },

    day(date) {
      return store.trip().days[date] || { agency: false, day: null, night: null };
    },

    setDay(date, patch) {
      update(function (s) {
        const trip = s.trips.filter(function (t) { return t.id === s.activeTripId; })[0];
        if (!trip) return;
        trip.days[date] = Object.assign({ agency: false, day: null, night: null }, trip.days[date], patch);
      });
    },

    agencyDates() {
      return store.tripDates().filter(function (date) { return store.day(date).agency; });
    },

    repeatedOutfits() {
      const counts = {};
      store.tripDates().forEach(function (date) {
        const entry = store.day(date);
        ['day', 'night'].forEach(function (slot) {
          if (entry[slot]) counts[entry[slot]] = (counts[entry[slot]] || 0) + 1;
        });
      });
      return Object.keys(counts).filter(function (id) { return counts[id] > 1; });
    },

    /* ---- packing ---------------------------------------------------------- */

    packingFor(itemId) {
      return store.trip().packing[itemId] || { bag: 'checked', packed: false };
    },

    setPacking(itemId, patch) {
      update(function (s) {
        const trip = s.trips.filter(function (t) { return t.id === s.activeTripId; })[0];
        if (!trip) return;
        trip.packing[itemId] = Object.assign({ bag: 'checked', packed: false }, trip.packing[itemId], patch);
      });
    },

    /* ---- weather (cached per trip) ----------------------------------------- */

    weather() { return store.trip().weather; },

    setWeather(weather) {
      update(function (s) {
        const trip = s.trips.filter(function (t) { return t.id === s.activeTripId; })[0];
        if (trip) trip.weather = weather;
      });
    },

    /*
     * Apply the bundled starter wardrobe.
     *
     * Every piece is applied at most once per browser, remembered by key, so
     * deleting a seeded piece - or erasing everything - sticks instead of
     * silently coming back on the next load. Pieces added to the seed later
     * still arrive, because their key has not been applied yet.
     */
    seedIfEmpty() {
      const seed = PT.SEED;
      if (!seed || !Array.isArray(seed.items) || !seed.items.length) return 0;

      // A browser seeded before keys were recorded: treat whatever it already
      // holds as applied, so nothing it kept or deleted comes back doubled.
      if (state.ui.seeded && !state.ui.seededKeys) {
        const known = state.items.map(seedKey);
        update(function (s) { s.ui.seededKeys = known; });
      }

      const applied = state.ui.seededKeys || [];
      const fresh = seed.items.filter(function (item) {
        return applied.indexOf(seedKey(item)) === -1;
      });
      if (!fresh.length) return 0;

      const ids = store.addItems(fresh);
      update(function (s) {
        s.ui.seeded = true;
        s.ui.seededKeys = applied.concat(fresh.map(seedKey));
      });
      return ids.length;
    },

    /* ---- backup ------------------------------------------------------------ */

    exportJSON() { return JSON.stringify(state, null, 2); },

    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
        throw new Error('That file is not a planner backup.');
      }
      const next = migrate(parsed);
      update(function (s) {
        Object.keys(defaultState()).forEach(function (key) {
          if (key in next) s[key] = next[key];
        });
      });
    },

    clearAll() {
      update(function (s) {
        const fresh = defaultState();
        Object.keys(fresh).forEach(function (key) { s[key] = fresh[key]; });
        // Erasing is deliberate: do not let the starter wardrobe reappear.
        s.ui.seeded = true;
        s.ui.seededKeys = (PT.SEED && PT.SEED.items || []).map(seedKey);
      });
    },

    storageBytes() {
      try { return (localStorage.getItem(KEY) || '').length; } catch (err) { return 0; }
    }
  };

  state = load();
  PT.store = store;
})();
