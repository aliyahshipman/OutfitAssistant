/*
 * Outfit builder: a flat lay you assemble by tapping slots. The picker sorts
 * candidates by how well they sit with what is already chosen, so matching is
 * a decision the app makes, not the user.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  const SLOTS = [
    { key: 'top', label: 'Top', category: 'tops' },
    { key: 'bottom', label: 'Bottom', category: 'bottoms' },
    { key: 'dress', label: 'Dress', category: 'dresses' },
    { key: 'outerwear', label: 'Outerwear', category: 'outerwear' },
    { key: 'shoes', label: 'Shoes', category: 'shoes' },
    { key: 'bag', label: 'Bag', category: 'bags' }
  ];
  const ACCESSORY_SLOTS = 3;

  /* Work-in-progress look. */
  let draft = emptyDraft();
  let activeSlot = null;          // 'top' | 'acc:0' | ...
  const pickerFilters = { agency: false, time: 'all' };

  function emptyDraft() {
    return {
      id: null,
      name: '',
      tag: '',
      slots: { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null, accessories: [] }
    };
  }

  function chosenItems() {
    return PT.store.outfitItems(draft);
  }

  /* Is this slot currently unavailable? A dress rules out top and bottom. */
  function slotDisabled(key) {
    if (key === 'dress') return Boolean(draft.slots.top || draft.slots.bottom);
    if (key === 'top' || key === 'bottom') return Boolean(draft.slots.dress);
    return false;
  }

  /* How well a candidate sits with everything already chosen. */
  function scoreAgainstDraft(item, excludeId) {
    const others = chosenItems().filter(function (i) { return i.id !== item.id && i.id !== excludeId; });
    if (!others.length) return 1;
    let total = 0;
    others.forEach(function (other) { total += PT.colors.pairScore(item.color, other.color); });
    return total / others.length;
  }

  function candidatesFor(slotKey) {
    const isAccessory = slotKey.indexOf('acc:') === 0;
    const categoryId = isAccessory ? 'accessories' : (SLOTS.filter(function (s) { return s.key === slotKey; })[0] || {}).category;
    if (!categoryId) return [];
    const currentId = isAccessory
      ? draft.slots.accessories[Number(slotKey.split(':')[1])]
      : draft.slots[slotKey];

    return PT.store.itemsIn(categoryId)
      .filter(function (item) {
        if (pickerFilters.agency && !item.agency) return false;
        if (pickerFilters.time !== 'all' && item.time !== pickerFilters.time && item.time !== 'both') return false;
        // An accessory already used in another accessory slot is not offered twice.
        if (isAccessory && draft.slots.accessories.indexOf(item.id) > -1 && item.id !== currentId) return false;
        return true;
      })
      .map(function (item) { return { item: item, score: scoreAgainstDraft(item, currentId) }; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  /* ---- rendering ---------------------------------------------------- */

  function slotHTML(key, label, itemId, disabled) {
    const item = itemId ? PT.store.itemById(itemId) : null;
    const classes = ['slot'];
    if (item) classes.push('slot--filled');
    if (disabled) classes.push('slot--disabled');
    return '' +
      '<div style="position:relative">' +
        (item ? '<button class="slot__clear" type="button" data-clear-slot="' + util.esc(key) + '" aria-label="Clear ' + util.esc(label) + '">&times;</button>' : '') +
        '<button class="' + classes.join(' ') + '" type="button" data-slot="' + util.esc(key) + '"' +
          (disabled ? ' disabled' : '') + ' aria-label="' + util.esc(label) + '">' +
          (item ? util.thumb(item) : '<span class="slot__label">' + util.esc(label) + '</span>') +
          (item ? '<span class="slot__tag">' + util.esc(item.name) + '</span>' : '') +
        '</button>' +
      '</div>';
  }

  function flatlayHTML() {
    const slots = SLOTS.map(function (slot) {
      return slotHTML(slot.key, slot.label, draft.slots[slot.key], slotDisabled(slot.key));
    }).join('');

    const accessories = [];
    for (let i = 0; i < ACCESSORY_SLOTS; i++) {
      accessories.push(slotHTML('acc:' + i, i === 0 ? 'Accessory' : 'Accessory ' + (i + 1), draft.slots.accessories[i], false));
    }

    const items = chosenItems();
    const score = PT.colors.harmony(items);
    const pct = Math.round(score * 100);

    return '' +
      '<div class="flatlay">' +
        '<p class="eyebrow">The flat lay</p>' +
        '<div class="flatlay__grid">' + slots + accessories.join('') + '</div>' +
        '<div class="harmony">' +
          '<p class="eyebrow" style="margin:0">Colour harmony · ' + pct + '%</p>' +
          '<div class="harmony__bar"><span style="width:' + pct + '%"></span></div>' +
          '<p class="harmony__note">' + util.esc(PT.colors.harmonyNote(score, items.length)) + '</p>' +
        '</div>' +
        '<div class="row" style="margin-top:16px">' +
          '<button class="btn btn--ghost btn--sm" data-suggest type="button">Suggest a look</button>' +
          '<button class="btn btn--ghost btn--sm" data-clear-all type="button">Clear</button>' +
          '<span class="spacer"></span>' +
          '<button class="btn" data-save-outfit type="button"' + (items.length < 2 ? ' disabled' : '') + '>' +
            (draft.id ? 'Update look' : 'Save look') + '</button>' +
        '</div>' +
      '</div>';
  }

  function pickerHTML() {
    if (!activeSlot) {
      return '' +
        '<div class="picker">' +
          '<p class="eyebrow">Pieces</p>' +
          '<p class="harmony__note">Tap a slot in the flat lay to fill it. Pieces are ordered by how well ' +
          'they match what you have already chosen.</p>' +
        '</div>';
    }

    const isAccessory = activeSlot.indexOf('acc:') === 0;
    const label = isAccessory ? 'Accessory' : (SLOTS.filter(function (s) { return s.key === activeSlot; })[0] || {}).label;
    const candidates = candidatesFor(activeSlot);
    const currentId = isAccessory ? draft.slots.accessories[Number(activeSlot.split(':')[1])] : draft.slots[activeSlot];
    const hasOthers = chosenItems().length > 0;

    const grid = candidates.length
      ? candidates.map(function (entry) {
          const labelClass = PT.colors.pairLabel(entry.score);
          const badge = hasOthers
            ? '<span class="pick__score pick__score--' + labelClass + '">' +
              (labelClass === 'strong' ? 'Match' : labelClass === 'ok' ? 'Works' : 'Clash') + '</span>'
            : '';
          return '' +
            '<button class="pick" type="button" data-pick="' + util.esc(entry.item.id) + '" aria-pressed="' +
              (currentId === entry.item.id) + '">' +
              '<span class="pick__frame">' + util.thumb(entry.item) + '</span>' + badge +
              '<span class="pick__name">' + util.esc(entry.item.name) + '</span>' +
            '</button>';
        }).join('')
      : '<p class="harmony__note">Nothing in the closet fits this slot and these filters yet.</p>';

    return '' +
      '<div class="picker">' +
        '<div class="picker__head">' +
          '<h3 style="font-size:19px">' + util.esc(label) + '</h3>' +
          '<button class="btn btn--quiet btn--sm" data-close-picker type="button">Done</button>' +
        '</div>' +
        '<div class="filters" style="margin-bottom:14px">' +
          '<button class="chip" data-picker-agency aria-pressed="' + pickerFilters.agency + '" type="button">Agency only</button>' +
          '<div class="seg">' +
            '<button data-picker-time="all" aria-pressed="' + (pickerFilters.time === 'all') + '" type="button">All</button>' +
            '<button data-picker-time="day" aria-pressed="' + (pickerFilters.time === 'day') + '" type="button">Day</button>' +
            '<button data-picker-time="night" aria-pressed="' + (pickerFilters.time === 'night') + '" type="button">Night</button>' +
          '</div>' +
        '</div>' +
        '<div class="picker__grid">' + grid + '</div>' +
      '</div>';
  }

  function outfitCardHTML(outfit, options) {
    const items = PT.store.outfitItems(outfit);
    const strip = items.slice(0, 5).map(function (item) {
      return '<div>' + util.thumb(item) + '</div>';
    }).join('') || '<div></div>';
    const score = Math.round(PT.colors.harmony(items) * 100);
    const draggable = options && options.draggable;

    return '' +
      '<article class="outfit-card" data-outfit="' + util.esc(outfit.id) + '"' +
        (draggable ? ' draggable="true"' : '') + '>' +
        '<div class="outfit-card__strip">' + strip + '</div>' +
        '<div class="outfit-card__name">' + util.esc(outfit.name) + '</div>' +
        '<div class="outfit-card__meta">' +
          (outfit.tag ? util.esc(outfit.tag) + ' · ' : '') +
          util.pluralize(items.length, 'piece') + ' · ' + score + '%' +
        '</div>' +
        '<div class="outfit-card__actions">' +
          '<button class="btn btn--ghost btn--sm" data-edit-outfit type="button">Edit</button>' +
          '<button class="btn btn--ghost btn--sm" data-copy-outfit type="button">Duplicate</button>' +
          '<button class="btn btn--quiet btn--sm" data-delete-outfit type="button">Delete</button>' +
        '</div>' +
      '</article>';
  }

  function render(root) {
    const outfits = PT.store.get().outfits;
    const hasItems = PT.store.get().items.length > 0;

    if (!hasItems) {
      root.innerHTML = '' +
        '<div class="section-head"><h2>Outfit Builder</h2></div>' +
        '<div class="empty-state">' +
          '<h3>Fill the closet first</h3>' +
          '<p>Add a few tops, bottoms and shoes, then come back and the builder will do the matching for you.</p>' +
          '<button class="btn" data-goto="closet" type="button">Go to the closet</button>' +
        '</div>';
      return;
    }

    const saved = outfits.length
      ? '<div class="outfit-rail">' + outfits.map(function (o) { return outfitCardHTML(o); }).join('') + '</div>'
      : '<div class="empty-state"><h3>No looks saved yet</h3><p>Build one on the left and save it — ' +
        'saved looks are what feed the calendar and the packing list.</p></div>';

    root.innerHTML = '' +
      '<div class="section-head">' +
        '<h2>Outfit Builder</h2>' +
        '<div class="section-head__aside">' +
          '<span class="category-block__count">' + util.pluralize(outfits.length, 'look') + ' saved</span>' +
        '</div>' +
      '</div>' +
      '<div class="builder">' + flatlayHTML() + pickerHTML() + '</div>' +
      '<section style="margin-top:clamp(30px,5vw,60px)">' +
        '<div class="category-block__head"><h3>Saved looks</h3>' +
          '<span class="category-block__count">' + util.pluralize(outfits.length, 'look') + '</span></div>' +
        saved +
      '</section>';
  }

  /* ---- actions ------------------------------------------------------- */

  function setSlot(slotKey, itemId) {
    if (slotKey.indexOf('acc:') === 0) {
      const index = Number(slotKey.split(':')[1]);
      const accessories = draft.slots.accessories.slice();
      while (accessories.length <= index) accessories.push(null);
      accessories[index] = accessories[index] === itemId ? null : itemId;
      // Holes in the middle are fine; only trailing empties are trimmed.
      while (accessories.length && !accessories[accessories.length - 1]) accessories.pop();
      draft.slots.accessories = accessories;
    } else {
      draft.slots[slotKey] = draft.slots[slotKey] === itemId ? null : itemId;
      if (slotKey === 'dress' && draft.slots.dress) { draft.slots.top = null; draft.slots.bottom = null; }
      if ((slotKey === 'top' || slotKey === 'bottom') && draft.slots[slotKey]) draft.slots.dress = null;
    }
    PT.app.rerender();
  }

  function clearSlot(slotKey) {
    if (slotKey.indexOf('acc:') === 0) {
      const index = Number(slotKey.split(':')[1]);
      if (draft.slots.accessories[index]) draft.slots.accessories[index] = null;
      while (draft.slots.accessories.length && !draft.slots.accessories[draft.slots.accessories.length - 1]) {
        draft.slots.accessories.pop();
      }
    } else {
      draft.slots[slotKey] = null;
    }
    PT.app.rerender();
  }

  /* Build a complete, colour-coherent look from whatever is in the closet. */
  function suggest() {
    const store = PT.store;
    const anchorPool = store.get().items.filter(function (item) {
      if (pickerFilters.agency && !item.agency) return false;
      return item.category === 'tops' || item.category === 'dresses';
    });
    if (!anchorPool.length) { util.toast('Add a top or a dress first.'); return; }

    const anchor = anchorPool[Math.floor(Math.random() * anchorPool.length)];
    draft = emptyDraft();
    if (anchor.category === 'dresses') draft.slots.dress = anchor.id;
    else draft.slots.top = anchor.id;

    const fillOrder = anchor.category === 'dresses'
      ? ['outerwear', 'shoes', 'bag']
      : ['bottom', 'outerwear', 'shoes', 'bag'];

    fillOrder.forEach(function (slotKey) {
      const best = candidatesFor(slotKey)[0];
      // Only take the piece if it genuinely works with the anchor.
      if (best && best.score >= 0.6) draft.slots[slotKey] = best.item.id;
    });

    const accessory = candidatesFor('acc:0')[0];
    if (accessory && accessory.score >= 0.6) draft.slots.accessories = [accessory.item.id];

    activeSlot = null;
    PT.app.rerender();
    util.toast('Here is one that works.');
  }

  function openSaveDialog() {
    const items = chosenItems();
    if (items.length < 2) { util.toast('Pick at least two pieces.'); return; }

    const quickTags = ['Agency', 'Day', 'Night', 'Travel', 'Dinner'];
    const html = '' +
      '<div class="field">' +
        '<label for="o-name">Name this look</label>' +
        '<input id="o-name" type="text" data-outfit-name value="' + util.esc(draft.name) + '" placeholder="Agency Day 1">' +
      '</div>' +
      '<div class="field">' +
        '<span class="field-label">Tag</span>' +
        '<div class="filters__group">' +
          quickTags.map(function (tag) {
            return '<button class="chip" type="button" data-quick-tag="' + tag + '" aria-pressed="' +
              (draft.tag === tag) + '">' + tag + '</button>';
          }).join('') +
        '</div>' +
        '<input class="input" style="margin-top:10px" type="text" data-outfit-tag value="' + util.esc(draft.tag) + '" placeholder="Or write your own">' +
      '</div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
        '<button class="btn" data-confirm-save type="button">Save look</button>' +
      '</div>';

    util.modal(draft.id ? 'Update look' : 'Save look', html, function (body) {
      const nameInput = body.querySelector('[data-outfit-name]');
      const tagInput = body.querySelector('[data-outfit-tag]');
      util.on(body, 'click', '[data-quick-tag]', function (e, btn) {
        tagInput.value = btn.dataset.quickTag;
        util.qsa('[data-quick-tag]', body).forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
      });
      body.querySelector('[data-confirm-save]').addEventListener('click', function () {
        const name = nameInput.value.trim();
        if (!name) { util.toast('Give the look a name.'); return; }
        draft.name = name;
        draft.tag = tagInput.value.trim();
        PT.store.saveOutfit({
          id: draft.id,
          name: draft.name,
          tag: draft.tag,
          slots: JSON.parse(JSON.stringify(draft.slots))
        });
        draft = emptyDraft();
        activeSlot = null;
        util.closeModal();
        util.toast('Look saved.');
      });
    });
  }

  function loadIntoDraft(outfitId) {
    const outfit = PT.store.outfitById(outfitId);
    if (!outfit) return;
    draft = {
      id: outfit.id,
      name: outfit.name,
      tag: outfit.tag,
      slots: Object.assign({ accessories: [] }, JSON.parse(JSON.stringify(outfit.slots)))
    };
    activeSlot = null;
    PT.app.show('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Jump into the builder with a top + bottom pairing (from the matrix). */
  function startPair(topId, bottomId) {
    draft = emptyDraft();
    draft.slots.top = topId || null;
    draft.slots.bottom = bottomId || null;
    activeSlot = 'shoes';
    PT.app.show('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bind(root) {
    util.on(root, 'click', '[data-slot]', function (e, btn) {
      activeSlot = activeSlot === btn.dataset.slot ? null : btn.dataset.slot;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-clear-slot]', function (e, btn) {
      clearSlot(btn.dataset.clearSlot);
    });
    util.on(root, 'click', '[data-pick]', function (e, btn) {
      if (!activeSlot) return;
      setSlot(activeSlot, btn.dataset.pick);
    });
    util.on(root, 'click', '[data-close-picker]', function () {
      activeSlot = null;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-picker-agency]', function () {
      pickerFilters.agency = !pickerFilters.agency;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-picker-time]', function (e, btn) {
      pickerFilters.time = btn.dataset.pickerTime;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-suggest]', suggest);
    util.on(root, 'click', '[data-clear-all]', function () {
      draft = emptyDraft();
      activeSlot = null;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-save-outfit]', openSaveDialog);

    util.on(root, 'click', '[data-edit-outfit]', function (e, btn) {
      loadIntoDraft(btn.closest('[data-outfit]').dataset.outfit);
    });
    util.on(root, 'click', '[data-copy-outfit]', function (e, btn) {
      const outfit = PT.store.outfitById(btn.closest('[data-outfit]').dataset.outfit);
      if (!outfit) return;
      PT.store.saveOutfit({
        name: outfit.name + ' (copy)',
        tag: outfit.tag,
        slots: JSON.parse(JSON.stringify(outfit.slots))
      });
      util.toast('Duplicated.');
    });
    util.on(root, 'click', '[data-delete-outfit]', function (e, btn) {
      const id = btn.closest('[data-outfit]').dataset.outfit;
      const outfit = PT.store.outfitById(id);
      if (!outfit) return;
      util.confirm('Delete "' + outfit.name + '"? Any day it was assigned to will be emptied.', function () {
        PT.store.deleteOutfit(id);
        util.toast('Deleted.');
      });
    });
  }

  PT.builder = {
    render: render,
    bind: bind,
    outfitCardHTML: outfitCardHTML,
    loadIntoDraft: loadIntoDraft,
    startPair: startPair
  };
})();
