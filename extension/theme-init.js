/* رنگارنگ — اعمال اولیهی تم قبل از بارگذاری استایل (اسکریپت خارجی: CSP اکستنشن) */
(function () {
    var theme;
    try { theme = localStorage.getItem('rg-theme'); } catch (e) {}
    if (theme !== 'light' && theme !== 'dark') {
        theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = theme;
    var meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = theme === 'light' ? '#f4f5fb' : '#0d0f17';
    document.head.appendChild(meta);
})();
