/*
 * Colour logic.
 *
 * Every item carries a hex colour. Pairings are scored 0..1 from HSL geometry
 * so the app can answer "does this top go with those trousers?" without the
 * user thinking about it:
 *
 *   neutral + anything   → always works (this is what a capsule runs on)
 *   same hue             → monochrome
 *   hues within 45°      → analogous
 *   hues 150–210° apart  → complementary
 *   anything else        → only if both are muted, otherwise a clash
 */
(function () {
  const PT = (window.PT = window.PT || {});

  /* A curated, editorial-leaning starting palette. */
  const PALETTE = [
    { name: 'Black', hex: '#141414' },
    { name: 'Ivory', hex: '#f2ece1' },
    { name: 'White', hex: '#fdfdfb' },
    { name: 'Grey', hex: '#9a9a96' },
    { name: 'Charcoal', hex: '#3d3f42' },
    { name: 'Camel', hex: '#b4855c' },
    { name: 'Beige', hex: '#d8c9b2' },
    { name: 'Chocolate', hex: '#5a4433' },
    { name: 'Navy', hex: '#222f4d' },
    { name: 'Denim', hex: '#4a6c94' },
    { name: 'Sky', hex: '#a9c6dd' },
    { name: 'Burgundy', hex: '#5d2130' },
    { name: 'Brick', hex: '#9a3b2f' },
    { name: 'Red', hex: '#c0342b' },
    { name: 'Blush', hex: '#e5c3c0' },
    { name: 'Pink', hex: '#d97a97' },
    { name: 'Olive', hex: '#6b6a45' },
    { name: 'Forest', hex: '#2f4a3c' },
    { name: 'Sage', hex: '#a8b5a2' },
    { name: 'Mustard', hex: '#c9a227' },
    { name: 'Butter', hex: '#eddcab' },
    { name: 'Lilac', hex: '#b6a8cc' },
    { name: 'Purple', hex: '#5c4373' },
    { name: 'Orange', hex: '#d1762f' },
    { name: 'Silver', hex: '#c7c9cb' },
    { name: 'Gold', hex: '#b08d57' }
  ];

  function hexToRgb(hex) {
    let value = String(hex || '').trim().replace('#', '');
    if (value.length === 3) value = value.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(value)) return { r: 128, g: 128, b: 128 };
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }

  /* Blacks, whites, greys, beiges, browns and navy all behave as neutrals. */
  function isNeutral(hex) {
    const c = hexToHsl(hex);
    if (c.s < 0.16) return true;
    if (c.l < 0.18 || c.l > 0.88) return true;
    const isBrownFamily = c.h >= 18 && c.h <= 50 && c.s < 0.45;      // camel, beige, chocolate
    const isNavyFamily = c.h >= 195 && c.h <= 255 && c.l < 0.32;     // navy, deep denim
    return isBrownFamily || isNavyFamily;
  }

  function hueGap(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  /*
   * Score a pair of colours, 0..1. Anything >= 0.7 is shown as a strong match,
   * >= 0.5 as wearable, below that as a clash.
   */
  function pairScore(hexA, hexB) {
    const a = hexToHsl(hexA);
    const b = hexToHsl(hexB);
    const neutralA = isNeutral(hexA);
    const neutralB = isNeutral(hexB);

    if (neutralA && neutralB) {
      // Two neutrals: nearly always right, with a nudge for tonal contrast.
      return Math.min(1, 0.86 + Math.abs(a.l - b.l) * 0.2);
    }
    if (neutralA || neutralB) return 0.9;

    const gap = hueGap(a.h, b.h);
    const bothMuted = a.s < 0.42 && b.s < 0.42;

    if (gap <= 15) return 0.88;                       // monochrome
    if (gap <= 45) return 0.8;                        // analogous
    if (gap >= 150 && gap <= 210) return 0.74;        // complementary
    if (gap >= 100 && gap < 150) return bothMuted ? 0.62 : 0.5;
    return bothMuted ? 0.55 : 0.3;
  }

  function pairLabel(score) {
    if (score >= 0.7) return 'strong';
    if (score >= 0.5) return 'ok';
    return 'clash';
  }

  /* Average pairwise score across a set of items — the outfit's harmony. */
  function harmony(items) {
    const list = (items || []).filter(Boolean);
    if (list.length < 2) return 1;
    let total = 0;
    let pairs = 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        total += pairScore(list[i].color, list[j].color);
        pairs++;
      }
    }
    return pairs ? total / pairs : 1;
  }

  function harmonyNote(score, count) {
    if (count < 2) return 'Add a second piece to see how the colours sit together.';
    if (score >= 0.82) return 'Effortless — these colours belong together.';
    if (score >= 0.7) return 'A clean match.';
    if (score >= 0.55) return 'Wearable, with one piece doing the talking.';
    return 'These colours fight each other. Try swapping the loudest piece.';
  }

  /* Coarse bucket used by the closet colour filter. */
  function bucket(hex) {
    const c = hexToHsl(hex);
    if (c.l < 0.15) return 'Black';
    if (c.l > 0.88 && c.s < 0.2) return 'White';
    if (c.s < 0.14) return 'Grey';
    const h = c.h;
    if (h >= 18 && h <= 50 && c.s < 0.5) return c.l > 0.6 ? 'Beige' : 'Brown';
    if (h >= 195 && h <= 255 && c.l < 0.32) return 'Navy';
    if (h < 15 || h >= 345) return 'Red';
    if (h < 45) return 'Orange';
    if (h < 70) return 'Yellow';
    if (h < 165) return 'Green';
    if (h < 200) return 'Teal';
    if (h < 260) return 'Blue';
    if (h < 300) return 'Purple';
    return 'Pink';
  }

  /* Closest palette name, for display when a custom colour was picked. */
  function nameFor(hex) {
    let best = null;
    let bestDist = Infinity;
    const target = hexToRgb(hex);
    PALETTE.forEach(function (entry) {
      const rgb = hexToRgb(entry.hex);
      const dist = Math.pow(rgb.r - target.r, 2) + Math.pow(rgb.g - target.g, 2) + Math.pow(rgb.b - target.b, 2);
      if (dist < bestDist) { bestDist = dist; best = entry; }
    });
    return best ? best.name : bucket(hex);
  }

  /* 0 (identical) to 1 (opposite ends of the space). Weighted so lightness and
     saturation count as much as hue — "black vs charcoal" should read as close
     even though their hues are meaningless. */
  function distance(hexA, hexB) {
    const a = hexToHsl(hexA);
    const b = hexToHsl(hexB);
    const chroma = Math.min(a.s, b.s);
    const hue = (hueGap(a.h, b.h) / 180) * chroma;      // hue only matters if both have colour
    const sat = Math.abs(a.s - b.s);
    const light = Math.abs(a.l - b.l);
    return Math.min(1, (hue * 0.45) + (sat * 0.2) + (light * 0.6));
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      const n = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return n.length === 1 ? '0' + n : n;
    }).join('');
  }

  PT.colors = {
    PALETTE: PALETTE,
    hexToHsl: hexToHsl,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    distance: distance,
    isNeutral: isNeutral,
    pairScore: pairScore,
    pairLabel: pairLabel,
    harmony: harmony,
    harmonyNote: harmonyNote,
    bucket: bucket,
    nameFor: nameFor
  };
})();
