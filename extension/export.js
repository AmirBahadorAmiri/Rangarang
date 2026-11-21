/* رنگارنگ — خروجی فایلها در مرورگر (جایگزین export.php) */
'use strict';

const EXPORT_MIME = {
    css: 'text/css;charset=utf-8',
    json: 'application/json;charset=utf-8',
    scss: 'text/x-scss;charset=utf-8',
    tailwind: 'application/javascript;charset=utf-8',
    txt: 'text/plain;charset=utf-8',
};

function exportPaletteData(p) {
    return {
        name: p.name,
        description: p.description && p.description.trim() ? p.description : null,
        colors: p.colors.map(c => ({
            hex: c.hex,
            name: c.name && c.name.trim() ? c.name : null,
            favorite: !!c.favorite,
        })),
    };
}

function exportAllData(state) {
    return {
        app: 'rangarang',
        version: 1,
        type: 'palettes',
        exported_at: new Date().toISOString(),
        palettes: state.palettes.map(exportPaletteData),
    };
}

function slugify(value) {
    const out = String(value ?? '').replace(/[^\w-]+/gu, '-').replace(/^-+|-+$/g, '');
    return out || 'palette';
}

/** نام متغیر انگلیسی منحصربهفرد برای هر رنگ (همان منطق export.php) */
function variableNames(colors) {
    const names = [];
    colors.forEach((c, i) => {
        const base = c.name || `color-${i + 1}`;
        const clean = slugify(base) || `color-${i + 1}`;
        let candidate = clean, n = 2;
        while (names.includes(candidate)) candidate = `${clean}-${n++}`;
        names.push(candidate);
    });
    return names;
}

function renderExport(format, p) {
    const vars = variableNames(p.colors);
    const lines = p.colors.map((c, i) => ({ ...c, var: vars[i] }));

    switch (format) {
        case 'json':
            return JSON.stringify(exportPaletteData(p), null, 2);
        case 'scss':
            return `// ${p.name}\n` + lines.map(c => `$${c.var}: ${c.hex};`).join('\n') + '\n';
        case 'tailwind':
            return `/** ${p.name} — tailwind.config.js */\nmodule.exports = {\n  theme: { extend: { colors: {\n    '${slugify(p.name)}': {\n`
                + lines.map(c => `      '${c.var}': '${c.hex}',`).join('\n')
                + '\n    },\n  } } } }\n';
        case 'txt':
            return p.colors.map(c => c.hex).join('\n') + (p.colors.length ? '\n' : '');
        case 'css':
        default:
            return `/* ${p.name} */\n:root {\n` + lines.map(c => `  --${c.var}: ${c.hex};`).join('\n') + '\n}\n';
    }
}

function downloadText(filename, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
