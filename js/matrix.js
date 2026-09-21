/*
 * Every top x bottom combination in one grid, so a small wardrobe's real
 * output is visible at a glance — plus a flag on any piece that appears in
 * fewer than two saved looks.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  let scope = 'packed';   // 'packed' = items used in a saved look, 'all' = whole closet

  function pool(categoryId) {
    const store = PT.store;
    const items = store.itemsIn(categoryId);
    if (scope === 'all') return items;
    return items.filter(function (item) { return store.usageCount(item.id) > 0; });
  }

  /* Pairs already worn together in a saved look. */
  function savedPairs() {
    const set = {};
    PT.store.get().outfits.forEach(function (outfit) {
      const slots = outfit.slots || {};
      if (slots.top && slots.bottom) set[slots.top + '::' + slots.bottom] = true;
    });
    return set;
  }

  function statsHTML(tops, bottoms, dresses) {
    const store = PT.store;
    let workable = 0;
    tops.forEach(function (top) {
      bottoms.forEach(function (bottom) {
        if (PT.colors.pairScore(top.color, bottom.color) >= 0.5) workable++;
      });
    });
    const total = tops.length * bottoms.length + dresses.length;
    const pieces = tops.length + bottoms.length + dresses.length;
    const looks = store.get().outfits.length;

    return '' +
      '<div class="stat-row">' +
        '<div class="stat"><div class="stat__n">' + total + '</div>' +
          '<div class="stat__label">Possible looks</div></div>' +
        '<div class="stat"><div class="stat__n">' + (workable + dresses.length) + '</div>' +
          '<div class="stat__label">That actually match</div></div>' +
        '<div class="stat"><div class="stat__n">' + pieces + '</div>' +
          '<div class="stat__label">Pieces involved</div></div>' +
        '<div class="stat"><div class="stat__n">' + looks + '</div>' +
          '<div class="stat__label">Looks saved</div></div>' +
      '</div>';
  }

  function headerCellHTML(item) {
    return '<th class="matrix__thumb"><div class="th-inner">' + util.thumb(item) +
      '<span class="matrix__label">' + util.esc(item.name) + '</span></div></th>';
  }

  function tableHTML(tops, bottoms) {
    const saved = savedPairs();

    const head = '<thead><tr><th class="matrix__thumb"></th>' +
      bottoms.map(headerCellHTML).join('') + '</tr></thead>';

    const rows = tops.map(function (top) {
      const cells = bottoms.map(function (bottom) {
        const score = PT.colors.pairScore(top.color, bottom.color);
        const label = PT.colors.pairLabel(score);
        const isSaved = saved[top.id + '::' + bottom.id];
        const cls = isSaved ? 'cell cell--saved' : 'cell cell--' + label;
        const glyph = isSaved ? '&#9679;' : (label === 'strong' ? '&#10003;' : label === 'ok' ? '&#8226;' : '&times;');
        const title = top.name + ' + ' + bottom.name + ' — ' +
          (isSaved ? 'saved as a look' : label === 'strong' ? 'strong match' : label === 'ok' ? 'wearable' : 'clashes');
        return '<td class="' + cls + '" title="' + util.esc(title) + '" ' +
          'data-pair-top="' + util.esc(top.id) + '" data-pair-bottom="' + util.esc(bottom.id) + '">' + glyph + '</td>';
      }).join('');
      return '<tr>' + headerCellHTML(top) + cells + '</tr>';
    }).join('');

    return '<div class="matrix-wrap"><table class="matrix">' + head + '<tbody>' + rows + '</tbody></table></div>' +
      '<div class="matrix-legend">' +
        '<span><i style="background:var(--ink)"></i>Saved as a look</span>' +
        '<span><i style="background:rgba(63,107,79,.2)"></i>Strong match</span>' +
        '<span><i style="background:rgba(0,0,0,.05)"></i>Wearable</span>' +
        '<span><i></i>Clashes</span>' +
      '</div>';
  }

  function underusedHTML() {
    const store = PT.store;
    const zero = store.get().items.filter(function (i) { return store.usageCount(i.id) === 0; });
    const once = store.get().items.filter(function (i) { return store.usageCount(i.id) === 1; });
    if (!zero.length && !once.length) {
      return '<div class="note note--calm">Every piece in the closet is pulling its weight. Pack with confidence.</div>';
    }

    function group(title, list, tone) {
      if (!list.length) return '';
      return '' +
        '<section class="category-block">' +
          '<div class="category-block__head"><h3>' + util.esc(title) + '</h3>' +
            '<span class="category-block__count">' + util.pluralize(list.length, 'piece') + '</span></div>' +
          '<div class="closet-grid">' +
            list.map(function (item) {
              return '' +
                '<article class="card" data-item="' + util.esc(item.id) + '">' +
                  '<div class="card__frame">' + util.thumb(item) +
                    '<div class="card__badges"><span class="badge badge--alert">' + util.esc(tone) + '</span></div>' +
                  '</div>' +
                  '<div class="card__body">' +
                    '<div class="card__name">' + util.esc(item.name) + '</div>' +
                    '<div class="card__meta"><span class="swatch" style="background:' + util.esc(item.color) + '"></span>' +
                      '<span>' + util.esc(PT.colors.nameFor(item.color)) + '</span></div>' +
                  '</div>' +
                '</article>';
            }).join('') +
          '</div>' +
        '</section>';
    }

    return '' +
      '<div class="note note--alert">' +
        '<strong>' + util.pluralize(zero.length + once.length, 'piece') + '</strong> ' +
        'appear' + (zero.length + once.length === 1 ? 's' : '') + ' in fewer than two saved looks. ' +
        'Either build a second look around each one, or leave it at home.' +
      '</div>' +
      group('Not in any look', zero, 'Unused') +
      group('In only one look', once, 'Once');
  }

  function render(root) {
    const tops = pool('tops');
    const bottoms = pool('bottoms');
    const dresses = pool('dresses');

    const head = '' +
      '<div class="section-head">' +
        '<h2>Combinations</h2>' +
        '<div class="section-head__aside">' +
          '<div class="seg">' +
            '<button data-scope="packed" aria-pressed="' + (scope === 'packed') + '" type="button">Packed pieces</button>' +
            '<button data-scope="all" aria-pressed="' + (scope === 'all') + '" type="button">Whole closet</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (!tops.length || !bottoms.length) {
      const why = scope === 'packed'
        ? 'Save a look or two first — this grid is built from the pieces you have actually used.'
        : 'Add tops and bottoms to the closet to see the grid.';
      root.innerHTML = head +
        '<div class="empty-state"><h3>Not enough to combine yet</h3><p>' + util.esc(why) + '</p></div>' +
        underusedHTML();
      return;
    }

    root.innerHTML = head +
      '<p class="lede">' + tops.length + ' tops against ' + bottoms.length + ' bottoms' +
        (dresses.length ? ', plus ' + util.pluralize(dresses.length, 'dress', 'dresses') +
          (dresses.length === 1 ? ' that stands alone' : ' that stand alone') : '') +
        '. Tap any cell to build that pairing.</p>' +
      statsHTML(tops, bottoms, dresses) +
      tableHTML(tops, bottoms) +
      '<section style="margin-top:clamp(30px,5vw,56px)">' +
        '<div class="category-block__head"><h3>Earning their space</h3></div>' +
        underusedHTML() +
      '</section>';
  }

  function bind(root) {
    util.on(root, 'click', '[data-scope]', function (e, btn) {
      scope = btn.dataset.scope;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-pair-top]', function (e, cell) {
      PT.builder.startPair(cell.dataset.pairTop, cell.dataset.pairBottom);
    });
  }

  PT.matrix = { render: render, bind: bind };
})();
