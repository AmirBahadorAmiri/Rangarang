/* رنگارنگ — ذخیرهسازی و تمام عملیات (جایگزین کامل api.php + MySQL) */
'use strict';

const STATE_KEY = 'rg-state';
const DEFAULT_STATE = { palettes: [], nextPaletteId: 1, nextColorId: 1, activeId: null };
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_PALETTES = 200;
const MAX_COLORS = 500;

function loadState() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(STATE_KEY, result => {
            const err = chrome.runtime && chrome.runtime.lastError;
            if (err) { reject(new Error(err.message)); return; }
            resolve({ ...DEFAULT_STATE, ...(result[STATE_KEY] || {}) });
        });
    });
}

function saveState(state) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STATE_KEY]: state }, () => {
            const err = chrome.runtime && chrome.runtime.lastError;
            if (err) { reject(new Error(err.message)); return; }
            resolve();
        });
    });
}

async function setActivePalette(id) {
    const s = await loadState();
    s.activeId = Number(id) || null;
    const p = s.palettes.find(p => p.id === s.activeId);
    if (p) p.lastUsed = Date.now();
    await saveState(s);
}

const fail = error => ({ ok: false, error });

function truthy(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
    return false;
}

function limit(str, max) {
    return String(str).slice(0, max);
}

/** سه قالب پذیرفتهشده: گروهی، پالت تکی، آرایهی خام پالتها */
function parseImport(raw) {
    const text = String(raw).replace(/^\uFEFF/, '').trim();
    if (!text) throw new Error('فایل JSON خالی است.');
    if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
        throw new Error('حجم فایل بیشتر از حد مجاز (۲ مگابایت) است.');
    }

    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('فایل JSON معتبر نیست.'); }

    let rows;
    if (data && !Array.isArray(data) && Array.isArray(data.palettes)) rows = data.palettes;
    else if (data && !Array.isArray(data) && (Array.isArray(data.colors) || 'name' in data)) rows = [data];
    else if (Array.isArray(data)) rows = data;
    else throw new Error('ساختار فایل شناخته نشد؛ کلید palettes یا colors لازم است.');

    if (!rows.length) throw new Error('فایل هیچ پالتی ندارد.');
    if (rows.length > MAX_PALETTES) throw new Error(`تعداد پالتها بیشتر از حد مجاز (${MAX_PALETTES}) است.`);

    const palettes = [];
    let skipped = 0;
    rows.forEach((row, i) => {
        const label = `پالت شماره ${i + 1}`;
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(label + ' معتبر نیست.');
        const name = String(row.name ?? '').trim();
        if (!name) throw new Error(label + ' نام ندارد.');
        const description = String(row.description ?? '').trim();

        const rowColors = row.colors ?? [];
        if (!Array.isArray(rowColors)) throw new Error(label + ': کلید colors باید آرایه باشد.');
        if (rowColors.length > MAX_COLORS) throw new Error(`${label}: تعداد رنگها بیشتر از حد مجاز (${MAX_COLORS}) است.`);

        const colors = [];
        rowColors.forEach(color => {
            let hex = null, colorName = null, favorite = false;
            if (typeof color === 'string') {
                hex = normalizeHex(color);
            } else if (color && typeof color === 'object') {
                hex = normalizeHex(color.hex ?? color.hex_code ?? color.color ?? '');
                const cn = String(color.name ?? '').trim();
                if (cn) colorName = limit(cn, 120);
                favorite = truthy(color.favorite ?? color.is_favorite ?? false);
            }
            if (!hex) { skipped++; return; }
            colors.push({ hex, name: colorName, favorite });
        });

        palettes.push({ name: limit(name, 120), description: description ? limit(description, 5000) : null, colors });
    });

    return { palettes, skipped };
}

