/*
 * Day-by-day: one tile per date of the trip, each split into a day look and a
 * night look. Agency days are marked. Repeats are flagged.
 *
 * Looks can be dragged from the rail onto a tile, or tapped to assign — the
 * tap path is what works on a phone.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  const AGENCY_TARGET = 5;
  let dragOutfitId = null;

  function lookHTML(date, slot, outfitId, repeated) {
    const outfit = outfitId ? PT.store.outfitById(outfitId) : null;
    const items = outfit ? PT.store.outfitItems(outfit).slice(0, 4) : [];
    const body = outfit
      ? '<span class="slot-look__thumbs">' + items.map(function (i) { return util.thumb(i); }).join('') + '</span>' +
        '<span class="slot-look__name">' + util.esc(outfit.name) +
          (repeated ? ' <span class="badge badge--alert">Repeat</span>' : '') + '</span>'
      : '<span class="slot-look__empty">Nothing assigned</span>';

    return '' +
      '<div class="slot-look" data-look-slot="' + slot + '" data-date="' + util.esc(date) + '">' +
        '<div class="slot-look__label">' +
          '<span>' + (slot === 'day' ? 'Day' : 'Night') + '</span>' +
          (outfit ? '<button class="btn btn--quiet btn--sm" data-clear-look type="button">Clear</button>' : '') +
        '</div>' +
        '<div class="slot-look__body" data-assign="' + slot + '">' + body + '</div>' +
      '</div>';
  }

  function tileHTML(date, repeats) {
    const entry = PT.store.day(date);
    const weather = PT.weather ? PT.weather.forDate(date) : null;
    const weatherText = weather
      ? Math.round(weather.max) + '° / ' + Math.round(weather.min) + '°' +
        (weather.precip != null && weather.precip >= 40 ? ' · rain ' + Math.round(weather.precip) + '%' : '')
      : '';

    return '' +
      '<article class="day-tile' + (entry.agency ? ' day-tile--agency' : '') + '" data-day="' + util.esc(date) + '">' +
        '<div class="day-tile__head">' +
          '<div>' +
            '<div class="day-tile__dow">' + util.esc(util.weekday(date)) + '</div>' +
            '<div class="day-tile__date">' + util.esc(util.formatDate(date, { day: 'numeric', month: 'short' })) + '</div>' +
            (weatherText ? '<div class="day-tile__weather">' + util.esc(weatherText) + '</div>' : '') +
          '</div>' +
          '<button class="chip' + (entry.agency ? ' chip--agency' : '') + '" data-toggle-agency type="button" ' +
            'aria-pressed="' + entry.agency + '">Agency</button>' +
        '</div>' +
        lookHTML(date, 'day', entry.day, repeats.indexOf(entry.day) > -1) +
        lookHTML(date, 'night', entry.night, repeats.indexOf(entry.night) > -1) +
      '</article>';
  }

  function railHTML() {
    const outfits = PT.store.get().outfits;
    if (!outfits.length) {
      return '<div class="rail"><h3>Saved looks</h3><p class="rail__hint">Save a look in the builder and it will ' +
        'appear here, ready to drop onto a day.</p></div>';
    }
    const assignedCounts = {};
    PT.store.tripDates().forEach(function (date) {
      const entry = PT.store.day(date);
      ['day', 'night'].forEach(function (slot) {
        if (entry[slot]) assignedCounts[entry[slot]] = (assignedCounts[entry[slot]] || 0) + 1;
      });
    });

    const list = outfits.map(function (outfit) {
      const items = PT.store.outfitItems(outfit).slice(0, 3);
      const used = assignedCounts[outfit.id] || 0;
      return '' +
        '<div class="rail-item" draggable="true" data-rail-outfit="' + util.esc(outfit.id) + '">' +
          items.map(function (i) { return util.thumb(i); }).join('') +
          '<div>' +
            '<div class="rail-item__name">' + util.esc(outfit.name) + '</div>' +
            '<div class="rail-item__uses">' + (used ? 'On ' + util.pluralize(used, 'day') : 'Unassigned') + '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div class="rail">' +
        '<h3>Saved looks</h3>' +
        '<p class="rail__hint">Drag onto a day, or tap a day slot to choose.</p>' +
        '<div class="rail__list">' + list + '</div>' +
      '</div>';
  }

  function noticesHTML(dates) {
    const store = PT.store;
    const notices = [];

    const agencyCount = store.agencyDates().length;
    if (agencyCount !== AGENCY_TARGET) {
      notices.push('<div class="note">' +
        (agencyCount < AGENCY_TARGET
          ? 'Marked <strong>' + agencyCount + '</strong> of ' + AGENCY_TARGET + ' agency days so far.'
          : '<strong>' + agencyCount + '</strong> agency days marked — one more than the five you planned.') +
        '</div>');
    }

    const repeats = store.repeatedOutfits();
    if (repeats.length) {
      const names = repeats.map(function (id) {
        const outfit = store.outfitById(id);
        return outfit ? outfit.name : '';
      }).filter(Boolean);
      notices.push('<div class="note note--alert">Worn more than once this trip: <strong>' +
        util.esc(names.join(', ')) + '</strong>. Fine if that is on purpose — swap a piece if it is not.</div>');
    }

    let unfilled = 0;
    dates.forEach(function (date) {
      const entry = store.day(date);
      if (!entry.day) unfilled++;
    });
    if (unfilled && store.get().outfits.length) {
      notices.push('<div class="note note--calm">' + util.pluralize(unfilled, 'day') +
        ' still without a day look.</div>');
    }

    // Agency days whose look contains a piece not tagged agency-appropriate.
    const flagged = [];
    store.agencyDates().forEach(function (date) {
      const entry = store.day(date);
      const outfit = entry.day ? store.outfitById(entry.day) : null;
      if (!outfit) return;
      const offenders = store.outfitItems(outfit).filter(function (i) { return !i.agency; });
      if (offenders.length) {
        flagged.push(util.formatDate(date, { day: 'numeric', month: 'short' }) + ' (' + outfit.name + ')');
      }
    });
    if (flagged.length) {
      notices.push('<div class="note">Agency days with pieces you have not tagged agency-appropriate: <strong>' +
        util.esc(flagged.join(', ')) + '</strong>.</div>');
    }

    return notices.join('');
  }

  function render(root) {
    const store = PT.store;
    const dates = store.tripDates();
    const repeats = store.repeatedOutfits();

    if (!dates.length) {
      root.innerHTML = '<div class="section-head"><h2>12 Days</h2></div>' +
        '<div class="empty-state"><h3>Trip dates look wrong</h3>' +
        '<p>Set a start and end date in Settings to lay out the calendar.</p></div>';
      return;
    }

    root.innerHTML = '' +
      '<div class="section-head">' +
        '<h2>Day by Day</h2>' +
        '<div class="section-head__aside">' +
          '<span class="category-block__count">' + dates.length + ' days · ' +
            store.agencyDates().length + ' agency</span>' +
        '</div>' +
      '</div>' +
      noticesHTML(dates) +
      '<div class="calendar-layout">' +
        '<div class="day-grid">' + dates.map(function (d) { return tileHTML(d, repeats); }).join('') + '</div>' +
        railHTML() +
      '</div>';
  }

  /* ---- assignment ---------------------------------------------------- */

  function openAssignDialog(date, slot) {
    const store = PT.store;
    const outfits = store.get().outfits;
    const entry = store.day(date);
    const label = util.formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });

    if (!outfits.length) {
      util.modal('No looks yet', '<p class="lede">Build and save a look first — then you can assign it to a day.</p>' +
        '<div class="modal__actions"><button class="btn" data-close-modal type="button">Got it</button></div>');
      return;
    }

    const cards = outfits.map(function (outfit) {
      const items = store.outfitItems(outfit).slice(0, 4);
      const isCurrent = entry[slot] === outfit.id;
      const agencyIssue = entry.agency && store.outfitItems(outfit).some(function (i) { return !i.agency; });
      return '' +
        '<button class="pick" type="button" data-assign-outfit="' + util.esc(outfit.id) + '" aria-pressed="' + isCurrent + '" ' +
          'style="padding:8px;display:block;width:100%">' +
          '<span class="outfit-card__strip" style="display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;aspect-ratio:16/9">' +
            items.map(function (i) { return '<span style="overflow:hidden;border:1px solid var(--line)">' + util.thumb(i) + '</span>'; }).join('') +
          '</span>' +
          '<span class="pick__name" style="font-family:var(--serif);font-size:14px">' + util.esc(outfit.name) + '</span>' +
          (agencyIssue ? '<span class="pick__name" style="color:var(--warn)">Not fully agency-tagged</span>' : '') +
        '</button>';
    }).join('');

    util.modal(label + ' · ' + (slot === 'day' ? 'day look' : 'night look'),
      '<div class="picker__grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">' + cards + '</div>' +
      '<div class="modal__actions">' +
        (entry[slot] ? '<button class="btn btn--ghost" data-unassign type="button">Clear this slot</button>' : '') +
        '<span class="spacer"></span>' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
      '</div>',
      function (body) {
        util.on(body, 'click', '[data-assign-outfit]', function (e, btn) {
          const patch = {};
          patch[slot] = btn.dataset.assignOutfit;
          store.setDay(date, patch);
          util.closeModal();
          util.toast('Assigned.');
        });
        const unassign = body.querySelector('[data-unassign]');
        if (unassign) {
          unassign.addEventListener('click', function () {
            const patch = {};
            patch[slot] = null;
            store.setDay(date, patch);
            util.closeModal();
          });
        }
      });
  }

  function bind(root) {
    util.on(root, 'click', '[data-toggle-agency]', function (e, btn) {
      const date = btn.closest('[data-day]').dataset.day;
      const entry = PT.store.day(date);
      if (!entry.agency && PT.store.agencyDates().length >= AGENCY_TARGET) {
        util.toast('That is more than five agency days — marking it anyway.');
      }
      PT.store.setDay(date, { agency: !entry.agency });
    });

    util.on(root, 'click', '[data-assign]', function (e, node) {
      const date = node.closest('[data-day]').dataset.day;
      openAssignDialog(date, node.dataset.assign);
    });

    util.on(root, 'click', '[data-clear-look]', function (e, btn) {
      const wrap = btn.closest('[data-look-slot]');
      const patch = {};
      patch[wrap.dataset.lookSlot] = null;
      PT.store.setDay(wrap.dataset.date, patch);
    });

    /* Drag a look from the rail onto a day tile. */
    root.addEventListener('dragstart', function (event) {
      const source = event.target.closest('[data-rail-outfit]');
      if (!source) return;
      dragOutfitId = source.dataset.railOutfit;
      event.dataTransfer.effectAllowed = 'copy';
      try { event.dataTransfer.setData('text/plain', dragOutfitId); } catch (err) { /* older browsers */ }
      source.classList.add('is-dragging');
    });
    root.addEventListener('dragend', function (event) {
      const source = event.target.closest('[data-rail-outfit]');
      if (source) source.classList.remove('is-dragging');
      util.qsa('.day-tile--drop', root).forEach(function (n) { n.classList.remove('day-tile--drop'); });
      dragOutfitId = null;
    });
    root.addEventListener('dragover', function (event) {
      const tile = event.target.closest('[data-day]');
      if (!tile || !dragOutfitId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      tile.classList.add('day-tile--drop');
    });
    root.addEventListener('dragleave', function (event) {
      const tile = event.target.closest('[data-day]');
      if (tile && !tile.contains(event.relatedTarget)) tile.classList.remove('day-tile--drop');
    });
    root.addEventListener('drop', function (event) {
      const tile = event.target.closest('[data-day]');
      if (!tile) return;
      event.preventDefault();
      tile.classList.remove('day-tile--drop');
      const outfitId = dragOutfitId || (event.dataTransfer && event.dataTransfer.getData('text/plain'));
      if (!outfitId) return;
      // Dropping on the lower half of a tile fills the night look.
      const lookSlot = event.target.closest('[data-look-slot]');
      const slot = lookSlot ? lookSlot.dataset.lookSlot : 'day';
      const patch = {};
      patch[slot] = outfitId;
      PT.store.setDay(tile.dataset.day, patch);
      dragOutfitId = null;
      util.toast('Assigned to ' + util.formatDate(tile.dataset.day) + '.');
    });
  }

  PT.calendar = { render: render, bind: bind };
})();
