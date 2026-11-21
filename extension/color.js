/* رنگارنگ — ابزارهای رنگ (همارز src/color_tools.php) */
'use strict';

function normalizeHex(value) {
    let m = String(value ?? '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(m)) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    return /^[0-9a-f]{6}$/i.test(m) ? '#' + m.toUpperCase() : null;
}

function hexToRgb(hex) {
    const n = hex.replace('#', '');
    return {
        r: parseInt(n.slice(0, 2), 16),
        g: parseInt(n.slice(2, 4), 16),
        b: parseInt(n.slice(4, 6), 16),
    };
}

function rgbToHex(r, g, b) {
    const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').toUpperCase();
    return '#' + c(r) + c(g) + c(b);
}

function rgbToHsl(r, g, b) {
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    const d = max - min;
    let h = 0;
    if (d > 0) {
        if (max === rf) h = ((gf - bf) / d) % 6;
        else if (max === gf) h = (bf - rf) / d + 2;
        else h = (rf - gf) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = d > 0 ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
    const sf = s / 100, lf = l / 100;
    const c = (1 - Math.abs(2 * lf - 1)) * sf;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lf - c / 2;
    let r, g, b;
    if (h < 60)       [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else              [r, g, b] = [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

/** روشنتر/تیرهتر کردن بر پایه HSL — درصد روی Lightness */
function shadeHex(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const out = hslToRgb(hsl.h, hsl.s, Math.max(0, Math.min(100, hsl.l + percent)));
    return rgbToHex(out.r, out.g, out.b);
}

function readableText(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#111111' : '#FFFFFF';
}

function familyName(hsl) {
    if (hsl.s <= 8) {
        if (hsl.l <= 12) return 'مشکی';
        if (hsl.l >= 92) return 'سفید';
        return 'خاکستری';
    }
    const h = hsl.h;
    if (h < 15 || h >= 345) return 'قرمز';
    if (h < 45)  return 'نارنجی';
    if (h < 70)  return 'زرد';
    if (h < 95)  return 'لیمویی';
    if (h < 150) return 'سبز';
    if (h < 190) return 'فیروزهای';
    if (h < 250) return 'آبی';
    if (h < 290) return 'بنفش';
    return 'صورتی';
}
