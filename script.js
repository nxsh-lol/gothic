'use strict';

const CONFIG = {
  apiKey: 'dc6928354c2596ad811fdc698560b4ac',
  base: 'https://api.themoviedb.org/3',
  img: 'https://image.tmdb.org/t/p/w780',
  storage: 'cs_saved_v2',
};

const SECTIONS = {
  home: {
    heroFn: () => API.trending('movie'),
    rowsFn: async () => {
      const [trending, topRated, newReleases, ...genres] = await Promise.all([
        API.trending('movie').then(r => ({ title: 'Trending Now', items: r.slice(0, 18) })),
        API.get('/movie/top_rated').then(r => ({ title: 'Top Rated', items: r.slice(0, 18) })),
        API.get('/discover/movie', { sort_by: 'release_date.desc', 'vote_count.gte': 50 }).then(r => ({ title: 'New Releases', items: r.slice(0, 18) })),
        ...GENRES.map(g => API.get('/discover/movie', { with_genres: g.id }).then(r => ({ title: g.name, items: r.slice(0, 18) })))
      ]);
      return [trending, topRated, newReleases, ...genres];
    },
  },
  movies: {
    heroFn: () => API.trending('movie'),
    rowsFn: async () => Promise.all([
      API.get('/movie/popular').then(r => ({ title: 'Popular Films', items: r.slice(0, 18) })),
      API.get('/movie/top_rated').then(r => ({ title: 'Critically Acclaimed', items: r.slice(0, 18) })),
      API.get('/movie/upcoming').then(r => ({ title: 'Coming Soon', items: r.slice(0, 18) })),
      ...GENRES.map(g => API.get('/discover/movie', { with_genres: g.id }).then(r => ({ title: g.name, items: r.slice(0, 18) })))
    ]),
  },
  tv: {
    heroFn: () => API.trending('tv'),
    rowsFn: async () => Promise.all([
      API.get('/tv/popular').then(r => ({ title: 'Popular Series', items: r.slice(0, 18) })),
      API.get('/tv/top_rated').then(r => ({ title: 'Critically Acclaimed', items: r.slice(0, 18) })),
      API.trending('tv').then(r => ({ title: 'Trending Series', items: r.slice(0, 18) })),
    ]),
  },
  list: {
    heroFn: () => { const s = Store.getAll(); return s.length ? [s[0]] : []; },
    rowsFn: async () => {
      const items = Store.getAll();
      return items.length ? [{ title: 'Your Saved Titles', items }] : [];
    },
  },
};

const GENRES = [
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 27, name: 'Horror' },
  { id: 18, name: 'Drama' },
  { id: 878, name: 'Sci-Fi' },
];

// State
const State = {
  section: 'home',
  heroMovie: null,
  heroTrailer: null,
};

// Store
const Store = {
  getAll() { try { return JSON.parse(localStorage.getItem(CONFIG.storage) || '[]'); } catch { return []; } },
  has(id) { return this.getAll().some(x => x.id === id); },
  add(item) { const l = this.getAll(); if (!this.has(item.id)) { l.push(item); this._save(l); } },
  remove(id) { this._save(this.getAll().filter(x => x.id !== id)); },
  toggle(item) { this.has(item.id) ? this.remove(item.id) : this.add(item); },
  clear() { this._save([]); },
  count() { return this.getAll().length; },
  _save(list) { localStorage.setItem(CONFIG.storage, JSON.stringify(list)); UI.syncSavedCount(); },
  snapshot(item) {
    return {
      id: item.id,
      title: item.title || item.name || '',
      poster_path: item.poster_path || item.backdrop_path || '',
      backdrop_path: item.backdrop_path || item.poster_path || '',
      vote_average: item.vote_average || 0,
      release_date: item.release_date || item.first_air_date || '',
      overview: item.overview || '',
      media_type: item.media_type || (item.title ? 'movie' : 'tv'),
    };
  },
};

