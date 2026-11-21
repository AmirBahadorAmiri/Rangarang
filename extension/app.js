/* ============================================================
   رنگارنگ — منطق رابط کاربری
   Context menu، مودال، Drag&Drop، جستجو، Toast
   ============================================================ */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let CM = { paletteId: null };

/* ---------- پیامها ---------- */
function toast(message, type = 'ok') {
    const stack = $('#toast-stack');
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            toast('کپی شد: ' + text);
            return;
        } catch { /* مسیر پشتیبان */ }
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        if (!document.execCommand('copy')) throw new Error('copy rejected');
        ta.remove();
        toast('کپی شد: ' + text);
    } catch {
        toast('مرورگر اجازه کپی نداد', 'error');
    }
}

/* ---------- تم ---------- */
const themeToggle = $('#btn-theme-toggle');
const THEME_KEY = 'rg-theme';

function currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
function syncThemeUI(theme) {
    if (themeToggle) {
        const label = 'تغییر به تم ' + (theme === 'dark' ? 'روشن' : 'تیره');
        themeToggle.title = label;
        themeToggle.setAttribute('aria-label', label);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f4f5fb' : '#0d0f17';
}
function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* حالت ناشناس */ }
    syncThemeUI(theme);
}
syncThemeUI(currentTheme());
themeToggle?.addEventListener('click', () => setTheme(currentTheme() === 'light' ? 'dark' : 'light'));
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', ev => {
    if (storedTheme()) return;
    document.documentElement.dataset.theme = ev.matches ? 'light' : 'dark';
    syncThemeUI(currentTheme());
});

/* ---------- رندر ---------- */
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));
}

