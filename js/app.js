/* App shell: tab routing, masthead, settings, and a single render pass. */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  const VIEWS = {
    closet: { root: null, module: 'closet' },
    builder: { root: null, module: 'builder' },
    matrix: { root: null, module: 'matrix' },
    calendar: { root: null, module: 'calendar' },
    packing: { root: null, module: 'packing' }
  };

  let current = 'closet';

  function renderMasthead() {
    const trip = PT.store.get().trip;
    document.getElementById('trip-title').textContent = trip.name || 'Paris';

    const dates = PT.store.tripDates();
    document.getElementById('trip-dates').textContent = dates.length
      ? util.formatDate(trip.start) + ' – ' + util.formatDate(trip.end, { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Set your dates';

    const countdown = document.getElementById('trip-countdown');
    const days = util.daysUntil(trip.start);
    if (days == null) countdown.textContent = '';
    else if (days > 0) countdown.textContent = days + ' days to go';
    else if (days === 0) countdown.textContent = 'Today';
    else {
      const endDays = util.daysUntil(trip.end);
      countdown.textContent = endDays >= 0 ? 'In Paris now' : 'Trip over';
    }

    // The tab label follows the real trip length rather than a hard-coded count.
    const calendarTab = util.qs('.tab[data-view="calendar"]');
    if (calendarTab) calendarTab.textContent = dates.length ? dates.length + ' Days' : 'Days';

    const meter = document.getElementById('storage-meter');
    const bytes = PT.store.storageBytes();
    const kb = Math.round(bytes / 1024);
    const photos = PT.store.get().items.filter(function (i) { return i.photo; }).length;
    meter.textContent = kb > 0
      ? kb + ' KB used · ' + util.pluralize(photos, 'photo')
      : '';
    // localStorage is ~5 MB; warn before a save starts failing.
    meter.style.color = bytes > 4000000 ? 'var(--accent)' : '';
  }

  function rerender() {
    renderMasthead();
    const view = VIEWS[current];
    if (view && PT[view.module] && view.root) PT[view.module].render(view.root);
  }

  function show(name) {
    if (!VIEWS[name]) return;
    current = name;
    Object.keys(VIEWS).forEach(function (key) {
      VIEWS[key].root.hidden = key !== name;
    });
    util.qsa('.tab').forEach(function (tab) {
      tab.setAttribute('aria-selected', String(tab.dataset.view === name));
    });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
    rerender();
  }

  /* ---- settings ------------------------------------------------------ */

  function openSettings() {
    const trip = PT.store.get().trip;
    const dates = PT.store.tripDates();

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
      '<p class="harmony__note" data-day-count>' + dates.length + ' day tiles.</p>' +

      '<div class="field">' +
        '<span class="field-label">Backup</span>' +
        '<p class="harmony__note">Everything lives in this browser. Export a file before clearing your ' +
        'browsing data, or to move the plan to another laptop.</p>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn btn--ghost btn--sm" data-export type="button">Export backup</button>' +
          '<label class="btn btn--ghost btn--sm" style="cursor:pointer">Import backup' +
            '<input type="file" accept="application/json" data-import hidden></label>' +
          '<span class="spacer"></span>' +
          '<button class="btn btn--quiet btn--sm" data-clear type="button">Erase everything</button>' +
        '</div>' +
      '</div>' +

      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
        '<button class="btn" data-save-trip type="button">Save</button>' +
      '</div>';

    util.modal('Trip settings', html, function (body) {
      const nameInput = body.querySelector('[data-trip-name]');
      const startInput = body.querySelector('[data-trip-start]');
      const endInput = body.querySelector('[data-trip-end]');
      const counter = body.querySelector('[data-day-count]');

      function updateCount() {
        const count = util.datesBetween(startInput.value, endInput.value).length;
        counter.textContent = count
          ? count + ' day tiles.'
          : 'Those dates do not make a trip — the last day must come after the first.';
      }
      startInput.addEventListener('change', updateCount);
      endInput.addEventListener('change', updateCount);

      body.querySelector('[data-save-trip]').addEventListener('click', function () {
        if (!util.datesBetween(startInput.value, endInput.value).length) {
          util.toast('Check the dates — the last day must come after the first.');
          return;
        }
        PT.store.update(function (s) {
          s.trip = { name: nameInput.value.trim() || 'Paris', start: startInput.value, end: endInput.value };
        });
        util.closeModal();
        util.toast('Trip updated.');
      });

      body.querySelector('[data-export]').addEventListener('click', function () {
        util.download('paris-outfit-planner-backup.json', PT.store.exportJSON(), 'application/json');
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
        util.confirm('Erase the whole closet, every saved look and the calendar? This cannot be undone.', function () {
          PT.store.clearAll();
          util.toast('Everything erased.');
        }, 'Erase everything');
      });
    });
  }

  /* ---- boot ----------------------------------------------------------- */

  function init() {
    Object.keys(VIEWS).forEach(function (key) {
      VIEWS[key].root = document.getElementById('view-' + key);
      const module = PT[VIEWS[key].module];
      if (module && module.bind) module.bind(VIEWS[key].root);
    });

    util.qsa('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { show(tab.dataset.view); });
    });

    /* Cross-view shortcuts, e.g. an empty state pointing at another tab. */
    document.addEventListener('click', function (event) {
      const jump = event.target.closest('[data-goto]');
      if (jump) show(jump.dataset.goto);
    });

    document.getElementById('btn-settings').addEventListener('click', openSettings);

    // Re-render on every state change so views never drift from the data.
    PT.store.subscribe(function () { rerender(); });

    const hash = (location.hash || '').replace('#', '');
    show(VIEWS[hash] ? hash : 'closet');

    PT.weather.refresh(false);
    window.addEventListener('online', function () { PT.weather.refresh(false); });
  }

  PT.app = { show: show, rerender: rerender, openSettings: openSettings };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
