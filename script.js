(() => {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const root = document.documentElement;

    /* ---------- 1. Год в подвале ---------- */
    const yearEl = $('[data-year]');
    if (yearEl) {
        const year = new Date().getFullYear();
        yearEl.textContent = year > 2024 ? `2024–${year}` : '2024';
    }

    /* ---------- 2. Ссылки-заглушки (href="#") не прыгают наверх ---------- */
    document.addEventListener('click', (e) => {
        if (e.target.closest('a[href="#"]')) e.preventDefault();
    });

    /* ---------- 3. Тёмная / светлая тема ---------- */
    const themeBtn = $('[data-theme-toggle]');

    const syncThemeButton = () => {
        themeBtn?.setAttribute('aria-pressed', root.dataset.theme === 'dark');
    };

    themeBtn?.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch {}
        syncThemeButton();
    });
    syncThemeButton();

    /* ---------- 4. Мобильное меню ---------- */
    const header = $('.site-header');
    const navBtn = $('[data-nav-toggle]');

    const setNav = (open) => {
        header.classList.toggle('nav-open', open);
        navBtn.setAttribute('aria-expanded', open);
        navBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };

    navBtn?.addEventListener('click', () => setNav(!header.classList.contains('nav-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navBtn) setNav(false); });
    matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches && navBtn) setNav(false); });

    /* ---------- 5. Поиск по вики ---------- */
    // Чтобы добавить статью в поиск, допишите строку в этот список.
    // Если страницы ещё нет, оставьте url: null, и результат будет с пометкой «скоро».
    const searchIndex = [
        { title: 'Energon Universe', info: 'Комиксы',  url: 'energon-universe.html' },
        { title: 'Transformers One', info: 'Фильмы',   url: null },
        { title: 'Age of the Primes', info: 'Статья',  url: null },
        { title: 'Cyberworld',        info: 'Статья',  url: null }
    ];

    document.body.insertAdjacentHTML('beforeend', `
        <dialog class="search-dialog" aria-label="Поиск по вики">
            <form class="search-box" role="search">
                <input class="control" type="search" placeholder="Поиск по вики…" aria-label="Поиск" autocomplete="off">
                <button class="search-close" type="button" aria-label="Закрыть поиск">✕</button>
            </form>
            <ul class="search-results"></ul>
            <p class="search-hint">Enter — открыть первый результат · Esc — закрыть</p>
        </dialog>
    `);

    const dialog = $('.search-dialog');
    const searchForm = $('.search-box', dialog);
    const searchInput = $('input', dialog);
    const resultsList = $('.search-results', dialog);

    const renderResults = () => {
        const query = searchInput.value.trim().toLowerCase();
        const found = searchIndex.filter((item) => item.title.toLowerCase().includes(query));

        resultsList.replaceChildren();

        if (!found.length) {
            const empty = document.createElement('li');
            empty.className = 'search-empty';
            empty.textContent = 'Ничего не найдено';
            resultsList.append(empty);
            return;
        }

        found.forEach((item) => {
            const li = document.createElement('li');
            const row = document.createElement(item.url ? 'a' : 'span');
            row.className = 'search-result' + (item.url ? '' : ' is-soon');
            if (item.url) row.href = item.url;

            const title = document.createElement('span');
            title.textContent = item.title;

            const info = document.createElement('small');
            info.textContent = item.url ? item.info : 'скоро';

            row.append(title, info);
            li.append(row);
            resultsList.append(li);
        });
    };

    const openSearch = () => {
        if (dialog.open) return;
        dialog.showModal();
        searchInput.value = '';
        renderResults();
        searchInput.focus();
    };

    $$('[data-search-open]').forEach((btn) => btn.addEventListener('click', openSearch));
    $('.search-close', dialog).addEventListener('click', () => dialog.close());
    searchInput.addEventListener('input', renderResults);

    // Клик по тёмному фону закрывает окно
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    // Enter открывает первый результат
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const first = $('a.search-result', resultsList);
        if (first) location.href = first.href;
    });

    // Горячие клавиши: «/» и Ctrl+K
    document.addEventListener('keydown', (e) => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
        if ((e.key === '/' && !typing) || ctrlK) {
            e.preventDefault();
            openSearch();
        }
    });

    /* ---------- 6. Кнопка «Наверх» ---------- */
    const toTop = document.createElement('button');
    toTop.className = 'to-top';
    toTop.type = 'button';
    toTop.setAttribute('aria-label', 'Наверх');
    toTop.textContent = '↑';
    document.body.append(toTop);

    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    addEventListener('scroll', () => {
        toTop.classList.toggle('is-visible', window.scrollY > 600);
    }, { passive: true });

    /* ---------- 7. Плавное появление блоков ---------- */
    const revealItems = $$('.reveal');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if ('IntersectionObserver' in window && !reduceMotion) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        revealItems.forEach((el) => observer.observe(el));
    } else {
        revealItems.forEach((el) => el.classList.add('is-visible'));
    }

    /* ---------- 8. Счётчик символов в форме ---------- */
    $$('textarea[maxlength]').forEach((area) => {
        const output = $(`[data-counter-for="${area.id}"]`);
        if (!output) return;

        const update = () => { output.textContent = `${area.value.length} / ${area.maxLength}`; };
        area.addEventListener('input', update);
        update();
    });

    /* ---------- 9. Страница «Спасибо»: показываем данные из формы ---------- */
    if ($('[data-thanks]')) {
        const params = new URLSearchParams(location.search);
        const name = (params.get('name') || '').trim();

        if (name) $('[data-thanks-title]').textContent = `Спасибо, ${name}!`;

        const rows = [
            ['Тип', params.get('type')],
            ['Категория', params.get('category')],
            ['Email', params.get('email')],
            ['Описание', params.get('message')]
        ].filter(([, value]) => value && value.trim());

        if (rows.length) {
            const list = $('[data-thanks-summary]');
            rows.forEach(([label, value]) => {
                const dt = document.createElement('dt');
                const dd = document.createElement('dd');
                dt.textContent = label;
                dd.textContent = value.length > 200 ? value.slice(0, 200) + '…' : value;
                list.append(dt, dd);
            });
            list.hidden = false;
        }
    }
})();