/** همان قرارداد action/پاسخ src/api.php — ولی کاملاً در مرورگر */
async function api(action, extra = {}) {
    const s = await loadState();
    const findPalette = id => s.palettes.find(p => p.id === Number(id));
    const findColor = id => {
        for (const p of s.palettes) {
            const c = p.colors.find(c => c.id === Number(id));
            if (c) return { p, c };
        }
        return null;
    };
    const done = async () => { await saveState(s); return { ok: true }; };

    switch (action) {
        case 'palette_create': {
            const name = String(extra.name ?? '').trim();
            if (!name) return fail('نام پالت نمیتواند خالی باشد.');
            const description = String(extra.description ?? '').trim();
            const p = { id: s.nextPaletteId++, name, description: description || null, colors: [], lastUsed: Date.now() };
            s.palettes.push(p);
            s.activeId = p.id;
            await saveState(s);
            return { ok: true, id: p.id };
        }

        case 'palette_update': {
            const p = findPalette(extra.id);
            if (!p) return fail('پالت یافت نشد.');
            const name = String(extra.name ?? '').trim();
            if (!name) return fail('نام پالت الزامی است.');
            p.name = name;
            p.description = String(extra.description ?? '').trim() || null;
            return done();
        }

        case 'palette_delete': {
            const p = findPalette(extra.id);
            if (!p) return fail('پالت یافت نشد.');
            s.palettes = s.palettes.filter(x => x !== p);
            if (s.activeId === p.id) s.activeId = s.palettes[0]?.id ?? null;
            return done();
        }

        case 'color_add': {
            const p = findPalette(extra.palette_id);
            if (!p) return fail('پالت یافت نشد.');
            const hex = normalizeHex(extra.hex);
            if (!hex) return fail('کد رنگ نامعتبر است. مثال: #FF5733');
            const name = String(extra.name ?? '').trim();
            const c = { id: s.nextColorId++, hex, name: name || null, favorite: false };
            p.colors.push(c);
            await saveState(s);
            return { ok: true, id: c.id, hex };
        }

        case 'color_update': {
            const found = findColor(extra.id);
            if (!found) return fail('رنگ یافت نشد.');
            const hex = normalizeHex(extra.hex);
            if (!hex) return fail('کد رنگ نامعتبر است. مثال: #FF5733');
            found.c.hex = hex;
            const name = String(extra.name ?? '').trim();
            found.c.name = name || null;
            await saveState(s);
            return { ok: true, hex };
        }

        case 'color_delete': {
            const found = findColor(extra.id);
            if (!found) return fail('رنگ یافت نشد.');
            found.p.colors = found.p.colors.filter(c => c !== found.c);
            return done();
        }

        case 'color_favorite': {
            const found = findColor(extra.id);
            if (!found) return fail('رنگ یافت نشد.');
            found.c.favorite = !found.c.favorite;
            return done();
        }

        case 'color_reorder': {
            const p = findPalette(extra.palette_id);
            if (!p) return fail('پالت یافت نشد.');
            let ids;
            try { ids = JSON.parse(extra.ids ?? '[]'); } catch { return fail('داده نامعتبر است.'); }
            if (!Array.isArray(ids)) return fail('داده نامعتبر است.');
            const byId = new Map(p.colors.map(c => [String(c.id), c]));
            const ordered = ids.map(id => byId.get(String(id))).filter(Boolean);
            p.colors.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
            p.colors = ordered;
            return done();
        }

        case 'color_shade': {
            const found = findColor(extra.id);
            if (!found) return fail('رنگ یافت نشد.');
            const percent = Number(extra.percent ?? 10);
            if (!percent || Math.abs(percent) > 50) return fail('درجه تغییر باید بین ۱ تا ۵۰ باشد.');
            const hex = shadeHex(found.c.hex, percent);
            found.c.hex = hex;
            await saveState(s);
            return { ok: true, hex };
        }

        case 'palette_import': {
            let parsed;
            try { parsed = parseImport(extra.data ?? ''); }
            catch (ex) { return fail(ex.message); }
            const ids = [];
            let count = 0;
            parsed.palettes.forEach(src => {
                const p = {
                    id: s.nextPaletteId++, name: src.name, description: src.description,
                    colors: [], lastUsed: Date.now(),
                };
                src.colors.forEach(c => {
                    p.colors.push({ id: s.nextColorId++, hex: c.hex, name: c.name, favorite: c.favorite });
                    count++;
                });
                s.palettes.push(p);
                ids.push(p.id);
            });
            if (ids.length) s.activeId = ids[0];
            await saveState(s);
            return { ok: true, ids, palettes: ids.length, colors: count, skipped: parsed.skipped };
        }

        default:
            return fail('عملیات ناشناخته.');
    }
}