// API
const API = {
  async _fetch(path, params = {}) {
    const url = new URL(CONFIG.base + path);
    url.searchParams.set('api_key', CONFIG.apiKey);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    try {
      const res = await fetch(url);
      if (!res.ok) throw res;
      return res.json();
    } catch (e) {
      console.warn('API error:', path, e);
      return { results: [] };
    }
  },

  async get(path, params = {}) {
    const data = await this._fetch(path, params);
    return data.results || [];
  },

  async trending(type = 'movie') {
    return this.get(`/trending/${type}/week`);
  },

  async details(id, type = 'movie') {
    return this._fetch(`/${type}/${id}`);
  },

  async trailer(id, type = 'movie') {
    const data = await this._fetch(`/${type}/${id}/videos`);
    const found = (data.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    return found ? `https://www.youtube.com/watch?v=${found.key}` : null;
  },

  async search(query) {
    return this.get('/search/multi', { query });
  },
};

// Utilities
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function year(dateStr) {
  return dateStr ? new Date(dateStr).getFullYear() : '';
}

function debounce(fn, ms = 380) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Toast
const Toast = (() => {
  const el = document.getElementById('toast');
  let tid;
  return {
    show(msg) {
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(tid);
      tid = setTimeout(() => el.classList.remove('show'), 1800);
    },
  };
})();

// UI helpers
const UI = {
  syncSavedCount() {
    const n = Store.count();
    const chip = document.getElementById('savedChip');
    if (!chip) return;
    chip.textContent = n;
    chip.hidden = n === 0;

    const stat = document.getElementById('statFavorites');
    if (stat) stat.textContent = n;
  },

  setHeroSaved(saved) {
    const btn = document.getElementById('heroFav');
    if (!btn) return;
    const icon = btn.querySelector('i');
    icon.className = saved ? 'fas fa-bookmark' : 'far fa-bookmark';
  },

  setActiveTab(section) {
    document.querySelectorAll('[data-section]').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });
  },
};

// Hero
const Hero = {
  async set(item) {
    if (!item) return;
    const mt = item.media_type || (item.title ? 'movie' : 'tv');
    State.heroMovie = item;

    document.getElementById('heroBg').style.backgroundImage =
      item.backdrop_path ? `url(${CONFIG.img + item.backdrop_path})` : '';
    document.getElementById('heroTitle').textContent = item.title || item.name || '';
    document.getElementById('heroTagline').textContent = (item.overview || '').slice(0, 200);

    // attrs
    const attrs = [];
    if (item.release_date || item.first_air_date) attrs.push(year(item.release_date || item.first_air_date));
    if (item.vote_average) attrs.push(`★ ${item.vote_average.toFixed(1)}`);
    if (mt === 'tv') attrs.push('Series');
    const attrsEl = document.getElementById('heroAttrs');
    attrsEl.innerHTML = attrs.map((a, i) => `
      ${i > 0 ? '<span class="hero-attr-sep">·</span>' : ''}
      <span class="hero-attr">${esc(String(a))}</span>
    `).join('');

    // score badge
    const scoreEl = document.getElementById('heroScore');
    const scoreVal = document.getElementById('heroScoreVal');
    if (item.vote_average) {
      scoreVal.textContent = item.vote_average.toFixed(1);
      scoreEl.hidden = false;
    } else {
      scoreEl.hidden = true;
    }

    UI.setHeroSaved(Store.has(item.id));

    // trailer
    State.heroTrailer = await API.trailer(item.id, mt);
  },
};

// Card builder
function buildCard(item) {
  const card = document.createElement('article');
  card.className = 'card';

  const poster = item.backdrop_path || item.poster_path;
  const saved = Store.has(item.id);
  const score = item.vote_average ? item.vote_average.toFixed(1) : '–';
  const yr = year(item.release_date || item.first_air_date);

  card.innerHTML = `
    <div class="card-thumb">
      ${poster
      ? `<img class="card-img" src="${CONFIG.img + poster}" alt="${esc(item.title || item.name)}" loading="lazy" />`
      : `<div class="card-no-img">🎬</div>`
    }
      <div class="card-overlay">
        <button class="card-action play" title="Play"><i class="fas fa-play"></i></button>
        <button class="card-action info" title="Details"><i class="fas fa-circle-info"></i></button>
      </div>
    </div>
    <div class="card-meta">
      <div class="card-title">${esc(item.title || item.name)}</div>
      <div class="card-foot">
        <div class="card-attrs">
          <span class="card-score"><i class="fas fa-star"></i>${score}</span>
          ${yr ? `<span class="card-year">${yr}</span>` : ''}
        </div>
        <button class="card-save" title="${saved ? 'Remove' : 'Save'}">
          <i class="${saved ? 'fas' : 'far'} fa-bookmark"></i>
        </button>
      </div>
    </div>`;

  // Events
  card.querySelector('.card-save').addEventListener('click', e => {
    e.stopPropagation();
    Handlers.toggleSave(item, card.querySelector('.card-save i'));
  });

  card.querySelector('.info').addEventListener('click', e => {
    e.stopPropagation();
    Sheet.openDetail(item);
  });

  card.querySelector('.play').addEventListener('click', e => {
    window.location.href = `7movie?id=${item.id}`;
  });
  
  return card;
}