function swatchHtml(c) {
    const rgb = hexToRgb(c.hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `<div class="swatch" draggable="true" data-id="${c.id}" data-hex="${esc(c.hex)}" data-name="${esc(c.name || '')}" style="--sw-bg:${esc(c.hex)};--sw-text:${readableText(c.hex)}">
        <div class="sw-top">${c.favorite ? '<span class="sw-fav">★</span>' : ''}<span class="sw-drag">⠿</span></div>
        <div class="sw-body">
            <div class="sw-hex">${esc(c.hex)}</div>
            ${c.name ? `<div class="sw-name">${esc(c.name)}</div>` : ''}
            <div class="sw-meta">
                <span>RGB ${rgb.r} ${rgb.g} ${rgb.b}</span>
                <span>HSL ${hsl.h}° ${hsl.s}% ${hsl.l}%</span>
                <span class="sw-family">${familyName(hsl)}</span>
            </div>
        </div>
    </div>`;
}

function renderSidebar(s) {
    $('#palette-count').textContent = s.palettes.length;
    const list = $('#palette-list');
    const sorted = [...s.palettes].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    if (!sorted.length) {
        list.innerHTML = '<div class="empty-hint">هنوز پالتی نساختهاین.<br>از دکمه «پالت جدید» شروع کن.</div>';
        return;
    }
    list.innerHTML = sorted.map(p => `
        <a class="palette-item ${p.id === s.activeId ? 'active' : ''}" href="#"
           data-id="${p.id}" data-name="${esc(p.name)}" data-desc="${esc(p.description || '')}">
            <span class="pi-name">${esc(p.name)}</span>
            <span class="pi-count">${p.colors.length} رنگ</span>
        </a>`).join('');
}

const EXPORT_LABELS = [['css', 'CSS Variables'], ['scss', 'SCSS'], ['json', 'JSON'], ['tailwind', 'Tailwind'], ['txt', 'TXT']];

function renderWorkspace(s) {
    const ws = $('#workspace');
    const p = s.palettes.find(x => x.id === s.activeId);
    if (!p) {
        ws.innerHTML = `
        <div class="welcome">
            <div class="welcome-orb orb-1"></div><div class="welcome-orb orb-2"></div><div class="welcome-orb orb-3"></div>
            <h2>به رنگارنگ خوش آمدی 🎨</h2>
            <p>برای شروع، یک پالت رنگ بساز و کد رنگهایت را سازمان بده.</p>
            <button class="btn btn-primary btn-lg" id="btn-welcome-create" type="button">ساخت اولین پالت</button>
        </div>`;
        return;
    }

    ws.innerHTML = `
    <div class="ws-head">
        <div class="ws-title" data-ctx="palette" data-ctx-id="${p.id}" data-ctx-name="${esc(p.name)}" data-ctx-desc="${esc(p.description || '')}">
            <h2>${esc(p.name)}</h2>
            ${p.description ? `<p class="ws-desc">${esc(p.description)}</p>` : ''}
        </div>
        <div class="ws-tools">
            <button class="tool-btn" id="btn-add-color" type="button" title="افزودن رنگ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <div class="export-wrap">
                <button class="tool-btn" id="btn-export" type="button" title="خروجی گرفتن">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
                </button>
                <div class="dropdown" id="export-menu" hidden>
                    ${EXPORT_LABELS.map(([f, label]) => `<button type="button" data-format="${f}">${label}</button>`).join('')}
                </div>
            </div>
        </div>
    </div>
    <div class="swatch-grid" id="swatch-grid" data-palette="${p.id}">
        ${p.colors.length ? p.colors.map(swatchHtml).join('') : `
        <div class="grid-empty">
            <p>این پالت هنوز رنگی ندارد</p>
            <button class="btn btn-primary" id="btn-first-color" type="button">اولین رنگ را اضافه کن</button>
        </div>`}
    </div>`;
}

async function refresh() {
    let s = await loadState();
    if (s.activeId && !s.palettes.some(p => p.id === s.activeId)) {
        s.activeId = s.palettes[0]?.id ?? null;
        await saveState(s);
    }
    CM.paletteId = s.activeId;
    renderSidebar(s);
    renderWorkspace(s);
}

async function gotoPalette(id) {
    await setActivePalette(id);
    await refresh();
}

/* ---------- خروجی فایلها ---------- */
async function downloadPalette(format) {
    const s = await loadState();
    const p = s.palettes.find(x => x.id === s.activeId);
    if (!p) { toast('پالتی برای خروجی وجود ندارد', 'error'); return; }
    downloadText(`${slugify(p.name)}.${format === 'tailwind' ? 'js' : format}`, renderExport(format, p), EXPORT_MIME[format]);
    toast('خروجی دانلود شد');
}

async function downloadAll() {
    const s = await loadState();
    if (!s.palettes.length) { toast('پالتی برای خروجی وجود ندارد', 'error'); return; }
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    downloadText(`rangarang-palettes-${stamp}.json`, JSON.stringify(exportAllData(s), null, 2), EXPORT_MIME.json);
    toast('خروجی دانلود شد');
}

/* ---------- مودال ---------- */
const backdrop = $('#modal-backdrop');
const mForm = $('#modal-form');
const mTitle = $('#modal-title');
const mError = $('#modal-error');
const mHex = $('#m-hex');
const mPicker = $('#m-picker');

const FIELD_MATRIX = {
    palette_create: { title: 'پالت جدید',   name: true, desc: true,  hex: false, submit: 'ساخت پالت', action: 'palette_create' },
    palette_rename: { title: 'ویرایش پالت', name: true, desc: true,  hex: false, submit: 'ذخیره',     action: 'palette_update' },
    color_add:      { title: 'افزودن رنگ',  name: true, desc: false, hex: true,  submit: 'افزودن',     action: 'color_add' },
    color_edit:     { title: 'ویرایش رنگ',  name: true, desc: false, hex: true,  submit: 'ذخیره',     action: 'color_update' },
};
let modalMode = null;

function openModal(mode, defaults = {}) {
    modalMode = mode;
    const cfg = FIELD_MATRIX[mode];
    mTitle.textContent = cfg.title;
    mForm.action.value = mode;
    mForm.dataset.recordId = defaults.id ?? '';
    mForm.dataset.paletteId = defaults.paletteId ?? CM.paletteId ?? '';
    mForm.querySelector('button[type=submit]').textContent = cfg.submit;
    $('#field-name').hidden = !cfg.name;
    $('#field-desc').hidden = !cfg.desc;
    $('#field-hex').hidden = !cfg.hex;
    mForm.name.value = defaults.name ?? '';
    mForm.description.value = defaults.description ?? '';
    mHex.value = defaults.hex ?? '';
    mPicker.value = normalizeHex(defaults.hex) || '#7C6CFF';
    mError.hidden = true;
    backdrop.hidden = false;
    (cfg.hex ? mHex : mForm.name).focus();
}
function closeModal() {
    backdrop.hidden = true;
    modalMode = null;
}

mPicker.addEventListener('input', () => { mHex.value = mPicker.value.toUpperCase(); });
mHex.addEventListener('input', () => { const n = normalizeHex(mHex.value); if (n) mPicker.value = n; });
mHex.addEventListener('change', () => { const n = normalizeHex(mHex.value); if (n) mHex.value = n; });
$('#modal-cancel').addEventListener('click', closeModal);
backdrop.addEventListener('mousedown', ev => { if (ev.target === backdrop) closeModal(); });

mForm.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!modalMode) return;
    const mode = modalMode;
    const cfg = FIELD_MATRIX[mode];
    const data = {
        name: mForm.name.value.trim(),
        hex: mHex.value.trim(),
        description: mForm.description.value.trim(),
    };
    if (cfg.name && data.name === '') {
        mError.textContent = 'نام نمیتواند خالی باشد';
        mError.hidden = false;
        return;
    }
    if (cfg.hex && !normalizeHex(data.hex)) {
        mError.textContent = 'کد رنگ نامعتبر است (مثال: #FF5733)';
        mError.hidden = false;
        return;
    }

    const idKey = (mode === 'palette_rename' || mode === 'color_edit') ? 'id' : 'palette_id';
    const targetId = mForm.dataset.recordId || mForm.dataset.paletteId || '';
    const payload = { [idKey]: targetId, ...data };
    if (mode === 'palette_create') delete payload.palette_id;

    const res = await api(cfg.action, payload);
    if (res.ok) {
        closeModal();
        toast('انجام شد ✓');
        if (mode === 'palette_create' && res.id) await gotoPalette(res.id);
        else await refresh();
    } else {
        mError.textContent = res.error || 'خطای نامشخص';
        mError.hidden = false;
    }
});

