/*
 * App shell.
 *
 * Two levels of navigation:
 *   Closet  — the home screen: everything you own.
 *   A trip  — its own little section, with sub-tabs, that draws on the closet.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  const VIEWS = {
    closet:   { module: 'closet',   root: null, scope: 'home' },
    inspo:    { module: 'inspo',    root: null, scope: 'home' },
    trip:     { module: 'trip',     root: null, scope: 'trip', label: 'What’s coming' },
    builder:  { module: 'builder',  root: null, scope: 'trip', label: 'Looks' },
    matrix:   { module: 'matrix',   root: null, scope: 'trip', label: 'Combinations' },
    calendar: { module: 'calendar', root: null, scope: 'trip', label: 'Day by day' },
    packing:  { module: 'packing',  root: null, scope: 'trip', label: 'Packing' }
  };

  const TRIP_ORDER = ['trip', 'builder', 'matrix', 'calendar', 'packing'];
  let current = 'closet';

  function inTrip() { return VIEWS[current].scope === 'trip'; }

  /* ---- chrome ---------------------------------------------------------- */

  function renderNav() {
    const store = PT.store;
    const trips = store.trips();
    const active = store.trip();

    const primary = '<button class="tab" data-view="closet" aria-selected="' + (current === 'closet') + '">Closet</button>' +
      '<button class="tab" data-view="inspo" aria-selected="' + (current === 'inspo') + '">Looks like this</button>' +
      trips.map(function (trip) {
        const isOn = inTrip() && trip.id === active.id;
        return '<button class="tab" data-trip-tab="' + util.esc(trip.id) + '" aria-selected="' + isOn + '">' +
          util.esc(trip.name) + '</button>';
      }).join('') +
      '<button class="tab tab--add" data-new-trip type="button" aria-selected="false" title="New trip">+</button>';

    util.qs('#primary-nav').innerHTML = primary;

    const sub = util.qs('#trip-nav');
    if (!inTrip()) {
      sub.hidden = true;
      sub.innerHTML = '';
      return;
    }
    sub.hidden = false;
    sub.innerHTML = TRIP_ORDER.map(function (key) {
      const label = key === 'calendar'
        ? (store.tripDates().length ? store.tripDates().length + ' days' : 'Day by day')
        : VIEWS[key].label;
      return '<button class="subtab" data-view="' + key + '" aria-selected="' + (current === key) + '">' +
        util.esc(label) + '</button>';
    }).join('');
  }

  function renderMasthead() {
    const store = PT.store;
    const title = util.qs('#trip-title');
    const dates = util.qs('#trip-dates');
    const countdown = util.qs('#trip-countdown');
    const settings = util.qs('#btn-settings');

    if (current === 'inspo') {
      title.textContent = 'Looks like this';
      dates.textContent = 'A photo in, an outfit out of your own closet';
      countdown.textContent = '';
      util.qs('#trip-dot').hidden = true;
      settings.textContent = 'Settings';
      util.qs('#weather-strip').hidden = true;
      return;
    }

    if (!inTrip()) {
      const items = store.get().items.length;
      const photos = store.get().items.filter(function (i) { return i.photo || i.photoUrl; }).length;
      title.textContent = 'The Closet';
      dates.textContent = items ? util.pluralize(items, 'piece') + ' · ' + photos + ' with pictures' : 'Empty so far';
      const coming = store.onTheWayCount();
      countdown.textContent = coming ? coming + ' still on the way' : '';
      util.qs('#trip-dot').hidden = !countdown.textContent;
      settings.textContent = 'Settings';
      util.qs('#weather-strip').hidden = true;
      return;
    }

    const trip = store.trip();
    const tripDates = store.tripDates();
    title.textContent = trip.name;
    dates.textContent = tripDates.length
      ? util.formatDate(trip.start) + ' – ' + util.formatDate(trip.end, { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Set your dates';

    const days = util.daysUntil(trip.start);
    if (days == null) countdown.textContent = '';
    else if (days > 0) countdown.textContent = days + ' days to go';
    else if (days === 0) countdown.textContent = 'Today';
    else countdown.textContent = util.daysUntil(trip.end) >= 0 ? 'On the trip now' : 'Trip over';
    util.qs('#trip-dot').hidden = !countdown.textContent;

    settings.textContent = 'Trip settings';
    util.qs('#weather-strip').hidden = false;
  }

  function renderMeter() {
    const meter = util.qs('#storage-meter');
    const bytes = PT.store.storageBytes();
    const kb = Math.round(bytes / 1024);
    meter.textContent = kb > 0 ? kb + ' KB used' : '';
    meter.style.color = bytes > 4000000 ? 'var(--accent)' : '';
  }

  function rerender() {
    renderNav();
    renderMasthead();
    renderMeter();
    const view = VIEWS[current];
    if (view && PT[view.module] && view.root) PT[view.module].render(view.root);
    if (inTrip() && PT.weather) PT.weather.renderStrip();
  }

  function show(name) {
    if (!VIEWS[name]) return;
    current = name;
    Object.keys(VIEWS).forEach(function (key) {
      VIEWS[key].root.hidden = key !== name;
    });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
    rerender();
    if (inTrip() && PT.weather) PT.weather.refresh(false);
  }

  /* ---- trip settings ----------------------------------------------------- */

  function openTripSettings() {
    const store = PT.store;
    const trip = store.trip();
    const canDelete = store.trips().length > 1;

    const html = '' +
      '<div class="field">' +
        '<label for="s-name">Trip name</label>' +
        '<input id="s-name" type="text" data-trip-name value="' + util.esc(trip.name) + '">' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="s-start">First day</label>' +
          '<input id="s-start" type="date" data-trip-start value="' + util.esc(trip.start) + '"></div>' +
        '<div class="field"><label for="s-end">Last day</label>' +
          '<input id="s-end" type="date" data-trip-end value="' + util.esc(trip.end) + '"></div>' +
      '</div>' +
      '<p class="harmony__note" data-day-count>' + store.tripDates().length + ' day tiles.</p>' +
      '<div class="modal__actions">' +
        (canDelete ? '<button class="btn btn--danger" data-delete-trip type="button">Delete trip</button>' : '') +
        '<span class="spacer"></span>' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
        '<button class="btn" data-save-trip type="button">Save</button>' +
      '</div>';

    util.modal('Trip settings', html, function (body) {
      const name = body.querySelector('[data-trip-name]');
      const start = body.querySelector('[data-trip-start]');
      const end = body.querySelector('[data-trip-end]');
      const counter = body.querySelector('[data-day-count]');

      function updateCount() {
        const count = util.datesBetween(start.value, end.value).length;
        counter.textContent = count
          ? count + ' day tiles.'
          : 'Those dates do not make a trip — the last day must come after the first.';
      }
      start.addEventListener('change', updateCount);
      end.addEventListener('change', updateCount);

      body.querySelector('[data-save-trip]').addEventListener('click', function () {
        if (!util.datesBetween(start.value, end.value).length) {
          util.toast('Check the dates — the last day must come after the first.');
          return;
        }
        store.updateTrip({ name: name.value.trim() || 'Trip', start: start.value, end: end.value });
        util.closeModal();
        util.toast('Trip updated.');
      });

      const del = body.querySelector('[data-delete-trip]');
      if (del) {
        del.addEventListener('click', function () {
          util.confirm('Delete "' + trip.name + '"? Its looks and calendar go with it. Your closet is untouched.', function () {
            store.deleteTrip(trip.id);
            show('closet');
            util.toast('Trip deleted.');
          });
        });
      }
    });
  }

  function openNewTrip() {
    const html = '' +
      '<div class="field">' +
        '<label for="n-name">Where are you going?</label>' +
        '<input id="n-name" type="text" data-new-name placeholder="Milan · September">' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="n-start">First day</label><input id="n-start" type="date" data-new-start></div>' +
        '<div class="field"><label for="n-end">Last day</label><input id="n-end" type="date" data-new-end></div>' +
      '</div>' +
      '<p class="harmony__note">A trip starts empty and draws on the same closet.</p>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
        '<button class="btn" data-create-trip type="button">Create trip</button>' +
      '</div>';

    util.modal('New trip', html, function (body) {
      body.querySelector('[data-create-trip]').addEventListener('click', function () {
        const name = body.querySelector('[data-new-name]').value.trim();
        const start = body.querySelector('[data-new-start]').value;
        const end = body.querySelector('[data-new-end]').value;
        if (!name) { util.toast('Give the trip a name.'); return; }
        if (!util.datesBetween(start, end).length) { util.toast('Check the dates.'); return; }
        PT.store.createTrip({ name: name, start: start, end: end });
        util.closeModal();
        show('trip');
        util.toast('Trip created.');
      });
    });
  }

  /* ---- closet settings (backup lives here) --------------------------------- */

  function openClosetSettings() {
    const html = '' +
      '<div class="field">' +
        '<span class="field-label">Backup</span>' +
        '<p class="harmony__note">Everything lives in this browser. Export a file before clearing your ' +
        'browsing data, or to move the closet to another laptop.</p>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn btn--ghost btn--sm" data-export type="button">Export backup</button>' +
          '<label class="btn btn--ghost btn--sm" style="cursor:pointer">Import backup' +
            '<input type="file" accept="application/json" data-import hidden></label>' +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<span class="field-label">From your orders</span>' +
        '<p class="harmony__note">Add pieces straight from shop order emails, pictures included.</p>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn btn--ghost btn--sm" data-open-import type="button">Import from orders</button>' +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<span class="field-label">Danger</span>' +
        '<div class="row" style="margin-top:6px">' +
          '<button class="btn btn--quiet btn--sm" data-clear type="button">Erase everything</button>' +
        '</div>' +
      '</div>' +
      '<div class="modal__actions">' +
        '<button class="btn" data-close-modal type="button">Done</button>' +
      '</div>';

    util.modal('Settings', html, function (body) {
      body.querySelector('[data-export]').addEventListener('click', function () {
        util.download('outfit-planner-backup.json', PT.store.exportJSON(), 'application/json');
      });
      body.querySelector('[data-open-import]').addEventListener('click', function () {
        util.closeModal();
        PT.importer.open();
      });
      body.querySelector('[data-import]').addEventListener('change', function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            PT.store.importJSON(reader.result);
            util.closeModal();
            util.toast('Backup restored.');
          } catch (err) {
            util.toast(err.message || 'That file could not be read.');
          }
        };
        reader.readAsText(file);
      });
      body.querySelector('[data-clear]').addEventListener('click', function () {
        util.confirm('Erase the whole closet, every trip and every saved look? This cannot be undone.', function () {
          PT.store.clearAll();
          show('closet');
          util.toast('Everything erased.');
        }, 'Erase everything');
      });
    });
  }

  /* ---- boot ---------------------------------------------------------------- */

  function init() {
    Object.keys(VIEWS).forEach(function (key) {
      VIEWS[key].root = document.getElementById('view-' + key);
      const module = PT[VIEWS[key].module];
      if (module && module.bind) module.bind(VIEWS[key].root);
    });

    document.addEventListener('click', function (event) {
      const tab = event.target.closest('[data-view]');
      if (tab) { show(tab.dataset.view); return; }

      const tripTab = event.target.closest('[data-trip-tab]');
      if (tripTab) {
        PT.store.setActiveTrip(tripTab.dataset.tripTab);
        show(inTrip() ? current : 'trip');
        return;
      }

      if (event.target.closest('[data-new-trip]')) { openNewTrip(); return; }

      const jump = event.target.closest('[data-goto]');
      if (jump) show(jump.dataset.goto);
    });

    document.getElementById('btn-settings').addEventListener('click', function () {
      if (inTrip()) openTripSettings();
      else openClosetSettings();
    });

    PT.store.subscribe(function () { rerender(); });

    // A deployment may ship a starter wardrobe; applied once, before first paint.
    const seeded = PT.store.seedIfEmpty();
    if (seeded) console.info('Loaded ' + seeded + ' starter pieces.');

    const hash = (location.hash || '').replace('#', '');
    show(VIEWS[hash] ? hash : 'closet');

    window.addEventListener('online', function () { if (inTrip()) PT.weather.refresh(false); });
  }

  PT.app = { show: show, rerender: rerender, openTripSettings: openTripSettings };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