// Shelf builder
function buildShelf(title, items) {
  const shelf = document.createElement('div');
  shelf.className = 'shelf';

  shelf.innerHTML = `
    <div class="shelf-header">
      <h2 class="shelf-title">${esc(title)}</h2>
      <span class="shelf-count">${items.length} titles</span>
    </div>
    <div class="shelf-grid"></div>`;

  const grid = shelf.querySelector('.shelf-grid');
  items.forEach(item => grid.appendChild(buildCard(item)));

  // Stagger entrance
  requestAnimationFrame(() => {
    const cards = grid.querySelectorAll('.card');
    cards.forEach((c, i) => {
      c.style.opacity = '0';
      c.style.transform = 'translateY(16px)';
      c.style.transition = `opacity 0.4s ease ${i * 0.035}s, transform 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.035}s`;
      requestAnimationFrame(() => {
        c.style.opacity = '1';
        c.style.transform = 'translateY(0)';
      });
    });
  });

  return shelf;
}

// Section loader
const Loader = {
  async load(section) {
    const cfg = SECTIONS[section];
    if (!cfg) return;

    State.section = section;
    UI.setActiveTab(section);

    const rowsEl = document.getElementById('rows');
    const noResult = document.getElementById('noResults');
    rowsEl.innerHTML = '';
    noResult.hidden = true;

    // Hero
    const heroItems = await cfg.heroFn();
    const first = Array.isArray(heroItems) ? heroItems[0] : null;
    if (first) {
      await Hero.set(first);
    } else {
      document.getElementById('heroBg').style.backgroundImage = '';
      document.getElementById('heroTitle').textContent = section === 'list' ? 'Your List' : '';
      document.getElementById('heroTagline').textContent = section === 'list' ? 'Save films and series to watch later.' : '';
      document.getElementById('heroAttrs').innerHTML = '';
      document.getElementById('heroScore').hidden = true;
    }

    // Rows
    const rows = await cfg.rowsFn();
    const hasContent = rows.some(r => r.items?.length);

    if (!hasContent) {
      if (section === 'list') noResult.hidden = false;
      return;
    }

    rows.forEach(r => {
      if (r.items?.length) rowsEl.appendChild(buildShelf(r.title, r.items));
    });
  },
};

// Handlers
const Handlers = {
  toggleSave(item, iconEl) {
    const was = Store.has(item.id);
    Store.toggle(Store.snapshot(item));
    const now = Store.has(item.id);
    if (iconEl) iconEl.className = now ? 'fas fa-bookmark' : 'far fa-bookmark';
    Toast.show(now ? 'Saved to your list' : 'Removed from saved');
    if (now && iconEl) {
      iconEl.style.transform = 'scale(0.6)';
      iconEl.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      requestAnimationFrame(() => { iconEl.style.transform = 'scale(1)'; });
    }
    if (State.heroMovie?.id === item.id) UI.setHeroSaved(now);
    if (State.section === 'list') Loader.load('list');
  },
};