/* ---------- کلیکها ---------- */
document.addEventListener('click', async ev => {
    const hit = sel => ev.target.closest(sel);
    if (hit('#btn-new-palette') || hit('#btn-welcome-create')) { openModal('palette_create'); return; }
    if (hit('#btn-add-color') || hit('#btn-first-color')) { openModal('color_add'); return; }
    if (hit('#btn-export')) { const menu = $('#export-menu'); if (menu) menu.hidden = !menu.hidden; return; }
    const fmt = hit('#export-menu [data-format]');
    if (fmt) { $('#export-menu').hidden = true; await downloadPalette(fmt.dataset.format); return; }
    if (hit('#btn-export-all')) { await downloadAll(); return; }
    if (hit('#btn-import')) { $('#import-file').click(); return; }
    const item = hit('#palette-list .palette-item');
    if (item) { ev.preventDefault(); await gotoPalette(+item.dataset.id); }
});

document.addEventListener('mousedown', ev => {
    const menu = $('#export-menu');
    if (menu && !menu.hidden && !ev.target.closest('.export-wrap')) menu.hidden = true;
});

/* ---------- درونریزی JSON ---------- */
const importInput = $('#import-file');
importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('حجم فایل بیشتر از ۲ مگابایت است.', 'error'); return; }

    let text;
    try { text = await file.text(); }
    catch { toast('خواندن فایل ناموفق بود.', 'error'); return; }

    let data;
    try { data = JSON.parse(text); }
    catch { toast('فایل JSON معتبر نیست.', 'error'); return; }

    const list = Array.isArray(data) ? data
        : data && Array.isArray(data.palettes) ? data.palettes
        : data && Array.isArray(data.colors) ? [data] : null;
    if (!list) { toast('ساختار فایل شناخته نشد (کلید palettes یا colors لازم است).', 'error'); return; }
    if (!list.length) { toast('فایل هیچ پالتی ندارد.', 'error'); return; }

    const colorTotal = list.reduce((sum, p) => sum + (p && Array.isArray(p.colors) ? p.colors.length : 0), 0);
    if (!confirm(`وارد کردن ${list.length} پالت با ${colorTotal} رنگ؟`)) return;

    const res = await api('palette_import', { data: text });
    if (!res.ok) { toast(res.error || 'ورود پالتها ناموفق بود.', 'error'); return; }

    let message = `وارد شد: ${res.palettes} پالت و ${res.colors} رنگ`;
    if (res.skipped) message += ` (${res.skipped} رنگ نامعتبر رد شد)`;
    toast(message);
    await refresh();
});

/* ---------- Context Menu اختصاصی ---------- */
const ctxMenu = $('#ctx-menu');
let ctxTarget = null;

