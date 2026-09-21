/*
 * The single source of truth. Everything lives in one localStorage key, so the
 * app works offline and survives a browser restart. No backend, no accounts.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;
  const KEY = 'paris-outfit-planner/v1';

  /* Categories, in the order they are shown and stacked in a flat lay. */
  const CATEGORIES = [
    { id: 'tops', label: 'Tops', subtypes: ['Sleeveless', 'Long-sleeve', 'Sweater'] },
    { id: 'bottoms', label: 'Bottoms', subtypes: ['Jeans', 'Skirt', 'Trousers'] },
    { id: 'dresses', label: 'Dresses', subtypes: ['Day dress', 'Evening dress', 'Jumpsuit'] },
    { id: 'outerwear', label: 'Outerwear', subtypes: ['Blazer', 'Coat', 'Jacket', 'Trench'] },
    { id: 'shoes', label: 'Shoes', subtypes: ['Flats', 'Heels', 'Boots', 'Trainers'] },
    { id: 'bags', label: 'Bags', subtypes: ['Day bag', 'Evening bag', 'Tote'] },
    { id: 'accessories', label: 'Accessories', subtypes: ['Scarf', 'Jewellery', 'Belt', 'Hat', 'Sunglasses'] }
  ];

  const BAGS = [
    { id: 'carry', label: 'Carry-on' },
    { id: 'checked', label: 'Checked bag' },
    { id: 'personal', label: 'Personal item' }
  ];

  function defaultState() {
    return {
      version: 1,
      trip: { name: 'Paris', start: '2026-09-26', end: '2026-10-08' },
      items: [],
      outfits: [],
      days: {},       // ISO date -> { agency, day, night }
      packing: {},    // itemId  -> { bag, packed }
      weather: null,  // { fetchedAt, source, days: [...] }
      ui: {}
    };
  }

  let state = defaultState();
  const listeners = [];
  let lastSaveFailed = false;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const merged = Object.assign(defaultState(), parsed);
      merged.trip = Object.assign(defaultState().trip, parsed.trip || {});
      merged.items = Array.isArray(parsed.items) ? parsed.items : [];
      merged.outfits = Array.isArray(parsed.outfits) ? parsed.outfits : [];
      merged.days = parsed.days && typeof parsed.days === 'object' ? parsed.days : {};
      merged.packing = parsed.packing && typeof parsed.packing === 'object' ? parsed.packing : {};
      return merged;
    } catch (err) {
      console.warn('Could not read saved data; starting fresh.', err);
      return defaultState();
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      lastSaveFailed = false;
      return true;
    } catch (err) {
      lastSaveFailed = true;
      util.toast('Out of browser storage — delete a few photos or export a backup.');
      console.error('Save failed', err);
      return false;
    }
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (err) { console.error(err); }
    });
  }

  /* Mutate through here so every change is saved and re-rendered exactly once. */
  function update(mutator) {
    mutator(state);
    persist();
    emit();
  }

  const store = {
    CATEGORIES: CATEGORIES,
    BAGS: BAGS,

    get() { return state; },
    subscribe(fn) { listeners.push(fn); },
    update: update,
    saveFailed() { return lastSaveFailed; },

    category(id) {
      return CATEGORIES.filter(function (c) { return c.id === id; })[0] || null;
    },

    /* ---- items ----------------------------------------------------- */

    itemById(id) {
      return state.items.filter(function (i) { return i.id === id; })[0] || null;
    },

    itemsIn(categoryId) {
      return state.items.filter(function (i) { return i.category === categoryId; });
    },

    saveItem(draft) {
      update(function (s) {
        if (draft.id) {
          const index = s.items.findIndex(function (i) { return i.id === draft.id; });
          if (index > -1) s.items[index] = Object.assign({}, s.items[index], draft);
        } else {
          s.items.push(Object.assign({
            id: util.uid('item'),
            name: 'Untitled',
            category: 'tops',
            subtype: '',
            color: '#141414',
            photo: '',
            agency: false,
            time: 'both',
            createdAt: Date.now()
          }, draft));
        }
      });
    },

    deleteItem(id) {
      update(function (s) {
        s.items = s.items.filter(function (i) { return i.id !== id; });
        delete s.packing[id];
        // Drop the item from any saved outfit that used it.
        s.outfits.forEach(function (outfit) {
          Object.keys(outfit.slots).forEach(function (slot) {
            if (slot === 'accessories') {
              outfit.slots.accessories = (outfit.slots.accessories || []).filter(function (a) { return a !== id; });
            } else if (outfit.slots[slot] === id) {
              outfit.slots[slot] = null;
            }
          });
        });
      });
    },

    /* ---- outfits ---------------------------------------------------- */

    outfitById(id) {
      return state.outfits.filter(function (o) { return o.id === id; })[0] || null;
    },

    /* Every item id an outfit references, in flat-lay order. */
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
        if (draft.id) {
          const index = s.outfits.findIndex(function (o) { return o.id === draft.id; });
          if (index > -1) s.outfits[index] = Object.assign({}, s.outfits[index], draft);
        } else {
          savedId = util.uid('fit');
          s.outfits.push(Object.assign({
            id: savedId,
            name: 'Untitled look',
            tag: '',
            slots: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null, accessories: [] },
            createdAt: Date.now()
          }, draft, { id: savedId }));
        }
      });
      return savedId;
    },

    deleteOutfit(id) {
      update(function (s) {
        s.outfits = s.outfits.filter(function (o) { return o.id !== id; });
        Object.keys(s.days).forEach(function (date) {
          const entry = s.days[date];
          if (entry.day === id) entry.day = null;
          if (entry.night === id) entry.night = null;
        });
      });
    },

    /* A signature of the items in an outfit — used to spot repeats. */
    outfitSignature(outfit) {
      return store.outfitItems(outfit).map(function (i) { return i.id; }).sort().join('|');
    },

    /* How many saved outfits use this item. */
    usageCount(itemId) {
      return state.outfits.filter(function (outfit) {
        return store.outfitItems(outfit).some(function (i) { return i.id === itemId; });
      }).length;
    },

    /* Items that earn their place: used in at least one saved outfit. */
    packedItems() {
      return state.items.filter(function (item) { return store.usageCount(item.id) > 0; });
    },

    underusedItems() {
      return store.packedItems().filter(function (item) { return store.usageCount(item.id) < 2; });
    },

    /* ---- days -------------------------------------------------------- */

    tripDates() {
      return util.datesBetween(state.trip.start, state.trip.end);
    },

    day(date) {
      return state.days[date] || { agency: false, day: null, night: null };
    },

    setDay(date, patch) {
      update(function (s) {
        s.days[date] = Object.assign({ agency: false, day: null, night: null }, s.days[date], patch);
      });
    },

    agencyDates() {
      return store.tripDates().filter(function (date) { return store.day(date).agency; });
    },

    /* Outfit ids assigned more than once across the trip. */
    repeatedOutfits() {
      const counts = {};
      store.tripDates().forEach(function (date) {
        const entry = store.day(date);
        ['day', 'night'].forEach(function (slot) {
          const id = entry[slot];
          if (id) counts[id] = (counts[id] || 0) + 1;
        });
      });
      return Object.keys(counts).filter(function (id) { return counts[id] > 1; });
    },

    /* ---- packing ------------------------------------------------------ */

    packingFor(itemId) {
      return state.packing[itemId] || { bag: 'checked', packed: false };
    },

    setPacking(itemId, patch) {
      update(function (s) {
        s.packing[itemId] = Object.assign({ bag: 'checked', packed: false }, s.packing[itemId], patch);
      });
    },

    /* ---- backup -------------------------------------------------------- */

    exportJSON() {
      return JSON.stringify(state, null, 2);
    },

    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
        throw new Error('That file is not a planner backup.');
      }
      update(function (s) {
        Object.keys(defaultState()).forEach(function (key) {
          if (key in parsed) s[key] = parsed[key];
        });
      });
    },

    clearAll() {
      update(function (s) {
        const fresh = defaultState();
        Object.keys(fresh).forEach(function (key) { s[key] = fresh[key]; });
      });
    },

    /* Rough localStorage footprint, so photo budget stays visible. */
    storageBytes() {
      try { return (localStorage.getItem(KEY) || '').length; } catch (err) { return 0; }
    }
  };

  state = load();
  PT.store = store;
})();
