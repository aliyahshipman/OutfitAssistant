/*
 * Import pieces from shop order emails.
 *
 * The app has no backend and cannot read your mail itself. It takes a JSON
 * file of parsed orders (format "outfit-planner/orders@1") and shows every
 * line item for review, because an order email records what was *bought*, not
 * what was kept — returns, wrong sizes and gifts all look identical to a
 * receipt. Nothing enters the closet until it is ticked here.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  let rows = [];        // { draft, chosen, duplicate }
  let meta = null;

  function normalise(payload) {
    if (!payload || !Array.isArray(payload.orders)) {
      throw new Error('That file is not an order export.');
    }
    const out = [];
    payload.orders.forEach(function (order) {
      (order.items || []).forEach(function (item) {
        if (!item || !item.name) return;
        out.push({
          name: String(item.name),
          brand: String(item.brand || ''),
          size: String(item.size || ''),
          color: /^#[0-9a-f]{3,6}$/i.test(item.color || '') ? item.color : '#141414',
          colorName: String(item.colorName || ''),
          category: PT.store.category(item.category) ? item.category : 'tops',
          subtype: String(item.subtype || ''),
          photoUrl: /^https?:\/\//i.test(item.photoUrl || '') ? item.photoUrl : '',
          link: /^https?:\/\//i.test(item.link || '') ? item.link : '',
          retailer: String(payload.retailer || order.retailer || ''),
          orderNumber: String(order.orderNumber || ''),
          orderedAt: String(order.orderedAt || ''),
          source: 'order-email',
          agency: false,
          time: 'both'
        });
      });
    });
    return out;
  }

  function rowHTML(entry, index) {
    const draft = entry.draft;
    const categories = PT.store.CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '"' + (draft.category === c.id ? ' selected' : '') + '>' + util.esc(c.label) + '</option>';
    }).join('');

    return '' +
      '<tr class="imp-row' + (entry.chosen ? '' : ' is-skipped') + '" data-row="' + index + '">' +
        '<td><input class="pk-check" type="checkbox" data-imp-pick ' + (entry.chosen ? 'checked' : '') +
          ' aria-label="Add ' + util.esc(draft.name) + '"></td>' +
        '<td>' +
          '<div class="pk-item">' +
            '<span class="imp-thumb">' + util.thumb(draft) + '</span>' +
            '<div>' +
              '<div class="pk-name">' + util.esc(draft.name) + '</div>' +
              '<div class="pk-sub">' +
                (draft.brand ? util.esc(draft.brand) + ' · ' : '') +
                (draft.colorName ? util.esc(draft.colorName) + ' · ' : '') +
                (draft.size ? 'Size ' + util.esc(draft.size) : '') +
              '</div>' +
              (entry.duplicate ? '<div class="pk-sub" style="color:var(--warn)">Already in the closet</div>' : '') +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><select class="bag-select" data-imp-category>' + categories + '</select></td>' +
        '<td style="text-align:right">' +
          '<button class="chip' + (draft.agency ? ' chip--agency' : '') + '" data-imp-agency ' +
            'aria-pressed="' + draft.agency + '" type="button">Agency</button>' +
        '</td>' +
      '</tr>';
  }

  function reviewHTML() {
    const chosen = rows.filter(function (r) { return r.chosen; }).length;
    const dupes = rows.filter(function (r) { return r.duplicate; }).length;

    return '' +
      '<p class="lede">' + util.pluralize(rows.length, 'piece') + ' found' +
        (meta && meta.retailer ? ' in ' + util.esc(meta.retailer) + ' orders' : '') +
        (meta && meta.window ? ', ' + util.esc(meta.window) : '') + '.</p>' +
      '<div class="note note--calm">These are the pieces you <strong>ordered</strong>. Untick anything you sent ' +
        'back, never wore, or bought for someone else — the closet should only hold what you actually own.' +
        (dupes ? ' ' + util.pluralize(dupes, 'piece') + ' already in the closet ' + (dupes === 1 ? 'is' : 'are') + ' unticked.' : '') +
      '</div>' +
      '<div class="row" style="margin-bottom:10px">' +
        '<button class="btn btn--ghost btn--sm" data-imp-all type="button">Tick all</button>' +
        '<button class="btn btn--ghost btn--sm" data-imp-none type="button">Untick all</button>' +
        '<span class="spacer"></span>' +
        '<span class="category-block__count" data-imp-count>' + chosen + ' selected</span>' +
      '</div>' +
      '<div style="max-height:46vh;overflow:auto">' +
        '<table class="packing-table imp-table">' +
          '<thead><tr><th></th><th>Piece</th><th>Category</th><th style="text-align:right">Tag</th></tr></thead>' +
          '<tbody>' + rows.map(rowHTML).join('') + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="modal__actions">' +
        '<label class="row" style="gap:6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">' +
          '<input type="checkbox" data-imp-cache> Save pictures for offline' +
        '</label>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
        '<button class="btn" data-imp-confirm type="button">Add to closet</button>' +
      '</div>';
  }

  function refreshCount(body) {
    const node = body.querySelector('[data-imp-count]');
    if (node) node.textContent = rows.filter(function (r) { return r.chosen; }).length + ' selected';
  }

  function openReview() {
    util.modal('Review before adding', reviewHTML(), function (body) {
      util.on(body, 'change', '[data-imp-pick]', function (e, input) {
        const index = Number(input.closest('[data-row]').dataset.row);
        rows[index].chosen = input.checked;
        input.closest('.imp-row').classList.toggle('is-skipped', !input.checked);
        refreshCount(body);
      });
      util.on(body, 'change', '[data-imp-category]', function (e, select) {
        rows[Number(select.closest('[data-row]').dataset.row)].draft.category = select.value;
      });
      util.on(body, 'click', '[data-imp-agency]', function (e, btn) {
        const entry = rows[Number(btn.closest('[data-row]').dataset.row)];
        entry.draft.agency = !entry.draft.agency;
        btn.setAttribute('aria-pressed', String(entry.draft.agency));
        btn.classList.toggle('chip--agency', entry.draft.agency);
      });
      util.on(body, 'click', '[data-imp-all]', function () {
        rows.forEach(function (r) { r.chosen = true; });
        util.qsa('[data-imp-pick]', body).forEach(function (i) { i.checked = true; });
        util.qsa('.imp-row', body).forEach(function (r) { r.classList.remove('is-skipped'); });
        refreshCount(body);
      });
      util.on(body, 'click', '[data-imp-none]', function () {
        rows.forEach(function (r) { r.chosen = false; });
        util.qsa('[data-imp-pick]', body).forEach(function (i) { i.checked = false; });
        util.qsa('.imp-row', body).forEach(function (r) { r.classList.add('is-skipped'); });
        refreshCount(body);
      });

      body.querySelector('[data-imp-confirm]').addEventListener('click', function () {
        const picked = rows.filter(function (r) { return r.chosen; }).map(function (r) { return r.draft; });
        if (!picked.length) { util.toast('Tick at least one piece.'); return; }
        const cache = body.querySelector('[data-imp-cache]').checked;
        const ids = PT.store.addItems(picked);
        util.closeModal();
        util.toast('Added ' + util.pluralize(picked.length, 'piece') + ' to the closet.');
        if (cache) cachePhotos(ids);
      });
    });
  }

  /*
   * Pull each product image into a data URL so the closet still has pictures
   * offline. Retailer CDNs may refuse cross-origin reads; when that happens the
   * remote URL stays in place and the picture simply needs a connection.
   */
  function cachePhotos(ids) {
    const items = ids.map(PT.store.itemById).filter(function (i) { return i && i.photoUrl && !i.photo; });
    if (!items.length) return;
    util.toast('Saving ' + util.pluralize(items.length, 'picture') + '…');
    let saved = 0;
    let failed = 0;

    const next = function (index) {
      if (index >= items.length) {
        if (saved) util.toast(saved + ' saved for offline' + (failed ? ', ' + failed + ' could not be' : '') + '.');
        else util.toast('The shop would not release the images — they will still show online.');
        return;
      }
      const item = items[index];
      util.cacheImage(item.photoUrl)
        .then(function (dataUrl) {
          PT.store.saveItem({ id: item.id, photo: dataUrl });
          saved++;
        })
        .catch(function () { failed++; })
        .then(function () { next(index + 1); });
    };
    next(0);
  }

  /* Take parsed JSON text through to the review screen. */
  function accept(text) {
    const payload = JSON.parse(text);
    const drafts = normalise(payload);
    if (!drafts.length) throw new Error('No items found in that data.');
    meta = { retailer: payload.retailer || '', window: payload.window || '' };
    rows = drafts.map(function (draft) {
      const duplicate = Boolean(PT.store.findDuplicate(draft));
      return { draft: draft, chosen: !duplicate, duplicate: duplicate };
    });
    openReview();
  }

  /*
   * Entry point. Two ways in, because moving a file onto a phone is a nuisance:
   * choose the file, or paste its contents.
   */
  function open() {
    const html = '' +
      '<p class="lede">Import the pieces from your shop order emails.</p>' +
      '<div class="note note--calm">Claude reads your order confirmations and writes them out in the ' +
        '<code>outfit-planner/orders@1</code> format. Bring that in here and every line item comes up for ' +
        'review, with its picture, before anything is added to the closet.</div>' +
      '<div class="row">' +
        '<label class="btn" style="cursor:pointer">Choose order file' +
          '<input type="file" accept="application/json,.json,text/plain" data-imp-file hidden></label>' +
        '<span class="harmony__note">or paste it below</span>' +
      '</div>' +
      '<div class="field">' +
        '<label for="imp-paste">Paste order data</label>' +
        '<textarea id="imp-paste" data-imp-paste rows="5" placeholder=\'{ "format": "outfit-planner/orders@1", ... }\' ' +
          'style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;border:1px solid var(--line-firm);padding:8px"></textarea>' +
      '</div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-close-modal type="button">Cancel</button>' +
        '<button class="btn" data-imp-paste-go type="button">Read pasted data</button>' +
      '</div>';

    util.modal('Import from orders', html, function (body) {
      body.querySelector('[data-imp-file]').addEventListener('change', function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try { accept(reader.result); }
          catch (err) { util.toast(err.message || 'That file could not be read.'); }
        };
        reader.readAsText(file);
      });

      body.querySelector('[data-imp-paste-go]').addEventListener('click', function () {
        const text = body.querySelector('[data-imp-paste]').value.trim();
        if (!text) { util.toast('Paste the order data first, or choose a file.'); return; }
        try { accept(text); }
        catch (err) { util.toast(err.message || 'That data could not be read.'); }
      });
    });
  }

  PT.importer = { open: open, cachePhotos: cachePhotos };
})();