function showCtx(template, x, y, data) {
    ctxTarget = data;
    ctxMenu.innerHTML = '';
    ctxMenu.appendChild($('#tpl-ctx-' + template).content.cloneNode(true));
    const label = $('.ctx-hex-label', ctxMenu);
    if (template === 'color') {
        if (label) label.textContent = data.hex;
        const dot = $('.ctx-dot', ctxMenu);
        if (dot) dot.style.setProperty('--dot', data.hex);
        const favItem = $('[data-cmd=favorite]', ctxMenu);
        if (favItem && data.isFavorite) favItem.textContent = 'حذف ستاره';
    } else {
        if (label) label.textContent = data.name;
        const copyAll = $('[data-cmd=copy-all]', ctxMenu);
        if (copyAll && data.id !== CM.paletteId) copyAll.remove();
    }
    ctxMenu.hidden = false;
    const r = ctxMenu.getBoundingClientRect();
    ctxMenu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    ctxMenu.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
}
function hideCtx() { ctxMenu.hidden = true; }

document.addEventListener('contextmenu', ev => {
    if (ev.target.closest('input, textarea, [contenteditable]')) { hideCtx(); return; }
    const swatch = ev.target.closest('.swatch');
    const paletteTitle = ev.target.closest('[data-ctx="palette"]');
    const paletteItem = ev.target.closest('.palette-item');

    if (swatch) {
        ev.preventDefault();
        showCtx('color', ev.clientX, ev.clientY, {
            type: 'color', id: +swatch.dataset.id, hex: swatch.dataset.hex,
            name: swatch.dataset.name, isFavorite: swatch.querySelector('.sw-fav') != null,
        });
    } else if (paletteTitle || paletteItem) {
        ev.preventDefault();
        const el = paletteTitle || paletteItem;
        showCtx('palette', ev.clientX, ev.clientY, {
            type: 'palette', id: +el.dataset.ctxId || +el.dataset.id,
            name: el.dataset.ctxName ?? el.dataset.name ?? 'پالت',
            description: el.dataset.ctxDesc ?? el.dataset.desc ?? '',
        });
    } else if (CM.paletteId) {
        ev.preventDefault();
        const title = $('[data-ctx="palette"]');
        showCtx('palette', ev.clientX, ev.clientY, {
            type: 'palette', id: CM.paletteId,
            name: title?.dataset.ctxName ?? 'پالت',
            description: title?.dataset.ctxDesc ?? '',
        });
    }
});
document.addEventListener('mousedown', ev => { if (!ev.target.closest('.ctx-menu')) hideCtx(); });

ctxMenu.addEventListener('click', async ev => {
    const btn = ev.target.closest('.ctx-item');
    if (!btn || !ctxTarget) return;
    const cmd = btn.dataset.cmd;
    const t = ctxTarget;
    hideCtx();

    switch (cmd) {
        case 'copy-hex':
            await copyText(t.hex);
            break;
        case 'copy-rgb': {
            const { r, g, b } = hexToRgb(t.hex);
            await copyText(`rgb(${r}, ${g}, ${b})`);
            break;
        }
        case 'copy-css-var':
            await copyText(`--${t.name || 'color'}: ${t.hex};`);
            break;
        case 'edit':
            openModal('color_edit', { id: t.id, hex: t.hex, name: t.name });
            break;
        case 'favorite': {
            const res = await api('color_favorite', { id: t.id });
            if (!res.ok) { toast(res.error, 'error'); break; }
            toast(t.isFavorite ? 'ستاره حذف شد' : 'ستاره دار شد ★');
            await refresh();
            break;
        }
        case 'lighten':
        case 'darken': {
            const percent = cmd === 'lighten' ? 10 : -10;
            const res = await api('color_shade', { id: t.id, percent });
            if (!res.ok) { toast(res.error, 'error'); break; }
            toast(`${t.hex} ← ${res.hex}`);
            await refresh();
            break;
        }
        case 'delete':
            if (t.type === 'palette') {
                if (!confirm(`پالت «${t.name}» و همهٔ رنگهایش برای همیشه حذف شود؟`)) break;
                const res = await api('palette_delete', { id: t.id });
                if (!res.ok) { toast(res.error, 'error'); break; }
                toast('پالت حذف شد');
                await refresh();
            } else if (confirm('این رنگ حذف شود؟')) {
                const res = await api('color_delete', { id: t.id });
                if (!res.ok) { toast(res.error, 'error'); break; }
                toast('رنگ حذف شد');
                await refresh();
            }
            break;
        case 'rename':
            openModal('palette_rename', { id: t.id, name: t.name, description: t.description });
            break;
        case 'add-color':
            openModal('color_add', { paletteId: t.id });
            break;
        case 'copy-all': {
            const hexes = $$('.swatch').map(s => s.dataset.hex);
            if (hexes.length) await copyText(hexes.join('\n'));
            else toast('این پالت رنگی ندارد', 'error');
            break;
        }
    }
});

