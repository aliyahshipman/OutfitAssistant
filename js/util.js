/* Small DOM / data helpers shared by every view. */
(function () {
  const PT = (window.PT = window.PT || {});

  const util = {
    uid(prefix) {
      return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    },

    esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    qs(sel, root) { return (root || document).querySelector(sel); },
    qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    /* Event delegation: util.on(root, 'click', '[data-x]', handler) */
    on(root, type, selector, handler) {
      root.addEventListener(type, function (event) {
        const match = event.target.closest(selector);
        if (match && root.contains(match)) handler(event, match);
      });
    },

    /* ---- dates ---------------------------------------------------- */

    /* Parses 'YYYY-MM-DD' as a local date (avoids the UTC shift of new Date(str)). */
    parseISO(iso) {
      const parts = String(iso).split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    },

    toISO(date) {
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return date.getFullYear() + '-' + m + '-' + d;
    },

    /* Inclusive list of ISO dates between two ISO dates. */
    datesBetween(startISO, endISO) {
      const out = [];
      const start = util.parseISO(startISO);
      const end = util.parseISO(endISO);
      if (isNaN(start) || isNaN(end) || end < start) return out;
      const cursor = new Date(start);
      let guard = 0;
      while (cursor <= end && guard++ < 400) {
        out.push(util.toISO(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    },

    formatDate(iso, opts) {
      const date = util.parseISO(iso);
      if (isNaN(date)) return iso;
      return date.toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'long' });
    },

    weekday(iso, style) {
      const date = util.parseISO(iso);
      if (isNaN(date)) return '';
      return date.toLocaleDateString('en-GB', { weekday: style || 'short' });
    },

    daysUntil(iso) {
      const target = util.parseISO(iso);
      if (isNaN(target)) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.round((target - today) / 86400000);
    },

    /* ---- photos ---------------------------------------------------- */

    /*
     * Reads a File from the camera roll and returns a downscaled JPEG data URL.
     * localStorage tops out around 5 MB, so full-resolution phone photos are
     * never stored — they are resized to fit MAX_EDGE first.
     */
    readImageFile(file, maxEdge, quality) {
      const MAX_EDGE = maxEdge || 620;
      const QUALITY = quality || 0.72;
      return new Promise(function (resolve, reject) {
        if (!file || !/^image\//.test(file.type)) {
          reject(new Error('That file is not an image.'));
          return;
        }
        const reader = new FileReader();
        reader.onerror = function () { reject(new Error('Could not read that photo.')); };
        reader.onload = function () {
          const img = new Image();
          img.onerror = function () { reject(new Error('Could not decode that photo.')); };
          img.onload = function () {
            const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            try {
              resolve(canvas.toDataURL('image/jpeg', QUALITY));
            } catch (err) {
              reject(new Error('Could not process that photo.'));
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    /*
     * The picture for an item, in priority order:
     *   1. a photo the user added (a data URL — always available offline)
     *   2. the product image from the order it was imported from (needs network)
     *   3. a colour block, so a photo-less closet still reads visually
     *
     * A remote image that fails to load swaps itself for the colour block, so a
     * dead product URL or an offline session never leaves an empty frame.
     */
    thumb(item, className) {
      const cls = className ? ' class="' + className + '"' : '';
      const src = item && (item.photo || item.photoUrl);
      if (src) {
        return '<img' + cls + ' src="' + util.esc(src) + '" alt="' + util.esc(item.name) +
          '" loading="lazy" data-fallback-for="' + util.esc(item.id || '') +
          '" onerror="window.PT.util.imageFailed(this)">';
      }
      return util.colorBlock(item, className);
    },

    /* A flat block of the item's own colour, captioned with its initial. */
    colorBlock(item, className) {
      const color = (item && item.color) || '#d8d3ca';
      const letter = item && item.name ? item.name.trim().charAt(0).toUpperCase() : '·';
      const ink = util.isLight(color) ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.72)';
      return '<div class="ph' + (className ? ' ' + className : '') + '" aria-hidden="true" ' +
        'style="background:' + util.esc(color) + ';color:' + ink + ';display:flex;' +
        'align-items:center;justify-content:center;font-family:var(--serif);font-size:1.6em;' +
        'width:100%;height:100%">' + util.esc(letter) + '</div>';
    },

    /* Swap a broken remote image for the colour block. */
    imageFailed(img) {
      const id = img.getAttribute('data-fallback-for');
      const item = id && window.PT.store ? window.PT.store.itemById(id) : null;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = util.colorBlock(item || { name: img.alt }, img.className);
      const replacement = wrapper.firstChild;
      if (img.parentNode) img.parentNode.replaceChild(replacement, img);
    },

    isLight(hex) {
      let value = String(hex || '').replace('#', '');
      if (value.length === 3) value = value.split('').map(function (c) { return c + c; }).join('');
      if (!/^[0-9a-f]{6}$/i.test(value)) return true;
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      // Perceived luminance.
      return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
    },

    /*
     * Download a remote image and turn it into a data URL, so an imported piece
     * keeps its picture offline. Fails quietly when the host forbids CORS.
     */
    cacheImage(url) {
      return fetch(url, { mode: 'cors' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.blob();
        })
        .then(function (blob) {
          return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('Could not read the image.')); };
            reader.readAsDataURL(blob);
          });
        })
        .then(function (dataUrl) {
          // Re-encode through the resizer so cached photos stay small.
          return new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () {
              const scale = Math.min(1, 620 / Math.max(img.width, img.height));
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(img.width * scale));
              canvas.height = Math.max(1, Math.round(img.height * scale));
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              try { resolve(canvas.toDataURL('image/jpeg', 0.72)); }
              catch (err) { reject(err); }
            };
            img.onerror = function () { reject(new Error('Could not decode the image.')); };
            img.src = dataUrl;
          });
        });
    },

    /* ---- misc ------------------------------------------------------ */

    pluralize(n, one, many) {
      return n + ' ' + (n === 1 ? one : (many || one + 's'));
    },

    download(filename, content, mime) {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    },

    toast(message) {
      const root = document.getElementById('toast-root');
      if (!root) return;
      const node = document.createElement('div');
      node.className = 'toast';
      node.textContent = message;
      root.appendChild(node);
      setTimeout(function () {
        node.style.transition = 'opacity .3s ease';
        node.style.opacity = '0';
        setTimeout(function () { node.remove(); }, 320);
      }, 2600);
    },

    /* ---- modal ------------------------------------------------------ */

    modal(title, html, onMount) {
      const root = document.getElementById('modal-root');
      const previous = document.getElementById('modal-body');
      /*
       * Swap in a fresh node rather than reusing the old one. Modals attach
       * delegated listeners to this element, and a listener left over from a
       * previous modal would still fire on the next one — closing it early and
       * applying the click to whatever the old modal was editing.
       */
      const body = previous.cloneNode(false);
      previous.parentNode.replaceChild(body, previous);
      document.getElementById('modal-title').textContent = title;
      body.innerHTML = html;
      root.hidden = false;
      document.body.style.overflow = 'hidden';
      if (typeof onMount === 'function') onMount(body);
      const focusable = body.querySelector('input, select, textarea, button');
      if (focusable) focusable.focus();
      return body;
    },

    closeModal() {
      const root = document.getElementById('modal-root');
      if (!root || root.hidden) return;
      root.hidden = true;
      document.getElementById('modal-body').innerHTML = '';
      document.body.style.overflow = '';
    },

    confirm(message, onYes, confirmLabel) {
      util.modal('Are you sure?',
        '<p class="lede">' + util.esc(message) + '</p>' +
        '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-confirm-no type="button">Cancel</button>' +
        '<button class="btn btn--danger" data-confirm-yes type="button">' + util.esc(confirmLabel || 'Delete') + '</button>' +
        '</div>',
        function (body) {
          body.querySelector('[data-confirm-no]').addEventListener('click', util.closeModal);
          body.querySelector('[data-confirm-yes]').addEventListener('click', function () {
            util.closeModal();
            onYes();
          });
        });
    }
  };

  PT.util = util;

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-close-modal]')) util.closeModal();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') util.closeModal();
  });
})();
