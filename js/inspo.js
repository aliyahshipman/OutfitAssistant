/*
 * "Looks like this" — drop in a photo you liked and get the nearest version of
 * it from your own closet.
 *
 * There is no model and no server here. What the app can actually read off a
 * picture is colour and where that colour sits in the frame: what is up by the
 * shoulders, what is around the legs, what is down at the floor. That plus a
 * library of the shapes this kind of photo keeps repeating — the off-duty
 * uniform you see on Bella Hadid between shows and outside every Paris Fashion
 * Week venue — is enough to pick real pieces off your own rails.
 *
 * The app says which half of that it is sure about, so a wrong guess about the
 * *cut* can be corrected with one tap instead of being quietly wrong.
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const util = PT.util;

  /* ---- the reference looks -------------------------------------------- */

  /*
   * Each look is a silhouette, not an outfit: which slots it fills, and the
   * words that mean "this shape" on a product page. `zone` says which part of
   * the uploaded photo a slot should take its colour from.
   */
  const LOOKS = [
    {
      id: 'denim',
      name: 'Off-duty denim',
      muse: 'Bella between shows: enormous jeans, a very small top, something thrown over the top.',
      note: 'The whole thing rests on the proportion — if the jeans are big, the top has to be small.',
      moods: ['denim', 'neutral'],
      slots: [
        { role: 'top', cats: ['tops'], zone: 'upper', key: true,
          want: /tank|cami|tee|t-?shirt|crop|bodysuit|sleeveless|baby|rib/i },
        { role: 'bottom', cats: ['jeans', 'pants'], zone: 'lower', key: true,
          want: /baggy|wide|straight|low[- ]?rise|slouch|barrel|carpenter|cargo/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper',
          want: /leather|moto|bomber|denim|varsity|jacket/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true,
          want: /sneaker|trainer|loafer|flat|ballet|boot/i },
        { role: 'bag', cats: ['bags'], want: /shoulder|baguette|hobo|crossbody|mini/i },
        { role: 'accessories', cats: ['accessories'], want: /sunglass|belt|cap/i }
      ]
    },
    {
      id: 'allblack',
      name: 'All black, all day',
      muse: 'The show-day default: one colour head to toe, so the cut is the only thing doing any talking.',
      note: 'Mix the textures — leather against knit against a flat cotton — or it flattens out.',
      moods: ['dark'],
      slots: [
        { role: 'top', cats: ['tops'], zone: 'upper', key: true, want: /tank|knit|sweater|turtle|bodysuit|long[- ]sleeve|rib/i },
        { role: 'bottom', cats: ['pants', 'jeans', 'skirts'], zone: 'lower', key: true, want: /leather|tailored|straight|wide|trouser|maxi|midi/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', want: /coat|leather|blazer|moto|bomber/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /boot|heel|pump|loafer/i },
        { role: 'bag', cats: ['bags'], want: /shoulder|tote|hobo|baguette/i },
        { role: 'accessories', cats: ['accessories'], want: /sunglass|belt|scarf/i }
      ]
    },
    {
      id: 'blazer',
      name: 'Blazer and jeans',
      muse: 'The one that works in every city: sharp shoulder, soft denim, nothing else trying.',
      note: 'Agency-appropriate without looking like you tried — keep the shoe clean.',
      moods: ['neutral', 'denim'],
      slots: [
        { role: 'top', cats: ['tops'], zone: 'upper', key: true, want: /shirt|blouse|tank|cami|tee|knit/i },
        { role: 'bottom', cats: ['jeans', 'pants'], zone: 'lower', key: true, want: /straight|wide|tailored|trouser|jean/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', key: true, want: /blazer|jacket|suit/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', want: /loafer|flat|heel|pump|boot/i },
        { role: 'bag', cats: ['bags'], want: /tote|shoulder|structured|top handle/i },
        { role: 'accessories', cats: ['accessories'], want: /sunglass|belt|jewel|earring|necklace/i }
      ]
    },
    {
      id: 'trench',
      name: 'Trench over everything',
      muse: 'Paris in early October, essentially. One good coat and whatever is under it stops mattering.',
      note: 'Belt it rather than buttoning it, and let the hem of what is underneath show.',
      moods: ['neutral', 'dark'],
      slots: [
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', key: true, want: /trench|coat|overcoat|mac/i },
        { role: 'top', cats: ['tops'], zone: 'upper', want: /knit|sweater|turtle|shirt|long[- ]sleeve/i },
        { role: 'bottom', cats: ['pants', 'jeans', 'skirts'], zone: 'lower', key: true, want: /trouser|tailored|wide|straight|midi|maxi/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /boot|loafer|heel|flat/i },
        { role: 'bag', cats: ['bags'], want: /tote|shoulder|top handle/i },
        { role: 'accessories', cats: ['accessories'], want: /scarf|sunglass|jewel/i }
      ]
    },
    {
      id: 'slip',
      name: 'Slip dress, flat shoe',
      muse: 'The evening dress worn at eleven in the morning, with a jacket and something unserious on the feet.',
      note: 'The point is the mismatch. A delicate dress and a blunt shoe.',
      moods: ['colour', 'dark', 'neutral'],
      slots: [
        { role: 'dress', cats: ['dresses'], zone: 'lower', key: true, want: /slip|midi|maxi|satin|silk|dress/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', key: true, want: /leather|moto|bomber|blazer|denim|jacket/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /sneaker|trainer|flat|ballet|loafer|boot/i },
        { role: 'bag', cats: ['bags'], want: /shoulder|mini|baguette|crossbody/i },
        { role: 'accessories', cats: ['accessories'], want: /sunglass|jewel|necklace/i }
      ]
    },
    {
      id: 'mini',
      name: 'Micro skirt, tall boot',
      muse: 'Outside the shows, every September: a short skirt, a long boot and a lot of leg in between.',
      note: 'Keep the top covered-up — the leg is already the whole idea.',
      moods: ['dark', 'colour'],
      slots: [
        { role: 'top', cats: ['tops'], zone: 'upper', key: true, want: /knit|sweater|turtle|long[- ]sleeve|bodysuit|shirt/i },
        { role: 'bottom', cats: ['skirts', 'shorts'], zone: 'lower', key: true, want: /mini|micro|short|skirt/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', want: /coat|leather|blazer|bomber/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /boot|knee|heel/i },
        { role: 'bag', cats: ['bags'], want: /shoulder|mini|baguette/i },
        { role: 'accessories', cats: ['accessories'], want: /tight|hosiery|sunglass|belt/i }
      ]
    },
    {
      id: 'tailoring',
      name: 'Show-day tailoring',
      muse: 'The one for the agency: a trouser with a crease, something quiet on top, a real shoe.',
      note: 'This is the look to build an agency day around. Nothing here needs explaining.',
      moods: ['neutral', 'dark'],
      agency: true,
      slots: [
        { role: 'top', cats: ['tops'], zone: 'upper', key: true, want: /shirt|blouse|knit|tank|cami|bodysuit|vest/i },
        { role: 'bottom', cats: ['pants', 'skirts'], zone: 'lower', key: true, want: /tailored|trouser|suit|wide|pant|midi|maxi/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', want: /blazer|coat|suit|trench/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /heel|pump|loafer|boot|flat/i },
        { role: 'bag', cats: ['bags'], want: /tote|structured|top handle|shoulder/i },
        { role: 'accessories', cats: ['accessories'], want: /jewel|earring|belt|watch/i }
      ]
    },
    {
      id: 'leather',
      name: 'Leather and a fine knit',
      muse: 'Cold-weather off-duty: a slim knit on top, something heavy and shiny below.',
      note: 'Tuck the knit. The whole shape depends on seeing the waist.',
      moods: ['dark', 'neutral'],
      slots: [
        { role: 'top', cats: ['tops'], zone: 'upper', key: true, want: /knit|sweater|turtle|rib|long[- ]sleeve|cashmere/i },
        { role: 'bottom', cats: ['pants', 'skirts'], zone: 'lower', key: true, want: /leather|faux|vegan|pant|trouser|midi/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', want: /coat|leather|moto|blazer/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /boot|heel|loafer/i },
        { role: 'bag', cats: ['bags'], want: /shoulder|hobo|baguette/i },
        { role: 'accessories', cats: ['accessories'], want: /sunglass|jewel|belt/i }
      ]
    },
    {
      id: 'sport',
      name: 'Model off-duty, literally',
      muse: 'Between castings: gym clothes worn like real clothes, with one grown-up thing added.',
      note: 'The one grown-up thing — a coat, a proper bag — is what stops it being gym clothes.',
      moods: ['neutral', 'dark'],
      slots: [
        { role: 'top', cats: ['activewear', 'tops'], zone: 'upper', key: true, want: /sports bra|tank|crop|hoodie|sweat|top/i },
        { role: 'bottom', cats: ['activewear', 'pants'], zone: 'lower', key: true, want: /legging|jogger|sweat|bike|track|flare/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', want: /coat|bomber|puffer|jacket|windbreaker/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /sneaker|trainer|running/i },
        { role: 'bag', cats: ['bags'], want: /tote|shoulder|backpack/i },
        { role: 'accessories', cats: ['accessories'], want: /cap|hat|sunglass|sock/i }
      ]
    },
    {
      id: 'colour',
      name: 'One loud piece',
      muse: 'Everything neutral except one thing, and that one thing is the entire outfit.',
      note: 'Let the loud piece take the photo. Everything else should be almost boring.',
      moods: ['colour'],
      slots: [
        { role: 'top', cats: ['tops'], zone: 'upper', key: true, want: /top|knit|shirt|tank|bodysuit|blouse/i },
        { role: 'bottom', cats: ['pants', 'jeans', 'skirts'], zone: 'lower', key: true, want: /trouser|pant|jean|skirt|straight|wide/i },
        { role: 'outerwear', cats: ['outerwear'], zone: 'upper', want: /coat|blazer|jacket/i },
        { role: 'shoes', cats: ['shoes'], zone: 'feet', key: true, want: /heel|boot|flat|loafer|sneaker/i },
        { role: 'bag', cats: ['bags'], want: /shoulder|mini|tote|baguette/i },
        { role: 'accessories', cats: ['accessories'], want: /sunglass|jewel|scarf/i }
      ]
    }
  ];

  const ROLE_LABELS = {
    top: 'Top', bottom: 'Bottom', dress: 'Dress', outerwear: 'Layer',
    shoes: 'Shoes', bag: 'Bag', accessories: 'Finish it'
  };

  const ZONE_LABELS = {
    upper: 'the top half of your photo',
    lower: 'the bottom half of your photo',
    feet: 'the shoes in your photo',
    head: 'the top of your photo'
  };

  /* ---- reading the photo ---------------------------------------------- */

  const SAMPLE_W = 96;

  /* Bands of the frame, as fractions of its height. Deliberately generous and
     overlapping at the edges — people are not always centred in a photo. */
  const ZONES = {
    head:  [0.00, 0.14],
    upper: [0.15, 0.48],
    lower: [0.46, 0.82],
    feet:  [0.82, 1.00]
  };

  function pixels(dataUrl) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onerror = function () { reject(new Error('That picture could not be read.')); };
      img.onload = function () {
        const w = SAMPLE_W;
        const h = Math.max(1, Math.round((img.height / img.width) * SAMPLE_W));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve({ data: ctx.getImageData(0, 0, w, h).data, w: w, h: h });
        } catch (err) {
          reject(new Error('That picture could not be read.'));
        }
      };
      img.src = dataUrl;
    });
  }

  /* Skin, roughly: warm, mid-lightness, and red above green above blue.
     Worth excluding — on a full-length photo it is often the largest single
     colour in the frame and it is not something you can wear. */
  function isSkin(r, g, b, hsl) {
    if (!(r > g && g > b)) return false;
    if (r - b < 14) return false;
    const h = hsl.h;
    return (h >= 0 && h <= 52) && hsl.s >= 0.10 && hsl.s <= 0.72 && hsl.l >= 0.18 && hsl.l <= 0.92;
  }

  function binKey(hsl) {
    const sb = hsl.s < 0.12 ? 0 : hsl.s < 0.35 ? 1 : hsl.s < 0.62 ? 2 : 3;
    // Below that saturation the hue is noise, so everything grey shares a bin.
    const hb = sb === 0 ? 0 : Math.floor(hsl.h / 30);
    const lb = Math.min(5, Math.floor(hsl.l * 6));
    return hb + ':' + sb + ':' + lb;
  }

  function topColors(bins, limit) {
    return Object.keys(bins)
      .map(function (key) { return bins[key]; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, limit || 3)
      .map(function (bin) {
        return {
          hex: PT.colors.rgbToHex(bin.r / bin.n, bin.g / bin.n, bin.b / bin.n),
          weight: bin.n
        };
      });
  }

  function analyse(dataUrl) {
    return pixels(dataUrl).then(function (img) {
      const data = img.data;
      const w = img.w;
      const h = img.h;

      /* The corners are almost always backdrop. If they agree with each other,
         take that as the background and leave it out of the palette. */
      const corners = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].map(function (pt) {
        const i = ((pt[1] * w) + pt[0]) * 4;
        return PT.colors.rgbToHex(data[i], data[i + 1], data[i + 2]);
      });
      let background = null;
      let agree = true;
      for (let a = 0; a < corners.length && agree; a++) {
        for (let b = a + 1; b < corners.length; b++) {
          if (PT.colors.distance(corners[a], corners[b]) > 0.2) { agree = false; break; }
        }
      }
      if (agree) background = corners[0];

      const zoneBins = { head: {}, upper: {}, lower: {}, feet: {} };
      const allBins = {};
      let lightSum = 0;
      let satSum = 0;
      let counted = 0;
      let denim = 0;
      let skinPixels = 0;

      for (let y = 0; y < h; y++) {
        const frac = y / h;
        let zone = null;
        Object.keys(ZONES).forEach(function (name) {
          if (frac >= ZONES[name][0] && frac < ZONES[name][1]) zone = zone || name;
        });
        for (let x = 0; x < w; x++) {
          const i = ((y * w) + x) * 4;
          if (data[i + 3] < 128) continue;
          const hex = PT.colors.rgbToHex(data[i], data[i + 1], data[i + 2]);
          const hsl = PT.colors.hexToHsl(hex);
          if (isSkin(data[i], data[i + 1], data[i + 2], hsl)) { skinPixels++; continue; }
          if (background && PT.colors.distance(hex, background) < 0.09) continue;

          const key = binKey(hsl);
          [allBins, zone ? zoneBins[zone] : null].forEach(function (bag) {
            if (!bag) return;
            const bin = bag[key] || (bag[key] = { n: 0, r: 0, g: 0, b: 0 });
            bin.n++;
            bin.r += data[i];
            bin.g += data[i + 1];
            bin.b += data[i + 2];
          });

          lightSum += hsl.l;
          satSum += hsl.s;
          counted++;
          if (hsl.h >= 195 && hsl.h <= 252 && hsl.s > 0.12 && hsl.l > 0.18 && hsl.l < 0.66) denim++;
        }
      }

      const palette = topColors(allBins, 5);
      const zones = {};
      Object.keys(zoneBins).forEach(function (name) {
        zones[name] = topColors(zoneBins[name], 2);
      });

      const light = counted ? lightSum / counted : 0.5;
      const sat = counted ? satSum / counted : 0.2;
      const denimShare = counted ? denim / counted : 0;
      const spread = palette.length > 1 ? PT.colors.distance(palette[0].hex, palette[1].hex) : 0;

      let mood;
      if (denimShare > 0.16) mood = 'denim';
      else if (light < 0.3) mood = 'dark';
      else if (sat > 0.34 && spread > 0.2) mood = 'colour';
      else mood = 'neutral';

      return {
        photo: dataUrl,
        palette: palette,
        zones: zones,
        mood: mood,
        light: light,
        sat: sat,
        denim: denimShare,
        usable: counted > (w * h * 0.08),
        skinHeavy: skinPixels > counted
      };
    });
  }

  /* ---- matching the closet -------------------------------------------- */

  function moodLabel(a) {
    if (a.mood === 'denim') return 'Denim-led';
    if (a.mood === 'dark') return 'Dark and tonal';
    if (a.mood === 'colour') return 'One colour doing the work';
    return 'Neutrals';
  }

  function rankLooks(analysis) {
    return LOOKS.map(function (look) {
      let score = look.moods.indexOf(analysis.mood) === 0 ? 1
        : look.moods.indexOf(analysis.mood) > 0 ? 0.82 : 0.45;
      // A look whose key colours are already in the photo edges ahead.
      return { look: look, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function targetFor(slot, analysis) {
    const zone = slot.zone && analysis.zones[slot.zone];
    if (zone && zone.length) return zone[0].hex;
    return analysis.palette.length ? analysis.palette[0].hex : null;
  }

  function candidates(slot, analysis, chosen, pool) {
    const target = targetFor(slot, analysis);
    return pool
      .filter(function (item) { return slot.cats.indexOf(item.category) > -1; })
      .map(function (item) {
        const text = item.name + ' ' + (item.subtype || '') + ' ' + (item.brand || '');
        const shape = slot.want && slot.want.test(text) ? 1 : 0.42;
        const colour = target ? 1 - PT.colors.distance(item.color, target) : 0.6;
        let fit = 1;
        if (chosen.length) {
          let sum = 0;
          chosen.forEach(function (other) { sum += PT.colors.pairScore(item.color, other.color); });
          fit = sum / chosen.length;
        }
        let score = (colour * 0.45) + (shape * 0.28) + (fit * 0.17) + 0.10;
        if (item.status === 'ontheway') score *= 0.94;
        if (!(item.photo || item.photoUrl)) score *= 0.93;
        return { item: item, score: score, colour: colour, shape: shape > 0.5 };
      })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function whyLine(pick, slot) {
    const parts = [];
    if (pick.colour > 0.86) parts.push('almost exactly the colour in ' + ZONE_LABELS[slot.zone || 'upper']);
    else if (pick.colour > 0.7) parts.push('close to ' + ZONE_LABELS[slot.zone || 'upper']);
    else parts.push('a different colour, but it works with the rest');
    if (pick.shape) parts.push('and the right shape for this look');
    return parts.join(', ');
  }

  /*
   * Build the look. `offset` walks down the ranked list for every slot at
   * once, which is what the "Try another" button does.
   */
  function build(analysis, lookId, offset, onlyTrip) {
    const store = PT.store;
    const look = LOOKS.filter(function (l) { return l.id === lookId; })[0] || LOOKS[0];
    const pool = (onlyTrip ? store.tripItems() : store.get().items)
      .filter(function (i) { return !i.archived; });

    const chosen = [];
    const used = {};
    const picks = [];
    const missing = [];

    look.slots.forEach(function (slot) {
      const ranked = candidates(slot, analysis, chosen, pool)
        .filter(function (c) { return !used[c.item.id]; });
      if (!ranked.length) {
        if (slot.key) missing.push(slot);
        return;
      }
      const pick = ranked[Math.min(ranked.length - 1, offset || 0)];
      used[pick.item.id] = true;
      chosen.push(pick.item);
      picks.push({ slot: slot, item: pick.item, score: pick.score, why: whyLine(pick, slot) });
    });

    return { look: look, picks: picks, missing: missing, harmony: PT.colors.harmony(chosen) };
  }

  /* ---- state ----------------------------------------------------------- */

  /* The photo and its reading live in localStorage so the board survives a
     refresh; it is one downscaled JPEG, about the size of a single closet
     photo. Everything else is recomputed on the fly. */
  function saved() { return PT.store.ui().inspo || null; }

  function remember(patch) {
    PT.store.setUI({ inspo: Object.assign({}, saved(), patch) });
  }

  function forget() { PT.store.setUI({ inspo: null }); }

  /* ---- rendering -------------------------------------------------------- */

  function swatchRow(colors) {
    if (!colors || !colors.length) return '<span class="inspo__none">nothing readable</span>';
    return colors.map(function (c) {
      return '<span class="inspo__swatch" style="background:' + util.esc(c.hex) + '" title="' +
        util.esc(PT.colors.nameFor(c.hex)) + '"></span>';
    }).join('');
  }

  function emptyHTML() {
    return '' +
      '<div class="inspo-drop" data-drop>' +
        '<h3>Drop a photo in</h3>' +
        '<p>A street-style shot, a screenshot, anything you saved because you wanted to dress like it. ' +
        'The app reads its colours and where they sit in the frame, then builds the closest version ' +
        'of it out of what you actually own.</p>' +
        '<div class="row" style="justify-content:center">' +
          '<label class="btn" for="inspo-file">Choose a photo</label>' +
          '<input id="inspo-file" class="visually-hidden" type="file" accept="image/*" data-inspo-file>' +
        '</div>' +
        '<p class="inspo__fineprint">The photo never leaves this browser. It is not sent anywhere and ' +
        'nothing about it is looked up online.</p>' +
      '</div>' +
      '<div class="category-block__head category-block__head--shelf" style="margin-top:34px">' +
        '<h3>The looks it knows</h3>' +
        '<span class="category-block__rule"></span>' +
        '<span class="category-block__count">' + LOOKS.length + ' shapes</span>' +
      '</div>' +
      '<div class="inspo-looks">' +
        LOOKS.map(function (look) {
          return '<article class="inspo-look">' +
            '<h4>' + util.esc(look.name) + '</h4>' +
            '<p>' + util.esc(look.muse) + '</p>' +
            '<button class="btn btn--ghost btn--sm" data-look-blind="' + util.esc(look.id) + '" type="button">' +
              'Build this without a photo</button>' +
          '</article>';
        }).join('') +
      '</div>';
  }

  function pickHTML(pick) {
    const item = pick.item;
    return '' +
      '<article class="card inspo-pick" data-item="' + util.esc(item.id) + '">' +
        '<div class="inspo-pick__role">' + util.esc(ROLE_LABELS[pick.slot.role] || pick.slot.role) + '</div>' +
        '<div class="card__frame">' + util.thumb(item) + '</div>' +
        '<div class="card__body">' +
          '<div class="card__name">' + util.esc(item.name) + '</div>' +
          '<div class="card__meta">' +
            '<span class="swatch" style="background:' + util.esc(item.color) + '"></span>' +
            '<span>' + util.esc(item.colorName || PT.colors.nameFor(item.color)) + '</span>' +
            (item.brand ? '<span class="dot">·</span><span>' + util.esc(item.brand) + '</span>' : '') +
          '</div>' +
          '<div class="inspo-pick__why">' + util.esc(pick.why) + '</div>' +
          '<button class="btn btn--quiet btn--sm" data-swap="' + util.esc(pick.slot.role) + '" type="button">Swap</button>' +
        '</div>' +
      '</article>';
  }

  function boardHTML(state) {
    const analysis = state.analysis;
    const result = build(analysis, state.lookId, state.offset, state.onlyTrip);
    const store = PT.store;
    const trip = store.trip();

    const chips = rankLooks(analysis).map(function (entry) {
      const on = entry.look.id === result.look.id;
      return '<button class="chip" data-look="' + util.esc(entry.look.id) + '" aria-pressed="' + on +
        '" type="button">' + util.esc(entry.look.name) + '</button>';
    }).join('');

    const readout = '' +
      '<div class="inspo-read">' +
        '<div class="inspo-read__row"><span>Overall</span>' + swatchRow(analysis.palette) +
          '<em>' + util.esc(moodLabel(analysis)) + '</em></div>' +
        '<div class="inspo-read__row"><span>Up top</span>' + swatchRow(analysis.zones.upper) + '</div>' +
        '<div class="inspo-read__row"><span>Below</span>' + swatchRow(analysis.zones.lower) + '</div>' +
        '<div class="inspo-read__row"><span>On the feet</span>' + swatchRow(analysis.zones.feet) + '</div>' +
      '</div>';

    const missing = result.missing.length
      ? '<div class="note note--warn">Nothing in your closet fills the ' +
          util.esc(result.missing.map(function (s) { return (ROLE_LABELS[s.role] || s.role).toLowerCase(); }).join(' or ')) +
          ' slot for this one. Either pick a different shape above, or that is your shopping list.</div>'
      : '';

    return '' +
      '<div class="inspo-grid">' +
        '<div class="inspo-source">' +
          '<img src="' + util.esc(analysis.photo) + '" alt="The photo you uploaded">' +
          readout +
          '<div class="row">' +
            '<label class="btn btn--ghost btn--sm" for="inspo-file">Different photo</label>' +
            '<input id="inspo-file" class="visually-hidden" type="file" accept="image/*" data-inspo-file>' +
            '<button class="btn btn--quiet btn--sm" data-clear-inspo type="button">Clear</button>' +
          '</div>' +
        '</div>' +

        '<div class="inspo-result">' +
          '<h3 class="inspo-result__name">' + util.esc(result.look.name) + '</h3>' +
          '<p class="lede">' + util.esc(result.look.muse) + '</p>' +
          '<div class="filters"><div class="filters__group">' + chips + '</div></div>' +
          '<div class="filters"><div class="filters__group">' +
            '<button class="chip" data-only-trip aria-pressed="' + Boolean(state.onlyTrip) +
              '" type="button">Only what is coming to ' + util.esc(trip.name.split(' · ')[0]) + '</button>' +
            '<button class="chip" data-shuffle type="button">Try another</button>' +
          '</div></div>' +
          missing +
          '<div class="inspo-picks">' + result.picks.map(pickHTML).join('') + '</div>' +
          '<div class="harmony">' +
            '<div class="harmony__bar"><span style="width:' + Math.round(result.harmony * 100) + '%"></span></div>' +
            '<p class="harmony__note">' + util.esc(PT.colors.harmonyNote(result.harmony, result.picks.length)) + '</p>' +
          '</div>' +
          '<p class="inspo__fineprint">' + util.esc(result.look.note) + '</p>' +
          '<div class="row">' +
            '<button class="btn" data-save-look type="button">Save as a look in ' + util.esc(trip.name) + '</button>' +
            '<button class="btn btn--ghost" data-add-trip type="button">Add these to the trip</button>' +
          '</div>' +
          '<p class="inspo__fineprint">Read from the picture: colour, and which part of the frame it ' +
          'sits in. Not read: the cut, the fabric or the brand — that is what the shapes above are for.</p>' +
        '</div>' +
      '</div>';
  }

  let view = { lookId: null, offset: 0, onlyTrip: false, analysis: null, busy: false };

  function render(root) {
    const store = PT.store;
    const head = '' +
      '<div class="section-head">' +
        '<h2>Looks like this</h2>' +
        '<div class="section-head__aside">' +
          '<span class="category-block__count">' +
            util.pluralize(store.get().items.filter(function (i) { return !i.archived; }).length, 'piece') +
            ' to draw on</span>' +
        '</div>' +
      '</div>';

    if (view.busy) {
      root.innerHTML = head + '<div class="empty-state"><h3>Reading the photo…</h3></div>';
      return;
    }

    const stored = saved();
    if (stored && stored.analysis && !view.analysis) {
      view.analysis = stored.analysis;
      view.lookId = view.lookId || stored.lookId;
    }

    if (!view.analysis) {
      root.innerHTML = head + emptyHTML();
      return;
    }
    if (!view.lookId) view.lookId = rankLooks(view.analysis)[0].look.id;
    root.innerHTML = head + boardHTML(view);
  }

  /* ---- actions ---------------------------------------------------------- */

  function loadFile(file) {
    if (!file) return;
    view.busy = true;
    PT.app.rerender();
    util.readImageFile(file, 560, 0.7)
      .then(analyse)
      .then(function (analysis) {
        if (!analysis.usable) {
          util.toast('That photo is mostly background — try one where the outfit fills more of the frame.');
        }
        view.analysis = analysis;
        view.lookId = rankLooks(analysis)[0].look.id;
        view.offset = 0;
        view.busy = false;
        remember({ analysis: analysis, lookId: view.lookId });
        PT.app.rerender();
      })
      .catch(function (err) {
        view.busy = false;
        util.toast(err.message || 'That photo could not be read.');
        PT.app.rerender();
      });
  }

  /* A look built with no photo at all: use the closet's own dominant colours
     as the target, so it still comes back coherent rather than random. */
  function blindAnalysis() {
    const items = PT.store.get().items.filter(function (i) { return !i.archived; });
    const bins = {};
    items.forEach(function (item) {
      const key = binKey(PT.colors.hexToHsl(item.color));
      const rgb = PT.colors.hexToRgb(item.color);
      const bin = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
      bin.n++; bin.r += rgb.r; bin.g += rgb.g; bin.b += rgb.b;
    });
    const palette = topColors(bins, 4);
    return {
      photo: '', palette: palette,
      zones: { head: [], upper: palette.slice(0, 1), lower: palette.slice(1, 2), feet: [] },
      mood: 'neutral', light: 0.5, sat: 0.2, denim: 0, usable: true, skinHeavy: false
    };
  }

  function currentResult() {
    return build(view.analysis, view.lookId, view.offset, view.onlyTrip);
  }

  function toOutfitSlots(result) {
    const slots = { top: null, bottom: null, dress: null, outerwear: null, shoes: null, bag: null, accessories: [] };
    result.picks.forEach(function (pick) {
      if (pick.slot.role === 'accessories') slots.accessories.push(pick.item.id);
      else slots[pick.slot.role] = pick.item.id;
    });
    return slots;
  }

  function addToTrip(result) {
    const store = PT.store;
    const ids = store.trip().itemIds.slice();
    result.picks.forEach(function (pick) {
      if (ids.indexOf(pick.item.id) === -1) ids.push(pick.item.id);
    });
    store.setTripItems(ids);
    return ids;
  }

  function saveLook(result) {
    addToTrip(result);
    const name = result.look.name;
    PT.store.saveOutfit({ name: name, tag: result.look.agency ? 'agency' : '', slots: toOutfitSlots(result) });
    util.toast('Saved "' + name + '" to ' + PT.store.trip().name + '.');
  }

  function bind(root) {
    root.addEventListener('change', function (event) {
      const file = event.target.closest('[data-inspo-file]');
      if (file) loadFile(file.files && file.files[0]);
    });

    root.addEventListener('click', function (event) {
      const look = event.target.closest('[data-look]');
      if (look) { view.lookId = look.dataset.look; view.offset = 0; remember({ lookId: view.lookId }); PT.app.rerender(); return; }

      const blind = event.target.closest('[data-look-blind]');
      if (blind) {
        view.analysis = blindAnalysis();
        view.lookId = blind.dataset.lookBlind;
        view.offset = 0;
        util.toast('Built from your closet’s own colours. Add a photo to aim it.');
        PT.app.rerender();
        return;
      }

      if (event.target.closest('[data-shuffle]')) { view.offset += 1; PT.app.rerender(); return; }
      if (event.target.closest('[data-only-trip]')) { view.onlyTrip = !view.onlyTrip; PT.app.rerender(); return; }
      if (event.target.closest('[data-clear-inspo]')) {
        view.analysis = null; view.lookId = null; view.offset = 0;
        forget();
        PT.app.rerender();
        return;
      }
      if (event.target.closest('[data-save-look]')) { saveLook(currentResult()); return; }
      if (event.target.closest('[data-add-trip]')) {
        const ids = addToTrip(currentResult());
        util.toast(ids.length + ' pieces now coming on the trip.');
        return;
      }
      const swap = event.target.closest('[data-swap]');
      if (swap) { view.offset += 1; util.toast('Swapped the whole look — tap again to keep going.'); PT.app.rerender(); }
    });

    /* Drag a picture straight onto the page, or paste one. */
    root.addEventListener('dragover', function (event) { event.preventDefault(); });
    root.addEventListener('drop', function (event) {
      event.preventDefault();
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) loadFile(file);
    });
    window.addEventListener('paste', function (event) {
      if (!root || root.hidden) return;
      const items = (event.clipboardData && event.clipboardData.items) || [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image/') === 0) { loadFile(items[i].getAsFile()); return; }
      }
    });
  }

  PT.inspo = { render: render, bind: bind, LOOKS: LOOKS, analyse: analyse };
})();