/* ---------- Drag & Drop ترتیب رنگها ---------- */
let dragEl = null;
let dragStartOrder = null;

$('#workspace').addEventListener('dragstart', ev => {
    const sw = ev.target.closest('.swatch');
    if (!sw) return;
    dragEl = sw;
    dragStartOrder = $$('.swatch').map(el => el.dataset.id);
    sw.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', sw.dataset.id);
});

$('#workspace').addEventListener('dragover', ev => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (!dragEl) return;
    const grid = $('#swatch-grid');
    const over = ev.target.closest('.swatch');
    if (!over || over === dragEl) return;
    $$('.drag-over', grid).forEach(x => x.classList.remove('drag-over'));
    over.classList.add('drag-over');
    // چیدمان RTL: نیمهی بصری راستِ المان مقصد = قبل در ترتیب DOM
    const r = over.getBoundingClientRect();
    grid.insertBefore(dragEl, ev.clientX > r.left + r.width / 2 ? over : over.nextSibling);
});

$('#workspace').addEventListener('drop', ev => ev.preventDefault());
$('#workspace').addEventListener('dragend', async () => {
    $$('.drag-over').forEach(x => x.classList.remove('drag-over'));
    if (!dragEl) return;
    dragEl.classList.remove('dragging');
    const order = $$('.swatch').map(el => el.dataset.id);
    const changed = dragStartOrder && JSON.stringify(order) !== JSON.stringify(dragStartOrder);
    dragEl = null;
    dragStartOrder = null;
    if (changed) {
        const res = await api('color_reorder', { palette_id: CM.paletteId, ids: JSON.stringify(order) });
        res.ok ? toast('ترتیب ذخیره شد') : toast(res.error, 'error');
    }
});

/* ---------- جستجو (Ctrl+K) ---------- */
const searchOverlay = $('#search-overlay');
const searchInput = $('#search-input');
const searchResults = $('#search-results');

function openSearch() {
    searchOverlay.hidden = false;
    setTimeout(() => searchInput.focus(), 40);
}
function closeSearch() {
    searchOverlay.hidden = true;
    searchInput.value = '';
    searchResults.innerHTML = '';
}
$('#btn-search-toggle').addEventListener('click', openSearch);
searchOverlay.addEventListener('mousedown', ev => { if (ev.target === searchOverlay) closeSearch(); });
document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openSearch(); }
    if (ev.key === 'Escape') {
        hideCtx();
        if (!searchOverlay.hidden) closeSearch();
        if (!backdrop.hidden) closeModal();
    }
});
searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 1) { searchResults.innerHTML = ''; return; }
    const rows = [];
    $$('.palette-item').forEach(item => {
        if ((item.dataset.name || '').toLowerCase().includes(q)) {
            rows.push({
                label: item.dataset.name, type: 'پالت', goto: +item.dataset.id,
                swatch: 'linear-gradient(135deg, #7c6cff, #33d6a6)',
            });
        }
    });
    $$('.swatch').forEach(sw => {
        if (sw.dataset.hex.toLowerCase().includes(q) || (sw.dataset.name || '').toLowerCase().includes(q)) {
            rows.push({
                label: (sw.dataset.name ? sw.dataset.name + ' — ' : '') + sw.dataset.hex,
                type: 'رنگ', swatch: sw.dataset.hex, hex: sw.dataset.hex,
            });
        }
    });
    searchResults.innerHTML = '';
    if (!rows.length) { searchResults.innerHTML = '<div class="sr-empty">نتیجهای پیدا نشد</div>'; return; }
    rows.slice(0, 12).forEach(r => {
        const el = document.createElement(r.goto ? 'a' : 'button');
        el.className = 'sr-item';
        if (r.goto) {
            el.href = '#';
            el.addEventListener('click', async ev => { ev.preventDefault(); closeSearch(); await gotoPalette(r.goto); });
        }
        if (r.hex) el.addEventListener('click', () => { closeSearch(); copyText(r.hex); });
        el.innerHTML = `<span class="sr-dot" style="background:${r.swatch}"></span>
            <span class="sr-label">${r.label.replace(/</g, '&lt;')}</span>
            <span class="sr-type">${r.type}</span>`;
        searchResults.appendChild(el);
    });
});

/* ---------- همگامسازی بین پاپاپ و تب ---------- */
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STATE_KEY]) refresh();
});

refresh();
