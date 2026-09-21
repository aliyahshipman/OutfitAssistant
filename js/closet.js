/* The closet: add pieces, tag them, and see everything at a glance. */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  const filters = { category: 'all', color: 'all', agency: false, time: 'all', search: '' };

  function matches(item) {
    if (filters.category !== 'all' && item.category !== filters.category) return false;
    if (filters.color !== 'all' && PT.colors.bucket(item.color) !== filters.color) return false;
    if (filters.agency && !item.agency) return false;
    if (filters.time !== 'all' && item.time !== filters.time && item.time !== 'both') return false;
    if (filters.search) {
      const haystack = (item.name + ' ' + (item.brand || '') + ' ' + (item.subtype || '')).toLowerCase();
      if (haystack.indexOf(filters.search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function cardHTML(item) {
    const store = PT.store;
    const uses = store.closetUsage(item.id);
    const usesClass = uses < 1 ? 'card__uses card__uses--low' : 'card__uses';
    const usesText = uses === 0 ? 'In no look yet' : util.pluralize(uses, 'look');
    const onTrip = store.inTrip(item.id);

    return '' +
      '<article class="card" data-item="' + util.esc(item.id) + '">' +
        '<div class="card__frame">' +
          util.thumb(item) +
          '<div class="card__badges">' +
            (item.agency ? '<span class="badge badge--agency">Agency</span>' : '') +
            (item.time === 'night' ? '<span class="badge badge--night">Night</span>' : '') +
            (item.time === 'day' ? '<span class="badge">Day</span>' : '') +
            (onTrip ? '<span class="badge badge--trip">Packing</span>' : '') +
          '</div>' +
          '<div class="card__actions">' +
            '<button class="btn btn--ghost btn--sm" data-edit type="button">Edit</button>' +
            '<button class="btn btn--ghost btn--sm" data-delete type="button">Remove</button>' +
          '</div>' +
        '</div>' +
        '<div class="card__body">' +
          '<div class="card__name">' + util.esc(item.name) + '</div>' +
          '<div class="card__meta">' +
            '<span class="swatch" style="background:' + util.esc(item.color) + '"></span>' +
            '<span>' + util.esc(item.colorName || PT.colors.nameFor(item.color)) + '</span>' +
            (item.brand ? '<span class="dot">·</span><span>' + util.esc(item.brand) + '</span>' : '') +
          '</div>' +
          '<div class="' + usesClass + '">' + usesText + '</div>' +
        '</div>' +
      '</article>';
  }

  function filterBarHTML() {
    const store = PT.store;
    const usedBuckets = [];
    store.get().items.forEach(function (item) {
      const b = PT.colors.bucket(item.color);
      if (usedBuckets.indexOf(b) === -1) usedBuckets.push(b);
    });
    usedBuckets.sort();

    const catChips = ['all'].concat(store.CATEGORIES.map(function (c) { return c.id; }))
      .map(function (id) {
        const label = id === 'all' ? 'Everything' : store.category(id).label;
        return '<button class="chip" data-filter-category="' + id + '" aria-pressed="' +
          (filters.category === id) + '" type="button">' + util.esc(label) + '</button>';
      }).join('');

    const colorChips = usedBuckets.length ? (
      '<button class="chip" data-filter-color="all" aria-pressed="' + (filters.color === 'all') + '" type="button">All colours</button>' +
      usedBuckets.map(function (b) {
        return '<button class="chip" data-filter-color="' + util.esc(b) + '" aria-pressed="' +
          (filters.color === b) + '" type="button">' + util.esc(b) + '</button>';
      }).join('')
    ) : '';

    return '' +
      '<div class="filters">' +
        '<div class="filters__group">' + catChips + '</div>' +
      '</div>' +
      '<div class="filters">' +
        '<div class="filters__group">' + colorChips + '</div>' +
        '<span class="spacer"></span>' +
        '<div class="filters__group">' +
          '<button class="chip" data-filter-agency aria-pressed="' + filters.agency + '" type="button">Agency-appropriate</button>' +
          '<div class="seg">' +
            '<button data-filter-time="all" aria-pressed="' + (filters.time === 'all') + '" type="button">All</button>' +
            '<button data-filter-time="day" aria-pressed="' + (filters.time === 'day') + '" type="button">Day</button>' +
            '<button data-filter-time="night" aria-pressed="' + (filters.time === 'night') + '" type="button">Night</button>' +
          '</div>' +
          '<input class="input" style="width:150px" type="text" data-filter-search placeholder="Search" value="' + util.esc(filters.search) + '">' +
        '</div>' +
      '</div>';
  }

  function render(root) {
    const store = PT.store;
    const all = store.get().items;
    const visible = all.filter(matches);

    if (!all.length) {
      root.innerHTML = '' +
        '<div class="section-head"><h2>The Closet</h2></div>' +
        '<div class="empty-state">' +
          '<h3>Nothing hanging up yet</h3>' +
          '<p>This is your whole wardrobe, not one trip\'s packing list. Add pieces by hand, or import them ' +
          'straight from your shop order emails — pictures included.</p>' +
          '<div class="row" style="justify-content:center">' +
            '<button class="btn" data-add-item type="button">Add a piece</button>' +
            '<button class="btn btn--ghost" data-import-orders type="button">Import from orders</button>' +
          '</div>' +
        '</div>';
      return;
    }

    const grouped = filters.category === 'all';
    let body;

    if (!visible.length) {
      body = '<div class="empty-state"><h3>Nothing matches</h3><p>Loosen a filter to see more of the closet.</p></div>';
    } else if (grouped) {
      body = store.CATEGORIES.map(function (cat) {
        const inCat = visible.filter(function (i) { return i.category === cat.id; });
        if (!inCat.length) return '';
        return '' +
          '<section class="category-block">' +
            '<div class="category-block__head">' +
              '<h3>' + util.esc(cat.label) + '</h3>' +
              '<span class="category-block__count">' + util.pluralize(inCat.length, 'piece') + '</span>' +
            '</div>' +
            '<div class="closet-grid">' + inCat.map(cardHTML).join('') + '</div>' +
          '</section>';
      }).join('');
    } else {
      body = '<div class="closet-grid">' + visible.map(cardHTML).join('') + '</div>';
    }

    root.innerHTML = '' +
      '<div class="section-head">' +
        '<h2>The Closet</h2>' +
        '<div class="section-head__aside">' +
          '<span class="category-block__count">' + util.pluralize(all.length, 'piece') + '</span>' +
          '<button class="btn btn--ghost" data-import-orders type="button">Import from orders</button>' +
          '<button class="btn" data-add-item type="button">Add piece</button>' +
        '</div>' +
      '</div>' +
      filterBarHTML() +
      body;
  }

  /* ---- add / edit form -------------------------------------------- */

  function openForm(itemId) {
    const store = PT.store;
    const existing = itemId ? store.itemById(itemId) : null;
    const draft = Object.assign({
      name: '', brand: '', size: '', category: 'tops', subtype: '', color: '#141414',
      colorName: '', photo: '', photoUrl: '', agency: false, time: 'both'
    }, existing || {});

    const categoryOptions = store.CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '"' + (draft.category === c.id ? ' selected' : '') + '>' + util.esc(c.label) + '</option>';
    }).join('');

    const swatches = PT.colors.PALETTE.map(function (entry) {
      return '<button type="button" class="swatch-btn" data-swatch="' + entry.hex + '" title="' + util.esc(entry.name) + '" ' +
        'aria-pressed="' + (draft.color.toLowerCase() === entry.hex.toLowerCase()) + '" ' +
        'style="background:' + entry.hex + '"></button>';
    }).join('');

    const html = '' +
      '<div class="row" style="align-items:flex-start;gap:22px">' +
        '<div class="field" style="flex:none">' +
          '<span class="field-label">Photo</span>' +
          '<label class="photo-drop" data-photo-drop>' +
            (draft.photo || draft.photoUrl
              ? '<img src="' + util.esc(draft.photo || draft.photoUrl) + '" alt="">'
              : '<span>Tap to add a photo from your camera roll</span>') +
            '<input type="file" accept="image/*" data-photo-input hidden>' +
          '</label>' +
          (draft.photo ? '<button class="btn btn--quiet btn--sm" data-photo-clear type="button">Remove photo</button>' : '') +
        '</div>' +
        '<div class="stack" style="flex:1 1 260px">' +
          '<div class="field">' +
            '<label for="f-name">Name</label>' +
            '<input id="f-name" type="text" data-field="name" value="' + util.esc(draft.name) + '" placeholder="Black silk blouse">' +
          '</div>' +
          '<div class="field-row">' +
            '<div class="field">' +
              '<label for="f-brand">Brand</label>' +
              '<input id="f-brand" type="text" data-field="brand" value="' + util.esc(draft.brand) + '" placeholder="Optional">' +
            '</div>' +
            '<div class="field">' +
              '<label for="f-size">Size</label>' +
              '<input id="f-size" type="text" data-field="size" value="' + util.esc(draft.size) + '" placeholder="Optional">' +
            '</div>' +
          '</div>' +
          '<div class="field-row">' +
            '<div class="field">' +
              '<label for="f-category">Category</label>' +
              '<select id="f-category" data-field="category">' + categoryOptions + '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label for="f-subtype">Type</label>' +
              '<select id="f-subtype" data-field="subtype"></select>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<span class="field-label">Colour</span>' +
        '<div class="swatch-grid" data-swatches>' + swatches + '</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<input type="color" data-field="color" value="' + util.esc(draft.color) + '" style="width:44px;height:30px;border:1px solid var(--line-firm);background:none;padding:2px">' +
          '<span class="card__meta" data-color-name>' + util.esc(PT.colors.nameFor(draft.color)) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="field-row">' +
        '<div class="field">' +
          '<span class="field-label">Agency-appropriate</span>' +
          '<div class="seg" data-agency>' +
            '<button type="button" data-agency-val="yes" aria-pressed="' + (draft.agency === true) + '">Yes</button>' +
            '<button type="button" data-agency-val="no" aria-pressed="' + (draft.agency !== true) + '">No</button>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<span class="field-label">Day or night</span>' +
          '<div class="seg" data-time>' +
            '<button type="button" data-time-val="day" aria-pressed="' + (draft.time === 'day') + '">Day</button>' +
            '<button type="button" data-time-val="night" aria-pressed="' + (draft.time === 'night') + '">Night</button>' +
            '<button type="button" data-time-val="both" aria-pressed="' + (draft.time === 'both') + '">Both</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal__actions">' +
        (existing ? '<button class="btn btn--danger" data-delete-item type="button">Delete piece</button>' : '') +
        '<span class="spacer"></span>' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
        '<button class="btn" data-save-item type="button">' + (existing ? 'Save changes' : 'Add to closet') + '</button>' +
      '</div>';

    util.modal(existing ? 'Edit piece' : 'Add a piece', html, function (body) {
      const subtypeSelect = body.querySelector('[data-field="subtype"]');

      function paintSubtypes() {
        const cat = PT.store.category(draft.category);
        const options = ['<option value="">—</option>'].concat((cat ? cat.subtypes : []).map(function (s) {
          return '<option value="' + util.esc(s) + '"' + (draft.subtype === s ? ' selected' : '') + '>' + util.esc(s) + '</option>';
        }));
        subtypeSelect.innerHTML = options.join('');
      }
      paintSubtypes();

      body.querySelector('[data-field="name"]').addEventListener('input', function (e) { draft.name = e.target.value; });
      body.querySelector('[data-field="brand"]').addEventListener('input', function (e) { draft.brand = e.target.value; });
      body.querySelector('[data-field="size"]').addEventListener('input', function (e) { draft.size = e.target.value; });
      body.querySelector('[data-field="category"]').addEventListener('change', function (e) {
        draft.category = e.target.value;
        draft.subtype = '';
        paintSubtypes();
      });
      subtypeSelect.addEventListener('change', function (e) { draft.subtype = e.target.value; });

      const colorInput = body.querySelector('[data-field="color"]');
      const colorName = body.querySelector('[data-color-name]');
      function setColor(hex) {
        draft.color = hex;
        draft.colorName = '';
        colorInput.value = hex;
        colorName.textContent = PT.colors.nameFor(hex);
        util.qsa('[data-swatch]', body).forEach(function (btn) {
          btn.setAttribute('aria-pressed', String(btn.dataset.swatch.toLowerCase() === hex.toLowerCase()));
        });
      }
      colorInput.addEventListener('input', function (e) { setColor(e.target.value); });
      util.on(body, 'click', '[data-swatch]', function (e, btn) { setColor(btn.dataset.swatch); });

      util.on(body, 'click', '[data-agency-val]', function (e, btn) {
        draft.agency = btn.dataset.agencyVal === 'yes';
        util.qsa('[data-agency-val]', body).forEach(function (b) {
          b.setAttribute('aria-pressed', String((b.dataset.agencyVal === 'yes') === draft.agency));
        });
      });
      util.on(body, 'click', '[data-time-val]', function (e, btn) {
        draft.time = btn.dataset.timeVal;
        util.qsa('[data-time-val]', body).forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.dataset.timeVal === draft.time));
        });
      });

      const photoInput = body.querySelector('[data-photo-input]');
      photoInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        util.readImageFile(file).then(function (dataUrl) {
          draft.photo = dataUrl;
          const drop = body.querySelector('[data-photo-drop]');
          drop.innerHTML = '<img src="' + util.esc(dataUrl) + '" alt="">';
          drop.appendChild(photoInput);
        }).catch(function (err) { util.toast(err.message); });
      });
      const clearPhoto = body.querySelector('[data-photo-clear]');
      if (clearPhoto) {
        clearPhoto.addEventListener('click', function () {
          draft.photo = '';
          const drop = body.querySelector('[data-photo-drop]');
          drop.innerHTML = '<span>Tap to add a photo from your camera roll</span>';
          drop.appendChild(photoInput);
          clearPhoto.remove();
        });
      }

      body.querySelector('[data-save-item]').addEventListener('click', function () {
        if (!draft.name.trim()) { util.toast('Give the piece a name first.'); return; }
        PT.store.saveItem(draft);
        util.closeModal();
        util.toast(existing ? 'Piece updated.' : 'Added to the closet.');
      });

      const deleteBtn = body.querySelector('[data-delete-item]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          util.confirm('Remove "' + draft.name + '" from the closet? It will also leave any saved outfits.', function () {
            PT.store.deleteItem(draft.id);
            util.toast('Removed.');
          });
        });
      }
    });
  }

  function bind(root) {
    util.on(root, 'click', '[data-add-item]', function () { openForm(null); });
    util.on(root, 'click', '[data-import-orders]', function () { PT.importer.open(); });
    util.on(root, 'click', '[data-edit]', function (e, btn) {
      openForm(btn.closest('[data-item]').dataset.item);
    });
    util.on(root, 'click', '[data-delete]', function (e, btn) {
      const id = btn.closest('[data-item]').dataset.item;
      const item = PT.store.itemById(id);
      if (!item) return;
      util.confirm('Remove "' + item.name + '" from the closet?', function () {
        PT.store.deleteItem(id);
        util.toast('Removed.');
      });
    });

    util.on(root, 'click', '[data-filter-category]', function (e, btn) {
      filters.category = btn.dataset.filterCategory;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-filter-color]', function (e, btn) {
      filters.color = btn.dataset.filterColor;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-filter-agency]', function () {
      filters.agency = !filters.agency;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-filter-time]', function (e, btn) {
      filters.time = btn.dataset.filterTime;
      PT.app.rerender();
    });
    root.addEventListener('input', function (e) {
      if (e.target.matches('[data-filter-search]')) {
        filters.search = e.target.value;
        const caret = e.target.selectionStart;
        PT.app.rerender();
        const next = root.querySelector('[data-filter-search]');
        if (next) { next.focus(); next.setSelectionRange(caret, caret); }
      }
    });
  }

  PT.closet = { render: render, bind: bind, openForm: openForm };
})();
