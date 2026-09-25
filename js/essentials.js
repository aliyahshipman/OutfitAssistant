/*
 * Everything that goes in the suitcase but does not hang in the closet — the
 * cameras, the chargers, the socks, the shampoo — plus the list of things to do
 * before the taxi comes.
 *
 * Unlike the packing list, which derives itself from saved looks, both of these
 * are typed: they are hers to write, count and tick off.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  let hidePacked = false;
  let hideDone = false;

  /* ---- essentials ------------------------------------------------------- */

  function essentialRow(row) {
    return '' +
      '<li class="ess-row' + (row.packed ? ' is-packed' : '') + '" data-ess="' + util.esc(row.id) + '">' +
        '<label class="ess-row__tick">' +
          '<input type="checkbox" data-ess-packed ' + (row.packed ? 'checked' : '') + '>' +
          '<span class="visually-hidden">Packed</span>' +
        '</label>' +
        '<input class="ess-row__name" type="text" data-ess-name value="' + util.esc(row.name) + '" ' +
          'aria-label="What it is">' +
        '<div class="ess-row__qty">' +
          '<button class="icon-btn icon-btn--tiny" data-ess-step="-1" type="button" aria-label="One fewer">&minus;</button>' +
          '<input type="number" min="1" max="99" data-ess-qty value="' + util.esc(row.qty) + '" aria-label="How many">' +
          '<button class="icon-btn icon-btn--tiny" data-ess-step="1" type="button" aria-label="One more">+</button>' +
        '</div>' +
        '<button class="icon-btn icon-btn--tiny" data-ess-delete type="button" aria-label="Remove ' +
          util.esc(row.name) + '">&times;</button>' +
      '</li>';
  }

  function essentialsHTML() {
    const store = PT.store;
    const all = store.essentials();

    const addForm = '' +
      '<form class="ess-add" data-ess-add>' +
        '<input type="text" data-ess-new required maxlength="60" placeholder="Add something — a charger, a lotion…" ' +
          'aria-label="Add an essential">' +
        '<select data-ess-group aria-label="Which group">' +
          store.ESSENTIAL_GROUPS.map(function (g) {
            return '<option value="' + g.id + '">' + util.esc(g.label) + '</option>';
          }).join('') +
        '</select>' +
        '<button class="btn" type="submit">Add</button>' +
      '</form>';

    if (!all.length) {
      return '' +
        '<section class="panel">' +
          '<div class="section-head"><h2>Travel essentials</h2></div>' +
          '<div class="empty-state">' +
            '<h3>Nothing on the list yet</h3>' +
            '<p>This is the half of packing the closet cannot see: the digital camera and its spare ' +
            'batteries, the portable chargers, socks and underwear by the pair, hair products, makeup, ' +
            'lotion. Start from the usual list and edit it down, or type your own.</p>' +
            '<button class="btn" data-ess-starter type="button">Start from the usual list</button>' +
          '</div>' +
          addForm +
        '</section>';
    }

    const packed = all.filter(function (r) { return r.packed; }).length;
    const pieces = all.reduce(function (n, r) { return n + (Number(r.qty) || 1); }, 0);

    const groups = PT.store.ESSENTIAL_GROUPS.map(function (group) {
      let rows = PT.store.essentialsIn(group.id);
      const total = rows.length;
      if (hidePacked) rows = rows.filter(function (r) { return !r.packed; });
      if (!rows.length) return '';
      const done = PT.store.essentialsIn(group.id).filter(function (r) { return r.packed; }).length;
      return '' +
        '<section class="category-block">' +
          '<div class="category-block__head category-block__head--shelf">' +
            '<h3>' + util.esc(group.label) + '</h3>' +
            '<span class="category-block__count">' + done + ' of ' + total + ' packed</span>' +
          '</div>' +
          '<ul class="ess-list">' + rows.map(essentialRow).join('') + '</ul>' +
        '</section>';
    }).join('');

    return '' +
      '<section class="panel">' +
        '<div class="section-head">' +
          '<h2>Travel essentials</h2>' +
          '<div class="section-head__aside">' +
            '<button class="chip" data-hide-packed aria-pressed="' + hidePacked + '" type="button">Hide packed</button>' +
            '<button class="btn btn--ghost" data-ess-starter type="button">Add the usual</button>' +
          '</div>' +
        '</div>' +
        '<div class="stat-row">' +
          '<div class="stat"><div class="stat__n">' + all.length + '</div><div class="stat__label">Lines</div></div>' +
          '<div class="stat"><div class="stat__n">' + pieces + '</div><div class="stat__label">Things in total</div></div>' +
          '<div class="stat"><div class="stat__n">' + packed + '/' + all.length +
            '</div><div class="stat__label">Packed</div></div>' +
        '</div>' +
        (groups || '<p class="harmony__note">Everything is packed. Turn off “Hide packed” to see the list.</p>') +
        addForm +
      '</section>';
  }

  /* ---- to do ------------------------------------------------------------ */

  function dueLabel(iso) {
    if (!iso) return '';
    const days = util.daysUntil(iso);
    const when = util.formatDate(iso, { day: 'numeric', month: 'short' });
    if (days == null) return when;
    if (days < 0) return when + ' · overdue';
    if (days === 0) return when + ' · today';
    if (days === 1) return when + ' · tomorrow';
    return when + ' · in ' + days + ' days';
  }

  function todoRow(row) {
    const overdue = !row.done && row.due && util.daysUntil(row.due) < 0;
    return '' +
      '<li class="todo-row' + (row.done ? ' is-done' : '') + (overdue ? ' is-overdue' : '') +
        '" data-todo="' + util.esc(row.id) + '">' +
        '<label class="ess-row__tick">' +
          '<input type="checkbox" data-todo-done ' + (row.done ? 'checked' : '') + '>' +
          '<span class="visually-hidden">Done</span>' +
        '</label>' +
        '<input class="ess-row__name" type="text" data-todo-text value="' + util.esc(row.text) + '" ' +
          'aria-label="What to do">' +
        '<div class="todo-row__due">' +
          /* An empty date box on every line is nine "mm/dd/yyyy" placeholders
             shouting at her. Most to-dos never get a date, so ask for one. */
          (row.due
            ? '<input type="date" data-todo-due value="' + util.esc(row.due) + '" aria-label="By when">' +
              '<span class="todo-row__when">' + util.esc(dueLabel(row.due)) + '</span>'
            : '<button class="todo-row__adddate" data-todo-adddate type="button">+ date</button>') +
        '</div>' +
        '<button class="icon-btn icon-btn--tiny" data-todo-delete type="button" aria-label="Remove this to-do">&times;</button>' +
      '</li>';
  }

  /* Open first, then the ones already done. Within each half, a dated task
     comes before an undated one, soonest first. */
  function sortTodos(rows) {
    return rows.slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (!!a.due !== !!b.due) return a.due ? -1 : 1;
      if (a.due !== b.due) return a.due < b.due ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function todosHTML() {
    const store = PT.store;
    const all = store.todos();

    const addForm = '' +
      '<form class="ess-add" data-todo-add>' +
        '<input type="text" data-todo-new required maxlength="120" placeholder="Add a to-do…" aria-label="Add a to-do">' +
        '<input type="date" data-todo-newdue aria-label="By when (optional)">' +
        '<button class="btn" type="submit">Add</button>' +
      '</form>';

    if (!all.length) {
      return '' +
        '<section class="panel">' +
          '<div class="section-head"><h2>To do before you go</h2></div>' +
          '<div class="empty-state">' +
            '<h3>Nothing to do yet</h3>' +
            '<p>The errands that are not packing: the bank, the euros, the offline maps, ' +
            'the appointments to confirm.</p>' +
            '<button class="btn" data-todo-starter type="button">Add the usual to-dos</button>' +
          '</div>' +
          addForm +
        '</section>';
    }

    const open = all.filter(function (r) { return !r.done; });
    const overdue = open.filter(function (r) { return r.due && util.daysUntil(r.due) < 0; }).length;
    let rows = sortTodos(all);
    if (hideDone) rows = rows.filter(function (r) { return !r.done; });

    return '' +
      '<section class="panel">' +
        '<div class="section-head">' +
          '<h2>To do before you go</h2>' +
          '<div class="section-head__aside">' +
            '<button class="chip" data-hide-done aria-pressed="' + hideDone + '" type="button">Hide done</button>' +
            '<button class="btn btn--ghost" data-todo-starter type="button">Add the usual</button>' +
          '</div>' +
        '</div>' +
        '<p class="harmony__note">' +
          (open.length ? util.pluralize(open.length, 'thing') + ' left' : 'All done.') +
          (overdue ? ' · ' + overdue + ' past its date' : '') +
        '</p>' +
        '<ul class="todo-list">' + rows.map(todoRow).join('') + '</ul>' +
        addForm +
      '</section>';
  }

  function render(root) {
    root.innerHTML = essentialsHTML() + todosHTML();
  }

  /* ---- events ----------------------------------------------------------- */

  function essId(el) { return el.closest('[data-ess]').dataset.ess; }
  function todoId(el) { return el.closest('[data-todo]').dataset.todo; }

  function bind(root) {
    const store = PT.store;

    util.on(root, 'click', '[data-hide-packed]', function () {
      hidePacked = !hidePacked;
      PT.app.rerender();
    });
    util.on(root, 'click', '[data-hide-done]', function () {
      hideDone = !hideDone;
      PT.app.rerender();
    });

    util.on(root, 'click', '[data-ess-starter]', function () {
      const added = store.addStarterEssentials();
      util.toast(added ? added + ' added — edit the counts to suit the trip.' : 'The usual list is already there.');
    });
    util.on(root, 'click', '[data-todo-starter]', function () {
      const added = store.addStarterTodos();
      util.toast(added ? added + ' added.' : 'Those are already on the list.');
    });

    util.on(root, 'submit', '[data-ess-add]', function (event, form) {
      event.preventDefault();
      const name = form.querySelector('[data-ess-new]');
      const group = form.querySelector('[data-ess-group]');
      if (!name.value.trim()) return;
      store.addEssential({ name: name.value.trim(), group: group.value });
      name.value = '';
    });

    util.on(root, 'submit', '[data-todo-add]', function (event, form) {
      event.preventDefault();
      const text = form.querySelector('[data-todo-new]');
      const due = form.querySelector('[data-todo-newdue]');
      if (!text.value.trim()) return;
      store.addTodo({ text: text.value.trim(), due: due.value || '' });
      text.value = '';
      due.value = '';
    });

    util.on(root, 'click', '[data-ess-step]', function (event, btn) {
      const id = essId(btn);
      const row = store.essentials().filter(function (r) { return r.id === id; })[0];
      if (!row) return;
      const next = Math.min(99, Math.max(1, (Number(row.qty) || 1) + Number(btn.dataset.essStep)));
      store.updateEssential(id, { qty: next });
    });

    /* Swap the button for a real date field in place, rather than redrawing
       the list, so the picker opens under the finger that asked for it. */
    util.on(root, 'click', '[data-todo-adddate]', function (event, btn) {
      const field = document.createElement('input');
      field.type = 'date';
      field.setAttribute('data-todo-due', '');
      field.setAttribute('aria-label', 'By when');
      btn.replaceWith(field);
      field.focus();
      if (field.showPicker) { try { field.showPicker(); } catch (err) { /* not allowed here */ } }
    });

    util.on(root, 'click', '[data-ess-delete]', function (event, btn) {
      store.deleteEssential(essId(btn));
    });
    util.on(root, 'click', '[data-todo-delete]', function (event, btn) {
      store.deleteTodo(todoId(btn));
    });

    /* A checkbox redraws the list; a text or number field must not, or the
       caret jumps out from under her mid-word. Those save on blur instead. */
    root.addEventListener('change', function (event) {
      const t = event.target;
      if (t.matches('[data-ess-packed]')) {
        store.updateEssential(essId(t), { packed: t.checked });
      } else if (t.matches('[data-todo-done]')) {
        store.updateTodo(todoId(t), { done: t.checked });
      } else if (t.matches('[data-todo-due]')) {
        store.updateTodo(todoId(t), { due: t.value });
      }
    });

    root.addEventListener('blur', function (event) {
      const t = event.target;
      if (t.matches('[data-ess-name]')) {
        const id = essId(t);
        const name = t.value.trim();
        if (name) store.updateEssential(id, { name: name });
        else store.deleteEssential(id);
      } else if (t.matches('[data-ess-qty]')) {
        const qty = Math.min(99, Math.max(1, Number(t.value) || 1));
        store.updateEssential(essId(t), { qty: qty });
      } else if (t.matches('[data-todo-text]')) {
        const id = todoId(t);
        const text = t.value.trim();
        if (text) store.updateTodo(id, { text: text });
        else store.deleteTodo(id);
      }
    }, true);

    /* Enter in a row field means "I am done with this one", not "submit". */
    root.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      if (event.target.matches('[data-ess-name], [data-ess-qty], [data-todo-text]')) {
        event.preventDefault();
        event.target.blur();
      }
    });
  }

  PT.essentials = { render: render, bind: bind };
})();
