/* app.js — La Grande Boucle de Tom
 * Statische, mobile-first PWA. Leest data/taalarchief.json,
 * virtualiseert 12k regels, zoekt full-text, filtert, en doet TTS.
 */
'use strict';

(function () {
  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const viewport = $('viewport');
  const spacer = $('spacer');
  const listEl = $('list');
  const qInput = $('q');
  const countEl = $('count');
  const srcSel = $('srcSel');
  const yrFrom = $('yrFrom');
  const yrTo = $('yrTo');
  const yrFromLbl = $('yrFromLbl');
  const yrToLbl = $('yrToLbl');
  const detail = $('detail');
  const detailBody = $('detailBody');

  // ---- State ----
  let ALL = [];
  let META = null;
  let view = [];                 // huidige (gefilterde) lijst
  let jersey = 'all';
  let ROW_H = 132;               // px, herberekend na meten
  const BUFFER = 6;

  const ttsOK = 'speechSynthesis' in window;

  // ---- Data laden ----
  fetch('data/taalarchief.json')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      META = d.meta;
      ALL = d.entries;
      boot();
    })
    .catch((err) => {
      countEl.textContent = 'Kon de data niet laden (' + err.message + ').';
    });

  function boot() {
    buildSourceSelect();
    buildYearSliders();
    buildClassement();
    buildTimeline();
    measureRow();
    bindEvents();
    renderEtape();
    applyFilters();
    registerSW();
  }

  // ---- Filteropbouw ----
  function buildSourceSelect() {
    for (const s of META.sources) {
      const o = document.createElement('option');
      o.value = s.name;
      o.textContent = `${s.name} (${s.count})`;
      srcSel.appendChild(o);
    }
  }

  function buildYearSliders() {
    const yrs = META.years;
    const min = yrs[0], max = yrs[yrs.length - 1];
    for (const el of [yrFrom, yrTo]) { el.min = min; el.max = max; el.step = 1; }
    yrFrom.value = min; yrTo.value = max;
    yrFromLbl.textContent = min; yrToLbl.textContent = max;
  }

  // ---- Zoeken / filteren ----
  function normalize(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  let debounceT;
  function onSearch() {
    clearTimeout(debounceT);
    debounceT = setTimeout(applyFilters, 160);
  }

  function applyFilters() {
    const q = normalize(qInput.value.trim());
    const terms = q ? q.split(/\s+/) : [];
    const src = srcSel.value;
    const yFrom = +yrFrom.value, yTo = +yrTo.value;

    view = ALL.filter((e) => {
      if (jersey === 'tdf' && !e.flags.tdf) return false;
      if (jersey === 'pepite' && !e.flags.pepite) return false;
      if (jersey === 'afk' && !e.flags.afk) return false;
      if (src && e.source !== src) return false;
      if (e.year != null) { if (e.year < yFrom || e.year > yTo) return false; }
      else if (yFrom > META.years[0] || yTo < META.years[META.years.length - 1]) {
        // jaarfilter actief en regel heeft geen jaar -> verberg
        return false;
      }
      if (terms.length) {
        if (!e._h) e._h = normalize(e.fr + ' ' + e.nl + ' ' + e.topic + ' ' + e.raw);
        for (const t of terms) if (!e._h.includes(t)) return false;
      }
      return true;
    });

    countEl.textContent = view.length.toLocaleString('nl-NL') + ' van ' +
      ALL.length.toLocaleString('nl-NL') + ' uitdrukkingen';
    layout();
  }

  function resetFilters() {
    qInput.value = '';
    srcSel.value = '';
    buildYearSliders();
    setJersey('all');
  }

  // ---- Truien (quickfilters) ----
  function setJersey(j) {
    jersey = j;
    document.querySelectorAll('.gb-jersey').forEach((b) => {
      const on = b.dataset.jersey === j;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    applyFilters();
  }

  // ---- Virtualisatie (windowing, vaste rijhoogte) ----
  function measureRow() {
    // render een proefkaart om de hoogte te bepalen
    const probe = cardEl(ALL[0]);
    probe.style.visibility = 'hidden';
    listEl.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    if (h > 40) ROW_H = Math.ceil(h) + 8;   // + margin-bottom uit de CSS
    listEl.removeChild(probe);
  }

  function layout() {
    spacer.style.height = (view.length * ROW_H) + 'px';
    viewport.scrollTop = 0;
    lastStart = lastEnd = -1;   // forceer her-render want de dataset is gewijzigd
    render();
  }

  let lastStart = -1, lastEnd = -1;
  function render() {
    const scrollTop = viewport.scrollTop;
    const vh = viewport.clientHeight || 600;
    let start = Math.floor(scrollTop / ROW_H) - BUFFER;
    let end = Math.ceil((scrollTop + vh) / ROW_H) + BUFFER;
    start = Math.max(0, start);
    end = Math.min(view.length, end);
    if (start === lastStart && end === lastEnd) return;
    lastStart = start; lastEnd = end;

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const el = cardEl(view[i]);
      el.style.position = 'absolute';
      el.style.top = (i * ROW_H) + 'px';
      el.style.left = '0';
      el.style.right = '0';
      frag.appendChild(el);
    }
    listEl.innerHTML = '';
    listEl.appendChild(frag);

    if (view.length === 0) {
      listEl.innerHTML = '<div class="gb-empty">Geen resultaten — pas je zoekopdracht of filters aan.</div>';
    }
  }

  // ---- Kaart ----
  function chip(cls, txt) {
    const s = document.createElement('span');
    s.className = 'gb-chip ' + cls;
    s.textContent = txt;
    return s;
  }

  function cardEl(e) {
    const card = document.createElement('article');
    card.className = 'gb-card';
    card.setAttribute('role', 'listitem');

    const fr = document.createElement('div');
    fr.className = 'gb-fr';
    fr.append(document.createTextNode(e.fr));
    if (ttsOK && e.fr) {
      const sp = document.createElement('button');
      sp.className = 'gb-tts';
      sp.type = 'button';
      sp.setAttribute('aria-label', 'Spreek Frans uit');
      sp.textContent = '🔊';
      sp.addEventListener('click', (ev) => { ev.stopPropagation(); speak(e.fr); });
      fr.appendChild(sp);
    }

    const nl = document.createElement('div');
    nl.className = 'gb-nl';
    nl.textContent = e.nl;

    const badges = document.createElement('div');
    badges.className = 'gb-badges';
    if (e.source) badges.appendChild(chip('gb-chip--source', e.source));
    if (e.year) badges.appendChild(chip('gb-chip--year', e.year));
    if (e.topic) badges.appendChild(chip('gb-chip--topic', 'm.b.t. ' + e.topic));
    if (e.flags.pepite) badges.appendChild(chip('gb-chip--pepite', '★ pépite'));
    if (e.flags.afk) badges.appendChild(chip('gb-chip--afk', 'afko'));

    const orig = document.createElement('button');
    orig.className = 'gb-origbtn';
    orig.type = 'button';
    orig.textContent = 'toon origineel';
    orig.addEventListener('click', (ev) => { ev.stopPropagation(); openDetail(e); });
    badges.appendChild(orig);

    card.append(fr, nl, badges);
    card.addEventListener('click', () => openDetail(e));
    return card;
  }

  // ---- Detail-dialog (toont raw = origineel) ----
  function openDetail(e) {
    detailBody.innerHTML = '';
    const fr = document.createElement('p');
    fr.className = 'gb-detail__fr';
    fr.textContent = e.fr;
    if (ttsOK && e.fr) {
      const sp = document.createElement('button');
      sp.className = 'gb-tts';
      sp.type = 'button'; sp.textContent = '🔊';
      sp.setAttribute('aria-label', 'Spreek Frans uit');
      sp.addEventListener('click', () => speak(e.fr));
      fr.appendChild(sp);
    }
    const nl = document.createElement('p');
    nl.className = 'gb-detail__nl';
    nl.textContent = e.nl;

    const badges = document.createElement('div');
    badges.className = 'gb-badges';
    if (e.source) badges.appendChild(chip('gb-chip--source', e.source));
    if (e.year) badges.appendChild(chip('gb-chip--year', e.year));
    if (e.topic) badges.appendChild(chip('gb-chip--topic', 'm.b.t. ' + e.topic));
    if (e.flags.pepite) badges.appendChild(chip('gb-chip--pepite', '★ pépite'));
    if (e.flags.afk) badges.appendChild(chip('gb-chip--afk', 'afko'));
    if (e.flags.tdf) badges.appendChild(chip('gb-chip--topic', '🚴 Tour'));
    if (e.flags.domein) badges.appendChild(chip('gb-chip--topic', e.flags.domein + '.'));

    const rawH = document.createElement('div');
    rawH.className = 'gb-rawlabel';
    rawH.textContent = 'Origineel (ongewijzigd):';
    const raw = document.createElement('pre');
    raw.className = 'gb-raw';
    raw.textContent = e.raw;

    detailBody.append(fr, nl, badges, rawH, raw);
    if (typeof detail.showModal === 'function') detail.showModal();
    else detail.setAttribute('open', '');
  }

  // ---- TTS ----
  function speak(text) {
    if (!ttsOK) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }

  // ---- Étape du jour (deterministisch per dag) ----
  function dayHash() {
    const d = new Date();
    const key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    // eenvoudige, stabiele hash
    let h = key % 2147483647;
    h = (h * 48271) % 2147483647;
    return h;
  }

  function renderEtape() {
    const pool = ALL.filter((e) => e.flags.pepite) ;
    const src = pool.length > 30 ? pool : ALL;
    const e = src[dayHash() % src.length];
    const wrap = $('etapeWrap');
    wrap.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'gb-etape';
    const h = document.createElement('div');
    h.className = 'gb-etape__head';
    h.textContent = '🚩 Étape du jour';
    const fr = document.createElement('div');
    fr.className = 'gb-fr';
    fr.append(document.createTextNode(e.fr));
    if (ttsOK && e.fr) {
      const sp = document.createElement('button');
      sp.className = 'gb-tts'; sp.type = 'button'; sp.textContent = '🔊';
      sp.setAttribute('aria-label', 'Spreek Frans uit');
      sp.addEventListener('click', (ev) => { ev.stopPropagation(); speak(e.fr); });
      fr.appendChild(sp);
    }
    const nl = document.createElement('div');
    nl.className = 'gb-nl';
    nl.textContent = e.nl;
    box.append(h, fr, nl);
    box.addEventListener('click', () => openDetail(e));
    wrap.appendChild(box);
  }

  // ---- Classement (ranglijst bronnen) ----
  function buildClassement() {
    const wrap = $('classement');
    const max = META.sources[0] ? META.sources[0].count : 1;
    META.sources.forEach((s, i) => {
      const row = document.createElement('button');
      row.className = 'gb-classement__row' + (i === 0 ? ' gb-classement__row--leader' : '');
      row.type = 'button';
      const rank = document.createElement('span');
      rank.className = 'gb-classement__rank';
      rank.textContent = (i + 1);
      const name = document.createElement('span');
      name.className = 'gb-classement__name';
      name.textContent = s.name;
      const bar = document.createElement('span');
      bar.className = 'gb-classement__bar';
      bar.style.width = Math.max(4, (s.count / max) * 100) + '%';
      const cnt = document.createElement('span');
      cnt.className = 'gb-classement__count';
      cnt.textContent = s.count.toLocaleString('nl-NL');
      row.append(rank, name, bar, cnt);
      row.addEventListener('click', () => {
        srcSel.value = s.name;
        setJersey('all');
        switchView('peloton');
      });
      wrap.appendChild(row);
    });
  }

  // ---- Timeline ----
  function buildTimeline() {
    const wrap = $('timeline');
    const byYear = {};
    for (const e of ALL) if (e.year) byYear[e.year] = (byYear[e.year] || 0) + 1;
    const max = Math.max(...Object.values(byYear));
    for (const y of META.years) {
      const c = byYear[y] || 0;
      const col = document.createElement('button');
      col.className = 'gb-timeline__col';
      col.type = 'button';
      col.title = y + ': ' + c;
      const bar = document.createElement('span');
      bar.className = 'gb-timeline__bar';
      bar.style.height = Math.max(3, (c / max) * 100) + '%';
      const lbl = document.createElement('span');
      lbl.className = 'gb-timeline__lbl';
      lbl.textContent = "'" + String(y).slice(2);
      col.append(bar, lbl);
      col.addEventListener('click', () => {
        yrFrom.value = y; yrTo.value = y;
        yrFromLbl.textContent = y; yrToLbl.textContent = y;
        setJersey('all');
        switchView('peloton');
      });
      wrap.appendChild(col);
    }
  }

  // ---- Tabs / views ----
  function switchView(name) {
    document.querySelectorAll('.gb-view').forEach((v) =>
      v.classList.toggle('is-active', v.id === 'view-' + name));
    document.querySelectorAll('.gb-tab').forEach((t) =>
      t.classList.toggle('is-active', t.dataset.view === name));
    window.scrollTo(0, 0);
  }

  // ---- Events ----
  function bindEvents() {
    qInput.addEventListener('input', onSearch);
    srcSel.addEventListener('change', applyFilters);
    yrFrom.addEventListener('input', () => {
      if (+yrFrom.value > +yrTo.value) yrTo.value = yrFrom.value;
      yrFromLbl.textContent = yrFrom.value; yrToLbl.textContent = yrTo.value;
      applyFilters();
    });
    yrTo.addEventListener('input', () => {
      if (+yrTo.value < +yrFrom.value) yrFrom.value = yrTo.value;
      yrFromLbl.textContent = yrFrom.value; yrToLbl.textContent = yrTo.value;
      applyFilters();
    });
    $('resetFilters').addEventListener('click', resetFilters);
    document.querySelectorAll('.gb-jersey').forEach((b) =>
      b.addEventListener('click', () => setJersey(b.dataset.jersey)));
    document.querySelectorAll('.gb-tab').forEach((t) =>
      t.addEventListener('click', () => switchView(t.dataset.view)));
    viewport.addEventListener('scroll', render, { passive: true });
    window.addEventListener('resize', () => { lastStart = -1; render(); });
    detail.addEventListener('click', (e) => { if (e.target === detail) detail.close(); });
  }

  // ---- Service worker ----
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () =>
        navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }
})();