// Sheet
const Sheet = {
  async openDetail(item) {
    const veil = document.getElementById('detailVeil');
    const content = document.getElementById('detailContent');
    const mt = item.media_type || (item.title ? 'movie' : 'tv');

    const [details, trailerUrl] = await Promise.all([
      API.details(item.id, mt),
      API.trailer(item.id, mt),
    ]);

    const backdrop = details.backdrop_path || details.poster_path;
    const title = details.title || details.name || '';
    const yr = year(details.release_date || details.first_air_date);
    const runtime = details.runtime || details.episode_run_time?.[0] || '';
    const genres = (details.genres || []).map(g => g.name);
    const saved = Store.has(item.id);

    content.innerHTML = `
      ${backdrop
        ? `<img class="detail-hero-img" src="${CONFIG.img + backdrop}" alt="${esc(title)}" />`
        : `<div class="detail-hero-placeholder">🎬</div>`
      }
      <div class="detail-hero-scrim"></div>
      <div class="detail-body">
        <div class="detail-top">
          <div>
            <h2 class="detail-title">${esc(title)}</h2>
            <div class="detail-attrs">
              ${yr ? `<span><i class="fas fa-calendar"></i> ${yr}</span>` : ''}
              ${runtime ? `<span><i class="fas fa-clock"></i> ${runtime} min</span>` : ''}
              ${details.vote_average ? `<span><i class="fas fa-star" style="color:var(--gold)"></i> ${details.vote_average.toFixed(1)}</span>` : ''}
            </div>
          </div>
          <button class="detail-save ${saved ? 'saved' : ''}" id="detailSaveBtn">
            <i class="${saved ? 'fas' : 'far'} fa-bookmark"></i>
          </button>
        </div>
        ${genres.length ? `
          <div class="detail-genres">
            ${genres.map(g => `<span class="genre-pill">${esc(g)}</span>`).join('')}
          </div>` : ''
      }
        <p class="detail-overview">${esc(details.overview || 'No overview available.')}</p>
        ${trailerUrl ? `<button class="detail-trailer-btn" id="detailTrailerBtn"><i class="fas fa-play"></i> Watch Trailer</button>` : ''}
        <div class="detail-stats">
          ${details.vote_average ? `<div class="detail-stat"><div class="detail-stat-key">Rating</div><div class="detail-stat-val">${details.vote_average.toFixed(1)}</div></div>` : ''}
          ${details.vote_count ? `<div class="detail-stat"><div class="detail-stat-key">Votes</div><div class="detail-stat-val">${(details.vote_count / 1000).toFixed(0)}K</div></div>` : ''}
          ${details.popularity ? `<div class="detail-stat"><div class="detail-stat-key">Popularity</div><div class="detail-stat-val">${Math.round(details.popularity)}</div></div>` : ''}
          ${details.budget > 0 ? `<div class="detail-stat"><div class="detail-stat-key">Budget</div><div class="detail-stat-val">$${(details.budget / 1e6).toFixed(0)}M</div></div>` : ''}
          ${details.revenue > 0 ? `<div class="detail-stat"><div class="detail-stat-key">Revenue</div><div class="detail-stat-val">$${(details.revenue / 1e6).toFixed(0)}M</div></div>` : ''}
        </div>
      </div>`;

    content.querySelector('#detailSaveBtn').addEventListener('click', () => {
      Handlers.toggleSave(details, content.querySelector('#detailSaveBtn i'));
      content.querySelector('#detailSaveBtn').classList.toggle('saved', Store.has(item.id));
    });

    content.querySelector('#detailTrailerBtn')?.addEventListener('click', () => {
      window.open(trailerUrl, '_blank');
    });

    veil.classList.add('open');
  },

  openAccount() {
    UI.syncSavedCount();
    document.getElementById('profileVeil').classList.add('open');
  },

  closeAll() {
    document.querySelectorAll('.veil').forEach(v => v.classList.remove('open'));
  },

  close(id) {
    document.getElementById(id)?.classList.remove('open');
  },
};

// Search
const Search = {
  open() {
    document.getElementById('searchVeil').classList.add('open');
    setTimeout(() => document.getElementById('searchInput')?.focus(), 80);
  },
  close() {
    Sheet.close('searchVeil');
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    this._reset();
  },
  _reset() {
    const el = document.getElementById('searchResults');
    if (el) el.innerHTML = '<p class="palette-empty-hint">Start typing to search…</p>';
    const clear = document.getElementById('searchClear');
    if (clear) clear.hidden = true;
  },
  async _run(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!query.trim()) { this._reset(); return; }

    resultsEl.innerHTML = '<p class="palette-empty-hint">Searching…</p>';

    const items = (await API.search(query)).filter(i => i.poster_path || i.backdrop_path).slice(0, 20);

    if (!items.length) {
      resultsEl.innerHTML = '<p class="palette-empty-hint">No results found.</p>';
      return;
    }

    resultsEl.innerHTML = `<p class="palette-section-label">${items.length} results</p>`;
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'p-result';
      const thumb = item.backdrop_path || item.poster_path;
      const yr = year(item.release_date || item.first_air_date);
      row.innerHTML = `
        <img class="p-result-thumb" src="${CONFIG.img + thumb}" alt="${esc(item.title || item.name)}" loading="lazy" />
        <div class="p-result-info">
          <div class="p-result-title">${esc(item.title || item.name)}</div>
          <div class="p-result-sub">${yr || ''}${yr && item.vote_average ? ' · ' : ''}${item.vote_average ? '★ ' + item.vote_average.toFixed(1) : ''}</div>
        </div>
        <div class="p-result-actions">
          <button class="p-action" title="Details"><i class="fas fa-circle-info"></i></button>
          <button class="p-action save-btn" title="Save"><i class="${Store.has(item.id) ? 'fas' : 'far'} fa-bookmark"></i></button>
        </div>`;

      row.querySelector('.p-action:first-child').addEventListener('click', e => {
        e.stopPropagation();
        this.close();
        Sheet.openDetail(item);
      });
      row.querySelector('.save-btn').addEventListener('click', e => {
        e.stopPropagation();
        Handlers.toggleSave(item, row.querySelector('.save-btn i'));
      });
      row.addEventListener('click', () => {
        this.close();
        Sheet.openDetail(item);
      });

      resultsEl.appendChild(row);
    });
  },
};
Search._debouncedRun = debounce(Search._run.bind(Search), 320);

