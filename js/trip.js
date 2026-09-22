/*
 * The trip's shortlist: which pieces of the closet are actually coming.
 * Everything downstream — the builder, the matrix, the packing list — works
 * only from what is picked here.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  const filters = { category: 'all', agency: false, shortlisted: 'all', search: '' };

  function matches(item) {
    const store = PT.store;
    if (filters.category !== 'all' && item.category !== filters.category) return false;
    if (filters.agency && !item.agency) return false;
    if (filters.shortlisted === 'in' && !store.inTrip(item.id)) return false;
    if (filters.shortlisted === 'out' && store.inTrip(item.id)) return false;
    if (filters.search) {
      const hay = (item.name + ' ' + (item.brand || '') + ' ' +
        (item.retailer || '') + ' ' + (item.subtype || '')).toLowerCase();
      if (hay.indexOf(filters.search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function cardHTML(item) {
    const store = PT.store;
    const picked = store.inTrip(item.id);
    return '' +
      '<article class="card card--pick' + (picked ? ' is-picked' : '') + '" data-item="' + util.esc(item.id) + '">' +
        '<button class="card__frame" type="button" data-toggle-trip aria-pressed="' + picked + '" ' +
          'aria-label="' + (picked ? 'Remove from trip' : 'Add to trip') + '">' +
          util.thumb(item) +
          '<span class="card__badges">' +
            (item.agency ? '<span class="badge badge--agency">Agency</span>' : '') +
          '</span>' +
          '<span class="pick-mark">' + (picked ? '&#10003;' : '&#43;') + '</span>' +
          (item.status === 'ontheway'
            ? '<span class="card__badges" style="top:auto;bottom:8px;left:8px">' +
                (store.arrivalRisk(item) === 'late'
                  ? '<span class="badge badge--alert">Arrives late</span>'
                  : '<span class="badge badge--way">On the way</span>') +
              '</span>'
            : '') +
        '</button>' +
        '<div class="card__body">' +
          '<div class="card__name">' + util.esc(item.name) + '</div>' +
          '<div class="card__meta">' +
            '<span class="swatch" style="background:' + util.esc(item.color) + '"></span>' +
            (item.brand ? '<span>' + util.esc(item.brand) + '</span>' : '') +
          '</div>' +
          (item.retailer ? '<div class="card__source">' + util.esc(item.retailer) + '</div>' : '') +
        '</div>' +
      '</article>';
  }

  function summaryHTML() {
    const store = PT.store;
    const picked = store.tripItems();
    const counts = {};
    picked.forEach(function (i) { counts[i.category] = (counts[i.category] || 0) + 1; });

    const tops = counts.tops || 0;
    // Jeans, trousers, shorts and skirts all count as a lower half.
    const bottoms = store.expand('bottoms').reduce(function (sum, id) {
      return sum + (counts[id] || 0);
    }, 0);
    const dresses = counts.dresses || 0;
    const looks = tops * bottoms + dresses;
    const days = store.tripDates().length;

    let verdict;
    if (!picked.length) verdict = 'Pick the pieces you are considering. Nothing is packed until it is chosen here.';
    else if (looks < days) verdict = 'Fewer distinct looks than days. Add a top or a bottom that works with what you have.';
    else if (picked.length > days * 2) verdict = 'That is a lot of pieces for ' + days + ' days. The matrix will show which ones are not earning their space.';
    else verdict = looks + ' possible looks from ' + picked.length + ' pieces, across ' + days + ' days. That is a capsule.';

    const atRisk = store.atRiskForTrip();
    const riskNote = atRisk.length
      ? '<div class="note note--alert">' +
          '<strong>' + util.pluralize(atRisk.length, 'piece') + '</strong> you have picked ' +
          (atRisk.length === 1 ? 'has' : 'have') + ' not arrived yet: ' +
          util.esc(atRisk.slice(0, 4).map(function (i) { return i.name; }).join(', ')) +
          (atRisk.length > 4 ? ' and ' + (atRisk.length - 4) + ' more' : '') +
          '. Build a look that does not depend on ' + (atRisk.length === 1 ? 'it' : 'them') + ' as a backup.' +
        '</div>'
      : '';

    return '' +
      riskNote +
      '<div class="stat-row">' +
        '<div class="stat"><div class="stat__n">' + picked.length + '</div><div class="stat__label">Pieces chosen</div></div>' +
        '<div class="stat"><div class="stat__n">' + looks + '</div><div class="stat__label">Possible looks</div></div>' +
        '<div class="stat"><div class="stat__n">' + days + '</div><div class="stat__label">Days away</div></div>' +
        '<div class="stat"><div class="stat__n">' + (counts.shoes || 0) + '</div><div class="stat__label">Pairs of shoes</div></div>' +
      '</div>' +
      '<p class="lede">' + util.esc(verdict) + '</p>';
  }

  function render(root) {
    const store = PT.store;
    const closet = store.get().items;

    if (!closet.length) {
      root.innerHTML = '' +
        '<div class="section-head"><h2>What\u2019s coming</h2></div>' +
        '<div class="empty-state">' +
          '<h3>Your closet is empty</h3>' +
          '<p>Add pieces to the closet first — or import them from your order emails — then choose which ones ' +
          'are coming on this trip.</p>' +
          '<button class="btn" data-goto="closet" type="button">Go to the closet</button>' +
        '</div>';
      return;
    }

    const visible = store.byRecency(closet.filter(matches));
    const catChips = ['all'].concat(store.CATEGORIES.map(function (c) { return c.id; }))
      .map(function (id) {
        const label = id === 'all' ? 'Everything' : store.category(id).label;
        return '<button class="chip" data-tf-category="' + id + '" aria-pressed="' +
          (filters.category === id) + '" type="button">' + util.esc(label) + '</button>';
      }).join('');

    root.innerHTML = '' +
      '<div class="section-head">' +
        '<h2>What\u2019s coming</h2>' +
        '<div class="section-head__aside">' +
          '<span class="category-block__count">' + store.tripItems().length + ' of ' +
            util.pluralize(closet.length, 'piece') + '</span>' +
          '<button class="btn btn--ghost btn--sm" data-clear-shortlist type="button">Clear</button>' +
        '</div>' +
      '</div>' +
      summaryHTML() +
      '<div class="filters"><div class="filters__group">' + catChips + '</div></div>' +
      '<div class="filters">' +
        '<div class="filters__group">' +
          '<div class="seg">' +
            '<button data-tf-short="all" aria-pressed="' + (filters.shortlisted === 'all') + '" type="button">All</button>' +
            '<button data-tf-short="in" aria-pressed="' + (filters.shortlisted === 'in') + '" type="button">Chosen</button>' +
            '<button data-tf-short="out" aria-pressed="' + (filters.shortlisted === 'out') + '" type="button">Not chosen</button>' +
          '</div>' +
          '<button class="chip" data-tf-agency aria-pressed="' + filters.agency + '" type="button">Agency-appropriate</button>' +
        '</div>' +
        '<span class="spacer"></span>' +
        '<input class="input" style="width:170px" type="text" data-tf-search placeholder="Search" value="' + util.esc(filters.search) + '">' +
      '</div>' +
      (visible.length
        ? '<div class="closet-grid">' + visible.map(cardHTML).join('') + '</div>'
        : '<div class="empty-state"><h3>Nothing matches</h3><p>Loosen a filter to see more.</p></div>');
  }

  function bind(root) {
    util.on(root, 'click', '[data-toggle-trip]', function (e, btn) {
      PT.store.toggleTripItem(btn.closest('[data-item]').dataset.item);
    });
    util.on(root, 'click', '[data-tf-category]', function (e, btn) {
      filters.category = btn.dataset.tfCategory;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-tf-short]', function (e, btn) {
      filters.shortlisted = btn.dataset.tfShort;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-tf-agency]', function () {
      filters.agency = !filters.agency;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-clear-shortlist]', function () {
      if (!PT.store.tripItems().length) return;
      util.confirm('Take every piece off this trip? The closet itself is not touched.', function () {
        PT.store.setTripItems([]);
      }, 'Clear');
    });
    root.addEventListener('input', function (e) {
      if (!e.target.matches('[data-tf-search]')) return;
      filters.search = e.target.value;
      const caret = e.target.selectionStart;
      PT.app.rerender();
      const next = root.querySelector('[data-tf-search]');
      if (next) { next.focus(); next.setSelectionRange(caret, caret); }
    });
  }

  PT.trip = { render: render, bind: bind };
})();
