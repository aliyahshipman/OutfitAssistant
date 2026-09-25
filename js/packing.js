/*
 * The packing list is derived, never typed: it is exactly the set of pieces
 * that appear in at least one saved look. Anything else is explicitly listed
 * as staying home.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  let hidePacked = false;

  function bagLabel(id) {
    const bag = PT.store.BAGS.filter(function (b) { return b.id === id; })[0];
    return bag ? bag.label : id;
  }

  function rowHTML(item) {
    const store = PT.store;
    const packing = store.packingFor(item.id);
    const uses = store.usageCount(item.id);
    const options = store.BAGS.map(function (bag) {
      return '<option value="' + bag.id + '"' + (packing.bag === bag.id ? ' selected' : '') + '>' + util.esc(bag.label) + '</option>';
    }).join('');

    return '' +
      '<tr class="' + (packing.packed ? 'is-packed' : '') + '" data-pack-item="' + util.esc(item.id) + '">' +
        '<td data-col="item">' +
          '<div class="pk-item">' + util.thumb(item) +
            '<div>' +
              '<div class="pk-name">' + util.esc(item.name) + '</div>' +
              '<div class="pk-sub">' + util.esc(PT.colors.nameFor(item.color)) +
                (item.subtype ? ' · ' + util.esc(item.subtype) : '') +
                ' · ' + util.pluralize(uses, 'look') +
                (item.agency ? ' · agency' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td data-col="bag"><select class="bag-select" data-bag>' + options + '</select></td>' +
        '<td data-col="packed" style="text-align:right">' +
          '<input class="pk-check" type="checkbox" data-packed ' + (packing.packed ? 'checked' : '') +
          ' aria-label="Packed"></td>' +
      '</tr>';
  }

  function summaryHTML(items) {
    const store = PT.store;
    const counts = { carry: 0, checked: 0, personal: 0 };
    let packed = 0;
    items.forEach(function (item) {
      const entry = store.packingFor(item.id);
      if (counts[entry.bag] != null) counts[entry.bag]++;
      if (entry.packed) packed++;
    });

    return '' +
      '<div class="stat-row">' +
        '<div class="stat"><div class="stat__n">' + items.length + '</div><div class="stat__label">Pieces to pack</div></div>' +
        '<div class="stat"><div class="stat__n">' + counts.carry + '</div><div class="stat__label">Carry-on</div></div>' +
        '<div class="stat"><div class="stat__n">' + counts.checked + '</div><div class="stat__label">Checked bag</div></div>' +
        '<div class="stat"><div class="stat__n">' + counts.personal + '</div><div class="stat__label">Personal item</div></div>' +
        '<div class="stat"><div class="stat__n">' + packed + '/' + items.length + '</div><div class="stat__label">Physically packed</div></div>' +
      '</div>';
  }

  function render(root) {
    const store = PT.store;
    const packedItems = store.packedItems();
    const unused = store.tripItems().filter(function (i) { return store.usageCount(i.id) === 0; });

    const head = '' +
      '<div class="section-head">' +
        '<h2>Packing List</h2>' +
        '<div class="section-head__aside">' +
          '<button class="chip" data-hide-packed aria-pressed="' + hidePacked + '" type="button">Hide packed</button>' +
          '<button class="btn btn--ghost" data-print type="button">Print</button>' +
          '<button class="btn btn--ghost" data-export-list type="button">Save as page</button>' +
        '</div>' +
      '</div>';

    if (!packedItems.length) {
      root.innerHTML = head +
        '<div class="empty-state">' +
          '<h3>Nothing to pack yet</h3>' +
          '<p>This list builds itself from your saved looks — a piece only earns a place in the suitcase ' +
          'once it appears in at least one outfit.</p>' +
          '<button class="btn" data-goto="builder" type="button">Build a look</button>' +
        '</div>';
      return;
    }

    const byCategory = store.CATEGORIES.map(function (cat) {
      let inCat = store.byRecency(packedItems.filter(function (i) { return i.category === cat.id; }));
      if (hidePacked) inCat = inCat.filter(function (i) { return !store.packingFor(i.id).packed; });
      if (!inCat.length) return '';
      return '' +
        '<section class="category-block">' +
          '<div class="category-block__head"><h3>' + util.esc(cat.label) + '</h3>' +
            '<span class="category-block__count">' + util.pluralize(inCat.length, 'piece') + '</span></div>' +
          '<table class="packing-table">' +
            '<thead><tr><th>Piece</th><th>Goes in</th><th style="text-align:right">Packed</th></tr></thead>' +
            '<tbody>' + inCat.map(rowHTML).join('') + '</tbody>' +
          '</table>' +
        '</section>';
    }).join('');

    const leaveBehind = unused.length
      ? '<section class="leave-behind">' +
          '<p class="eyebrow">Staying home</p>' +
          '<p class="harmony__note">' + util.pluralize(unused.length, 'piece') +
            ' you picked for this trip never made it into a look. That is the overpacking, caught early.</p>' +
          '<ul>' + unused.map(function (i) { return '<li>' + util.esc(i.name) + '</li>'; }).join('') + '</ul>' +
        '</section>'
      : '';

    root.innerHTML = head + summaryHTML(packedItems) + byCategory + leaveBehind;
  }

  /* A standalone, self-contained HTML page for printing or sharing. */
  function exportPage() {
    const store = PT.store;
    const trip = store.trip();
    const items = store.packedItems();

    const sections = store.CATEGORIES.map(function (cat) {
      const inCat = store.byRecency(items.filter(function (i) { return i.category === cat.id; }));
      if (!inCat.length) return '';
      const rows = inCat.map(function (item) {
        const packing = store.packingFor(item.id);
        return '<tr><td>&#9744;</td><td>' + util.esc(item.name) + '</td><td>' +
          util.esc(PT.colors.nameFor(item.color)) + '</td><td>' + util.esc(bagLabel(packing.bag)) + '</td></tr>';
      }).join('');
      return '<h2>' + util.esc(cat.label) + '</h2><table>' +
        '<thead><tr><th></th><th>Piece</th><th>Colour</th><th>Goes in</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>';
    }).join('');

    /* The clothes are only half the suitcase, so the page she prints carries
       the essentials and the to-dos with them. */
    const essentials = store.ESSENTIAL_GROUPS.map(function (group) {
      const rows = store.essentialsIn(group.id);
      if (!rows.length) return '';
      return '<h3>' + util.esc(group.label) + '</h3><table>' +
        '<tbody>' + rows.map(function (row) {
          return '<tr><td>' + (row.packed ? '&#9745;' : '&#9744;') + '</td><td>' +
            util.esc(row.name) + '</td><td>' +
            ((Number(row.qty) || 1) > 1 ? '&times;' + (Number(row.qty) || 1) : '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).join('');

    const todos = store.todos().map(function (row) {
      return '<tr><td>' + (row.done ? '&#9745;' : '&#9744;') + '</td><td>' + util.esc(row.text) +
        '</td><td>' + util.esc(row.due ? util.formatDate(row.due, { day: 'numeric', month: 'short' }) : '') +
        '</td></tr>';
    }).join('');

    const schedule = store.tripDates().map(function (date) {
      const entry = store.day(date);
      const dayOutfit = entry.day ? store.outfitById(entry.day) : null;
      const nightOutfit = entry.night ? store.outfitById(entry.night) : null;
      return '<tr><td>' + util.esc(util.weekday(date) + ' ' + util.formatDate(date, { day: 'numeric', month: 'short' })) + '</td>' +
        '<td>' + (entry.agency ? 'Agency' : '') + '</td>' +
        '<td>' + util.esc(dayOutfit ? dayOutfit.name : '—') + '</td>' +
        '<td>' + util.esc(nightOutfit ? nightOutfit.name : '—') + '</td></tr>';
    }).join('');

    const html = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Packing list · ' + util.esc(trip.name) + '</title><style>' +
      'body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#14120f;line-height:1.5}' +
      'h1{font-size:34px;margin:0 0 4px;font-weight:400}' +
      'p.dates{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8d867c;margin:0 0 30px}' +
      'h2{font-size:17px;font-weight:400;border-bottom:1px solid #14120f;padding-bottom:6px;margin:28px 0 10px}' +
      'table{width:100%;border-collapse:collapse;font-size:14px}' +
      'th{text-align:left;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#8d867c;font-weight:400;padding:4px 8px 4px 0}' +
      'td{border-bottom:1px solid #eee;padding:7px 8px 7px 0}' +
      'td:first-child{width:20px}h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;' +
      'color:#8d867c;font-weight:400;margin:18px 0 4px}@media print{body{margin:0}}' +
      '</style></head><body>' +
      '<h1>' + util.esc(trip.name) + '</h1>' +
      '<p class="dates">' + util.esc(util.formatDate(trip.start) + ' – ' + util.formatDate(trip.end, { day: 'numeric', month: 'long', year: 'numeric' })) +
        ' · ' + util.pluralize(items.length, 'piece') + '</p>' +
      sections +
      (essentials ? '<h2>Essentials</h2>' + essentials : '') +
      (todos ? '<h2>Before you go</h2><table><tbody>' + todos + '</tbody></table>' : '') +
      (schedule ? '<h2>The plan</h2><table><thead><tr><th>Day</th><th></th><th>Day look</th><th>Night look</th></tr></thead><tbody>' +
        schedule + '</tbody></table>' : '') +
      '</body></html>';

    util.download('paris-packing-list.html', html, 'text/html;charset=utf-8');
    util.toast('Saved as a page you can open or send.');
  }

  function bind(root) {
    util.on(root, 'change', '[data-bag]', function (e, select) {
      const id = select.closest('[data-pack-item]').dataset.packItem;
      PT.store.setPacking(id, { bag: select.value });
    });
    root.addEventListener('change', function (event) {
      if (!event.target.matches('[data-packed]')) return;
      const id = event.target.closest('[data-pack-item]').dataset.packItem;
      PT.store.setPacking(id, { packed: event.target.checked });
    });
    util.on(root, 'click', '[data-hide-packed]', function () {
      hidePacked = !hidePacked;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-print]', function () { window.print(); });
    util.on(root, 'click', '[data-export-list]', exportPage);
  }

  PT.packing = { render: render, bind: bind };
})();