// Event wiring
function wireEvents() {
  document.querySelectorAll('.sidebar [data-section], .dock [data-section]').forEach(btn => {
    btn.addEventListener('click', () => Loader.load(btn.dataset.section));
  });

  ['homeLink', 'topbarHome'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      e.preventDefault();
      Loader.load('home');
    });
  });

  ['searchBtn', 'searchBtnMob', 'dockSearch'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => Search.open());
  });

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput?.addEventListener('input', e => {
    const val = e.target.value;
    if (searchClear) searchClear.hidden = !val;
    Search._debouncedRun(val);
  });
  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.hidden = true;
    Search._reset();
    searchInput.focus();
  });
  document.getElementById('searchEsc')?.addEventListener('click', () => Search.close());

  ['profileBtn', 'profileBtnMob'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => Sheet.openAccount());
  });

  document.getElementById('detailClose')?.addEventListener('click', () => Sheet.close('detailVeil'));
  document.getElementById('profileClose')?.addEventListener('click', () => Sheet.close('profileVeil'));
  document.getElementById('searchEsc')?.addEventListener('click', () => Search.close());

  document.querySelectorAll('.veil').forEach(veil => {
    veil.addEventListener('click', e => {
      if (e.target === veil) {
        if (veil.id === 'searchVeil') Search.close();
        else Sheet.close(veil.id);
      }
    });
  });

  // Hero buttons
  document.getElementById('heroPlay')?.addEventListener('click', () => {
    State.heroTrailer ? window.open(State.heroTrailer, '_blank') : Toast.show('No trailer available');
  });
  document.getElementById('heroInfo')?.addEventListener('click', () => {
    if (State.heroMovie) Sheet.openDetail(State.heroMovie);
  });
  document.getElementById('heroFav')?.addEventListener('click', () => {
    if (!State.heroMovie) return;
    Handlers.toggleSave(State.heroMovie, document.querySelector('#heroFav i'));
  });

  const confirmVeil = document.getElementById('confirmVeil');
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmOk = document.getElementById('confirmOk');

  document.getElementById('clearListBtn')?.addEventListener('click', () => {
    confirmVeil.classList.add('open');
  });
  confirmCancel?.addEventListener('click', () => {
    confirmVeil.classList.remove('open');
  });
  confirmVeil?.addEventListener('click', e => {
    if (e.target === confirmVeil) confirmVeil.classList.remove('open');
  });
  confirmOk?.addEventListener('click', () => {
    Store.clear();
    Toast.show('List cleared');
    confirmVeil.classList.remove('open');
    Sheet.close('profileVeil');
    if (State.section === 'list') Loader.load('list');
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      Search.open();
    }
    if (e.key === 'Escape') {
      const confirmVeil = document.getElementById('confirmVeil');
      if (confirmVeil?.classList.contains('open')) {
        confirmVeil.classList.remove('open');
        return;
      }
      const open = [...document.querySelectorAll('.veil.open')].pop();
      if (open) {
        if (open.id === 'searchVeil') Search.close();
        else Sheet.close(open.id);
      }
    }
  });
}

// Init
async function init() {
  wireEvents();
  UI.syncSavedCount();
  await Loader.load('home');
}

init();