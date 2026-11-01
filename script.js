(() => {
    'use strict';

    /* =====================================================
       0. МЕЛОЧИ
       ===================================================== */

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
    const root = document.documentElement;

    // Защита от вставки чужого HTML: весь пользовательский текст проходит через esc()
    const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const isHttp = (url) => /^https?:\/\//i.test(url || '');

    const here = location.pathname.split('/').pop() || 'index.html';
    const fullPath = here + location.search;               // для ?next=
    let decodedSearch = location.search;
    try { decodedSearch = decodeURIComponent(location.search); } catch {}
    const currentRoute = here + decodedSearch;             // для подсветки пунктов меню

    const fmtDate = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    const when = (ts) => {
        const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((day(new Date()) - day(new Date(ts))) / 864e5);
        if (diff <= 0) return 'Сегодня';
        if (diff === 1) return 'Вчера';
        return new Date(ts).toLocaleDateString('ru-RU');
    };

    /* =====================================================
       1. ДАННЫЕ (localStorage)
       Когда появится сервер, заменить нужно будет только этот раздел
       ===================================================== */

    const store = {
        get(key, fallback) {
            try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch {}
        }
    };

    const list = (key) => ({
        all: () => store.get(key, []),
        save: (items) => store.set(key, items)
    });

    const users = list('asdb_users');
    const articles = list('asdb_articles');
    const comments = list('asdb_comments');

    const CATEGORY_GROUPS = {
        'ВСЕЛЕННЫЕ': ['Фильмы', 'Мультсериалы', 'Комиксы', 'Игрушки', 'Видеоигры', 'Книги'],
        'ЭНЦИКЛОПЕДИЯ': ['Персонажи', 'Фракции', 'Локации', 'События']
    };
    const CATEGORIES = [...Object.values(CATEGORY_GROUPS).flat(), 'Другое'];

    // Статьи, написанные вручную в HTML
    const BUILTIN = [{
        id: 'energon-universe',
        url: 'energon-universe.html',
        title: 'Energon Universe',
        category: 'Комиксы',
        summary: 'Общая вселенная комиксов Skybound Entertainment по свойствам Hasbro.',
        image: 'energonuniverse.jpg',
        author: 'Allspark Database',
        created: 0,
        updated: 0
    }];

    // Статьи, которых ещё нет (для поиска)
    const COMING = [
        { title: 'Transformers One', info: 'Фильмы' },
        { title: 'Age of the Primes', info: 'Статья' },
        { title: 'Cyberworld', info: 'Статья' }
    ];

    const communityArticles = () => articles.all()
        .map((a) => ({ ...a, url: `article.html?id=${a.id}`, author: a.authorName }))
        .sort((a, b) => b.updated - a.updated);

    const allArticles = () => [...communityArticles(), ...BUILTIN];

    /* =====================================================
       2. АККАУНТЫ
       ===================================================== */

    // Простой запасной хеш на случай, если браузер не даёт crypto.subtle (http без https)
    const simpleHash = (text) => {
        let h = 5381;
        for (const ch of text) h = (h * 33) ^ ch.codePointAt(0);
        return 'x' + (h >>> 0).toString(16);
    };

    const hashPassword = async (email, password) => {
        const text = `${email}:${password}`;
        if (!window.crypto?.subtle) return simpleHash(text);
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    };

    const currentUser = () => {
        const id = store.get('asdb_session', null);
        return users.all().find((u) => u.id === id) || null;
    };

    const STORAGE_ERROR = 'Не удалось сохранить данные. Проверьте, что браузер разрешает хранилище сайта.';

    // Возвращают текст ошибки или null, если всё хорошо
    const register = async (name, email, password) => {
        email = email.trim().toLowerCase();
        if (users.all().some((u) => u.email === email)) return 'Этот email уже зарегистрирован';

        const user = {
            id: uid(),
            name: name.trim(),
            email,
            pass: await hashPassword(email, password),
            created: Date.now()
        };

        if (!users.save([...users.all(), user])) return STORAGE_ERROR;
        store.set('asdb_session', user.id);
        return currentUser() ? null : STORAGE_ERROR;
    };

    const login = async (email, password) => {
        email = email.trim().toLowerCase();
        const pass = await hashPassword(email, password);
        const user = users.all().find((u) => u.email === email && u.pass === pass);
        if (!user) return 'Неверный email или пароль';
        store.set('asdb_session', user.id);
        return null;
    };

    const logout = () => store.remove('asdb_session');

    const loginUrl = () => `account.html?next=${encodeURIComponent(fullPath)}`;

    /* =====================================================
       3. ШАПКА, САЙДБАР И ПОДВАЛ (одно место для всех страниц)
       ===================================================== */

    const NAV = [
        ['index.html', 'ГЛАВНАЯ'],
        ['articles.html', 'СТАТЬИ'],
        ['articles.html?cat=Игрушки', 'ИГРУШКИ'],
        ['articles.html?cat=Комиксы', 'КОМИКСЫ']
    ];

    const socialsHtml = `
        <a class="icon-link" href="#" aria-label="Discord"><img src="akar-icons_discord-fill.png" alt=""></a>
        <a class="icon-link" href="#" aria-label="Bluesky"><img src="line-md_bluesky-filled.png" alt=""></a>
        <a class="icon-link" href="#" aria-label="Twitter / X"><img src="line-md_twitter-x.png" alt=""></a>
        <a class="icon-link" href="#" aria-label="Почта"><img src="mdi_gmail.png" alt=""></a>`;

    const headerHtml = () => {
        const user = currentUser();

        const navItems = NAV.map(([href, label]) =>
            `<li><a href="${href}"${href === currentRoute ? ' aria-current="page"' : ''}>${label}</a></li>`
        ).join('');

        const account = user
            ? `<a class="avatar" href="profile.html" title="${esc(user.name)}" aria-label="Профиль: ${esc(user.name)}">${esc(user.name.charAt(0).toUpperCase())}</a>`
            : `<a class="icon-link" href="account.html" aria-label="Войти"><img src="material-symbols_login.png" alt=""></a>`;

        return `
        <header class="site-header">
            <div class="header-inner">
                <a class="logo" href="index.html">Allspark Database</a>

                <nav class="main-nav" id="main-nav" aria-label="Основное меню">
                    <ul>
                        ${navItems}
                        <li><a class="nav-write" href="new-article.html">+ НАПИСАТЬ</a></li>
                        <li>
                            <button type="button" class="nav-search" data-search-open>
                                ПОИСК
                                <img src="Group.png" alt="" class="search-icon">
                            </button>
                        </li>
                    </ul>
                </nav>

                <div class="header-actions">
                    <div class="socials">${socialsHtml}</div>
                    ${account}
                    <button type="button" class="icon-btn theme-toggle" data-theme-toggle aria-label="Переключить тему"></button>
                    <button type="button" class="icon-btn nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="main-nav" aria-label="Открыть меню">
                        <span class="burger" aria-hidden="true"></span>
                    </button>
                </div>
            </div>
        </header>`;
    };

    const sidebarHtml = () => {
        const groups = Object.entries(CATEGORY_GROUPS).map(([title, items]) => `
            <p class="sidebar-group">${title}</p>
            <ul class="sidebar-list">
                ${items.map((c) => `<li><a href="articles.html?cat=${c}">${c}</a></li>`).join('')}
            </ul>`).join('');

        const recent = allArticles().slice(0, 5).map((a) => `
            <li>
                <a href="${esc(a.url)}"${a.url === currentRoute ? ' aria-current="page"' : ''}>${esc(a.title)}</a>
                ${a.created ? `<span class="when">${when(a.updated)}</span>` : ''}
            </li>`).join('');

        return `
        <aside class="sidebar">
            <div class="sidebar-inner">
                <nav class="sidebar-section" aria-label="Категории">
                    <h2 class="sidebar-title">КАТЕГОРИИ</h2>
                    ${groups}
                </nav>
                <section class="sidebar-section">
                    <h2 class="sidebar-title">ПОСЛЕДНИЕ<br>ИЗМЕНЕНИЯ</h2>
                    <ul class="sidebar-changes">${recent}</ul>
                </section>
            </div>
        </aside>`;
    };

    const footerHtml = () => `
        <footer class="site-footer" id="footer">
            <div class="footer-inner">
                <div class="footer-brand">
                    <a class="logo" href="index.html">Allspark Database</a>
                    <p>Неофициальная вики о Трансформерах.</p>
                </div>

                <nav class="footer-nav" aria-label="О проекте">
                    <ul>
                        <li><a href="articles.html">Все статьи</a></li>
                        <li><a href="#">О вики</a></li>
                        <li><a href="#">Политика конфиденциальности</a></li>
                        <li><a href="#">Предупреждения</a></li>
                    </ul>
                </nav>

                <div class="footer-socials">${socialsHtml}</div>

                <div class="footer-bottom">
                    <p>© <span data-year>2024</span> Allspark Database.</p>
                    <p class="footer-legal">Transformers и связанные названия — торговые марки Hasbro. Проект неофициальный и не связан с Hasbro.</p>
                </div>
            </div>
        </footer>`;

    const mount = (selector, html) => {
        const el = $(selector);
        if (el) el.outerHTML = html;
    };

    mount('[data-site-header]', headerHtml());
    mount('[data-site-sidebar]', sidebarHtml());
    mount('[data-site-footer]', footerHtml());

    /* =====================================================
       4. ОБЩИЕ ФУНКЦИИ СТРАНИЦЫ
       ===================================================== */

    // Год в подвале
    const yearEl = $('[data-year]');
    if (yearEl) {
        const year = new Date().getFullYear();
        yearEl.textContent = year > 2024 ? `2024–${year}` : '2024';
    }

    // Ссылки-заглушки (href="#") не прыгают наверх
    document.addEventListener('click', (e) => {
        if (e.target.closest('a[href="#"]')) e.preventDefault();
    });

    // Сломанная картинка по ссылке от пользователя просто скрывается
    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG' && e.target.dataset.userImg !== undefined) e.target.style.display = 'none';
    }, true);

    // Тема
    const themeBtn = $('[data-theme-toggle]');
    const syncThemeButton = () => themeBtn?.setAttribute('aria-pressed', root.dataset.theme === 'dark');

    themeBtn?.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch {}
        syncThemeButton();
    });
    syncThemeButton();

    // Мобильное меню
    const header = $('.site-header');
    const navBtn = $('[data-nav-toggle]');

    const setNav = (open) => {
        header.classList.toggle('nav-open', open);
        navBtn.setAttribute('aria-expanded', open);
        navBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };

    navBtn.addEventListener('click', () => setNav(!header.classList.contains('nav-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
    matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setNav(false); });

    /* ---------- Поиск ---------- */

    const searchItems = () => [
        ...allArticles().map((a) => ({ title: a.title, info: a.category, url: a.url })),
        ...COMING.map((c) => ({ ...c, url: null }))
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
        const found = searchItems().filter((item) => item.title.toLowerCase().includes(query));

        resultsList.innerHTML = found.length
            ? found.map((item) => item.url
                ? `<li><a class="search-result" href="${esc(item.url)}"><span>${esc(item.title)}</span><small>${esc(item.info)}</small></a></li>`
                : `<li><span class="search-result is-soon"><span>${esc(item.title)}</span><small>скоро</small></span></li>`
            ).join('')
            : '<li class="search-empty">Ничего не найдено</li>';
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
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const first = $('a.search-result', resultsList);
        if (first) location.href = first.href;
    });

    document.addEventListener('keydown', (e) => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
        if ((e.key === '/' && !typing) || ctrlK) {
            e.preventDefault();
            openSearch();
        }
    });

    /* ---------- Кнопка «Наверх» ---------- */

    const toTop = document.createElement('button');
    toTop.className = 'to-top';
    toTop.type = 'button';
    toTop.setAttribute('aria-label', 'Наверх');
    toTop.textContent = '↑';
    document.body.append(toTop);

    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    addEventListener('scroll', () => toTop.classList.toggle('is-visible', window.scrollY > 600), { passive: true });

    /* ---------- Появление блоков ---------- */

    const revealItems = $$('.reveal');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if ('IntersectionObserver' in window && !reduceMotion) {
        root.classList.add('reveal-on');   // блоки прячутся, только когда скрипт готов их показать

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

    /* =====================================================
       5. КАРТОЧКИ И РАЗМЕТКА СТАТЕЙ
       ===================================================== */

    const cardHtml = (a) => `
        <a href="${esc(a.url)}" class="popular-card">
            <div class="card-media${a.image ? '' : ' no-image'}">
                ${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy" data-user-img>` : esc(a.title.charAt(0).toUpperCase())}
                <span class="badge">${esc(a.category)}</span>
                <span class="card-arrow" aria-hidden="true">→</span>
            </div>
            <div class="card-name">${esc(a.title)}</div>
            <p class="card-meta">${esc(a.author)}${a.created ? ' · ' + when(a.updated) : ''}</p>
        </a>`;

    // Превращает простую разметку в HTML: «## заголовок», «- список», «**жирный**»
    const renderBody = (text) => {
        const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        const headings = [];
        let html = '';

        for (const block of text.replace(/\r/g, '').split(/\n{2,}/)) {
            const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
            if (!lines.length) continue;

            if (lines[0].startsWith('## ')) {
                const title = lines.shift().slice(3).trim();
                const id = `section-${headings.length + 1}`;
                headings.push({ id, title });
                html += `<h2 id="${id}">${inline(title)}</h2>`;
                if (!lines.length) continue;
            }

            html += lines.every((l) => l.startsWith('- '))
                ? `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`
                : `<p>${lines.map(inline).join('<br>')}</p>`;
        }
        return { html, headings };
    };

    // «Название: значение» построчно
    const parseFacts = (text = '') => text.split('\n')
        .map((line) => {
            const i = line.indexOf(':');
            return i > 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : null;
        })
        .filter((row) => row && row[1]);

    /* =====================================================
       6. КОММЕНТАРИИ
       ===================================================== */

    const initComments = (box, key) => {
        const draw = () => {
            const user = currentUser();
            const items = comments.all().filter((c) => c.page === key).sort((a, b) => b.created - a.created);

            const form = user
                ? `<form class="comment-form">
                        <label class="sr-only" for="comment-text">Ваш комментарий</label>
                        <textarea class="control" id="comment-text" rows="3" maxlength="1000" required
                            placeholder="Комментарий от имени ${esc(user.name)}"></textarea>
                        <button type="submit" class="btn btn-filled">Отправить</button>
                   </form>`
                : `<p class="notice" style="margin-bottom:28px">Чтобы оставить комментарий, <a href="${loginUrl()}">войдите или зарегистрируйтесь</a>.</p>`;

            const rows = items.map((c) => `
                <li class="comment">
                    <div class="avatar avatar-sm" aria-hidden="true">${esc(c.authorName.charAt(0).toUpperCase())}</div>
                    <div class="comment-main">
                        <div class="comment-head">
                            <strong>${esc(c.authorName)}</strong>
                            <time>${fmtDate(c.created)}</time>
                            ${user && user.id === c.authorId ? `<button type="button" class="link-btn" data-delete-comment="${c.id}">Удалить</button>` : ''}
                        </div>
                        <p>${esc(c.text)}</p>
                    </div>
                </li>`).join('');

            box.innerHTML = `
                <h2 class="section-title">КОММЕНТАРИИ (${items.length})</h2>
                ${form}
                <ul class="comment-list">${rows || '<li class="comment-empty">Комментариев пока нет. Будьте первым!</li>'}</ul>`;
        };

        box.addEventListener('submit', (e) => {
            if (!e.target.matches('.comment-form')) return;
            e.preventDefault();

            const user = currentUser();
            const text = $('textarea', e.target).value.trim();
            if (!user || !text) return;

            comments.save([...comments.all(), {
                id: uid(), page: key, authorId: user.id, authorName: user.name, text, created: Date.now()
            }]);
            draw();
        });

        box.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-delete-comment]');
            if (!btn || !confirm('Удалить комментарий?')) return;

            const me = currentUser();
            comments.save(comments.all().filter((c) => !(c.id === btn.dataset.deleteComment && c.authorId === me?.id)));
            draw();
        });

        draw();
    };

    /* =====================================================
       7. СТРАНИЦЫ
       ===================================================== */

    /* ---------- Главная: новое от сообщества ---------- */
    const initHome = () => {
        const box = $('[data-community-latest]');
        if (!box) return;

        const latest = communityArticles().slice(0, 4);
        box.innerHTML = latest.length
            ? latest.map(cardHtml).join('')
            : '<p class="notice">Пока нет статей от участников. <a href="new-article.html">Напишите первую!</a></p>';
    };

    /* ---------- Вход и регистрация ---------- */
    const initAccount = () => {
        if (currentUser()) { location.replace('profile.html'); return; }

        // Возвращаем только на внутренние страницы сайта
        const rawNext = new URLSearchParams(location.search).get('next') || '';
        const next = /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(rawNext) ? rawNext : 'index.html';

        const handle = (form, action) => form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const error = $('.form-error', form);
            error.textContent = '';

            const message = await action(Object.fromEntries(new FormData(form)));
            if (message) error.textContent = message;
            else location.href = next;
        });

        handle($('#login-form'), (d) => login(d.email, d.password));
        handle($('#register-form'), (d) => (
            d.password !== d.password2 ? 'Пароли не совпадают' : register(d.name, d.email, d.password)
        ));
    };

    /* ---------- Профиль ---------- */
    const initProfile = () => {
        const user = currentUser();
        if (!user) { location.replace('account.html?next=profile.html'); return; }

        $('[data-profile]').hidden = false;
        $('[data-p-avatar]').textContent = user.name.charAt(0).toUpperCase();
        $('[data-p-name]').textContent = user.name;
        $('[data-p-meta]').textContent = `${user.email} · на сайте с ${fmtDate(user.created)}`;

        const listEl = $('[data-p-articles]');

        const draw = () => {
            const mine = communityArticles().filter((a) => a.authorId === user.id);
            listEl.innerHTML = mine.length
                ? mine.map((a) => `
                    <li>
                        <div>
                            <a class="title" href="${esc(a.url)}">${esc(a.title)}</a>
                            <small>${esc(a.category)} · ${fmtDate(a.updated)}</small>
                        </div>
                        <div class="row-actions">
                            <a class="btn btn-outline btn-sm" href="new-article.html?edit=${a.id}">Редактировать</a>
                            <button type="button" class="btn btn-danger btn-sm" data-delete="${a.id}">Удалить</button>
                        </div>
                    </li>`).join('')
                : '<li class="notice">Вы ещё не написали ни одной статьи.</li>';
        };

        listEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-delete]');
            if (!btn || !confirm('Удалить статью вместе с комментариями?')) return;

            const id = btn.dataset.delete;
            articles.save(articles.all().filter((a) => !(a.id === id && a.authorId === user.id)));
            comments.save(comments.all().filter((c) => c.page !== `article:${id}`));
            draw();
        });

        $('[data-logout]').addEventListener('click', () => {
            logout();
            location.href = 'index.html';
        });

        draw();
    };

    /* ---------- Редактор статьи ---------- */
    const initEditor = () => {
        const form = $('#article-form');
        const gate = $('[data-need-login]');
        const user = currentUser();

        if (!user) {
            gate.innerHTML = `Чтобы писать статьи, <a href="${loginUrl()}">войдите или зарегистрируйтесь</a>.`;
            gate.hidden = false;
            return;
        }

        const editId = new URLSearchParams(location.search).get('edit');
        const existing = editId ? articles.all().find((a) => a.id === editId) : null;

        if (editId && (!existing || existing.authorId !== user.id)) {
            gate.textContent = 'Статья не найдена, или вы не её автор.';
            gate.hidden = false;
            return;
        }

        form.hidden = false;
        form.elements.category.innerHTML = CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('');

        if (existing) {
            ['title', 'category', 'summary', 'image', 'facts', 'body'].forEach((k) => {
                form.elements[k].value = existing[k] || '';
            });
            $('[data-editor-title]').textContent = 'Редактирование статьи';
            $('[data-submit]').textContent = 'Сохранить изменения';
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const error = $('.form-error', form);
            const d = Object.fromEntries(new FormData(form));
            const image = d.image.trim();

            if (image && !isHttp(image)) {
                error.textContent = 'Ссылка на картинку должна начинаться с http:// или https://';
                return;
            }

            const fields = {
                title: d.title.trim(),
                category: d.category,
                summary: d.summary.trim(),
                image,
                facts: d.facts.trim(),
                body: d.body.trim()
            };
            const now = Date.now();
            const id = existing ? editId : uid();

            const ok = existing
                ? articles.save(articles.all().map((a) => (a.id === id ? { ...a, ...fields, updated: now } : a)))
                : articles.save([...articles.all(), { id, ...fields, authorId: user.id, authorName: user.name, created: now, updated: now }]);

            if (!ok) { error.textContent = STORAGE_ERROR; return; }
            location.href = `article.html?id=${id}`;
        });
    };

    /* ---------- Просмотр статьи участника ---------- */
    const initArticle = () => {
        const box = $('[data-article]');
        const commentsBox = $('[data-comments-auto]');
        const id = new URLSearchParams(location.search).get('id');
        const a = articles.all().find((x) => x.id === id);

        if (!a) {
            box.outerHTML = '<p class="notice">Статья не найдена. Возможно, она удалена или создана в другом браузере. <a href="articles.html">К списку статей</a></p>';
            commentsBox.remove();
            return;
        }

        const user = currentUser();
        const owner = user && user.id === a.authorId;
        const image = isHttp(a.image) ? a.image : '';
        const { html, headings } = renderBody(a.body);
        const edited = a.updated - a.created > 60000;

        document.title = `${a.title} | Allspark Database`;
        $('[data-crumb-cat]').textContent = a.category;
        $('[data-crumb-cat]').href = `articles.html?cat=${a.category}`;
        $('[data-crumb-title]').textContent = a.title;

        const toc = headings.length > 1
            ? `<nav class="toc" aria-label="Содержание">
                    <h2 class="toc-title">Содержание</h2>
                    <ol>${headings.map((h) => `<li><a href="#${h.id}">${esc(h.title)}</a></li>`).join('')}</ol>
               </nav>`
            : '';

        const rows = [
            ['Автор', a.authorName],
            ['Категория', a.category],
            ['Опубликовано', fmtDate(a.created)],
            ...parseFacts(a.facts)
        ].map(([k, v]) => `<div class="infobox-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

        box.classList.toggle('no-hero', !image);
        box.innerHTML = `
            <header class="article-header">
                <h1 class="article-title">${esc(a.title)}</h1>
                <p class="article-meta">Автор: <strong>${esc(a.authorName)}</strong> · ${fmtDate(a.created)}${edited ? ` · изменено ${fmtDate(a.updated)}` : ''}</p>
            </header>

            ${image ? `<img src="${esc(image)}" alt="${esc(a.title)}" class="article-hero-image" data-user-img>` : ''}

            <div class="article-body">
                ${toc}
                <p class="lead">${esc(a.summary)}</p>
                ${html}
            </div>

            <aside class="infobox" aria-label="Краткая информация">
                <h2 class="infobox-title">${esc(a.title)}</h2>
                <dl>${rows}</dl>
            </aside>

            <footer class="article-footer">
                <span class="article-footer-label">Категория:</span>
                <a class="tag-link" href="articles.html?cat=${esc(a.category)}">${esc(a.category)}</a>
                ${owner ? `<span class="article-owner">
                    <a class="btn btn-outline btn-sm" href="new-article.html?edit=${a.id}">Редактировать</a>
                    <button type="button" class="btn btn-danger btn-sm" data-delete-article>Удалить</button>
                </span>` : ''}
            </footer>`;

        $('[data-delete-article]', box)?.addEventListener('click', () => {
            if (!confirm('Удалить статью вместе с комментариями?')) return;
            articles.save(articles.all().filter((x) => x.id !== id));
            comments.save(comments.all().filter((c) => c.page !== `article:${id}`));
            location.href = 'profile.html';
        });

        initComments(commentsBox, `article:${id}`);
    };

    /* ---------- Каталог статей ---------- */
    const initArticlesPage = () => {
        const grid = $('[data-articles-grid]');
        const filters = $('[data-filters]');
        const search = $('[data-articles-q]');
        let category = new URLSearchParams(location.search).get('cat') || '';

        const draw = () => {
            const query = search.value.trim().toLowerCase();
            const items = allArticles().filter((a) =>
                (!category || a.category === category) &&
                `${a.title} ${a.summary || ''}`.toLowerCase().includes(query)
            );

            grid.innerHTML = items.length
                ? items.map(cardHtml).join('')
                : '<p class="notice">Ничего не найдено. <a href="new-article.html">Напишите статью на эту тему!</a></p>';

            filters.innerHTML = ['', ...CATEGORIES].map((c) =>
                `<button type="button" class="tag-link${c === category ? ' is-active' : ''}" data-cat="${esc(c)}">${esc(c || 'Все')}</button>`
            ).join('');
        };

        filters.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-cat]');
            if (!btn) return;
            category = btn.dataset.cat;
            history.replaceState(null, '', category ? `?cat=${encodeURIComponent(category)}` : here);
            draw();
        });

        search.addEventListener('input', draw);
        draw();
    };

    /* ---------- Страница «Спасибо» ---------- */
    const initThanks = () => {
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
            const dl = $('[data-thanks-summary]');
            rows.forEach(([label, value]) => {
                const dt = document.createElement('dt');
                const dd = document.createElement('dd');
                dt.textContent = label;
                dd.textContent = value.length > 200 ? value.slice(0, 200) + '…' : value;
                dl.append(dt, dd);
            });
            dl.hidden = false;
        }
    };

    ({
        home: initHome,
        account: initAccount,
        profile: initProfile,
        editor: initEditor,
        article: initArticle,
        articles: initArticlesPage,
        thanks: initThanks
    })[document.body.dataset.page]?.();

    // Комментарии на статьях, написанных вручную (например, energon-universe.html)
    $$('[data-comments]').forEach((box) => initComments(box, box.dataset.comments));

    // Счётчики символов (запускаются последними, когда поля уже заполнены)
    $$('textarea[maxlength]').forEach((area) => {
        const output = $(`[data-counter-for="${area.id}"]`);
        if (!output) return;

        const update = () => { output.textContent = `${area.value.length} / ${area.maxLength}`; };
        area.addEventListener('input', update);
        update();
    });
})();
