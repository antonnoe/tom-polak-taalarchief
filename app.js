/* app.js — La Grande Boucle de Tom
 * Statische, mobile-first PWA. Leest data/taalarchief.json, virtualiseert 12k
 * regels, zoekt full-text, filtert, en doet TTS. De DOM die hier wordt
 * gegenereerd volgt exact het class-contract van de Claude Design-handoff.
 */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const viewport = $('viewport');
  const spacer = $('spacer');
  const listEl = $('list');
  const qInput = $('q');
  const qClear = $('qClear');
  const countEl = $('count');
  const srcSel = $('srcSel');
  const yrFrom = $('yrFrom');
  const yrTo = $('yrTo');
  const yrFromLbl = $('yrFromLbl');
  const yrToLbl = $('yrToLbl');

  let ALL = [];
  let META = null;
  let view = [];
  let jersey = 'all';
  let ROW_H = 150;            // geschatte uniforme rijhoogte; na 1e render verfijnd
  let rowMeasured = false;
  const BUFFER = 6;
  const expanded = new Set(); // ids waarvan het origineel (.gb-raw) open staat

  const ttsOK = 'speechSynthesis' in window;

  // Inline luidspreker-SVG (exact uit de styleguide)
  const SPEAKER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linejoin="round"></path>' +
    '<path d="M16.5 8.5a5 5 0 0 1 0 7" stroke-linecap="round"></path></svg>';
  // Chevron voor .gb-toggle (exact uit de styleguide)
  const CHEV_SVG =
    '<svg class="gb-toggle__chev" viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="2.4" aria-hidden="true">' +
    '<path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

  // ---- Data laden ----
  fetch('data/taalarchief.json')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { META = d.meta; ALL = d.entries; boot(); })
    .catch((err) => { countEl.textContent = 'Kon de data niet laden (' + err.message + ').'; });

  function boot() {
    buildSourceSelect();
    buildYearSliders();
    setJerseyCounts();
    buildClassement();
    buildTimeline();
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

  function setJerseyCounts() {
    let tdf = 0, pep = 0, afk = 0;
    for (const e of ALL) {
      if (e.flags.tdf) tdf++;
      if (e.flags.pepite) pep++;
      if (e.flags.afk) afk++;
    }
    const fmt = (n) => n.toLocaleString('nl-NL');
    $('cnt-all').textContent = fmt(ALL.length);
    $('cnt-tdf').textContent = fmt(tdf);
    $('cnt-pepite').textContent = fmt(pep);
    $('cnt-afk').textContent = fmt(afk);
  }

  // ---- Zoeken / filteren ----
  function normalize(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  let debounceT;
  function onSearch() {
    qClear.hidden = !qInput.value;
    clearTimeout(debounceT);
    debounceT = setTimeout(applyFilters, 160);
  }

  function applyFilters() {
    const q = normalize(qInput.value.trim());
    const terms = q ? q.split(/\s+/) : [];
    const src = srcSel.value;
    const yFrom = +yrFrom.value, yTo = +yrTo.value;
    const yMin = META.years[0], yMax = META.years[META.years.length - 1];
    const yearActive = yFrom > yMin || yTo < yMax;

    view = ALL.filter((e) => {
      if (jersey === 'tdf' && !e.flags.tdf) return false;
      if (jersey === 'pepite' && !e.flags.pepite) return false;
      if (jersey === 'afk' && !e.flags.afk) return false;
      if (src && e.source !== src) return false;
      if (e.year != null) { if (e.year < yFrom || e.year > yTo) return false; }
      else if (yearActive) return false;
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
    qInput.value = ''; qClear.hidden = true;
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

  // ---- Virtualisatie (windowing met translateY; tolereert variabele hoogte) ----
  function layout() {
    expanded.clear();
    spacer.style.height = (view.length * ROW_H) + 'px';
    viewport.scrollTop = 0;
    render(true);
    if (!rowMeasured) measureFromRender();
  }

  function measureFromRender() {
    const kids = listEl.children;
    if (kids.length < 3) return;
    let sum = 0, n = 0;
    for (const k of kids) { sum += k.getBoundingClientRect().height; n++; }
    const avg = sum / n + 12; // + margin-top tussen kaarten (design: --gb-3)
    if (avg > 40 && Math.abs(avg - ROW_H) > 4) {
      ROW_H = Math.round(avg);
      spacer.style.height = (view.length * ROW_H) + 'px';
      render(true);
    }
    rowMeasured = true;
  }

  let lastStart = -1, lastEnd = -1;
  function render(force) {
    const st = viewport.scrollTop;
    const vh = viewport.clientHeight || 600;
    let start = Math.floor(st / ROW_H) - BUFFER;
    let count = Math.ceil(vh / ROW_H) + BUFFER * 2;
    start = Math.max(0, start);
    let end = Math.min(view.length, start + count);
    if (!force && start === lastStart && end === lastEnd) return;
    lastStart = start; lastEnd = end;

    listEl.style.transform = 'translateY(' + (start * ROW_H) + 'px)';
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) frag.appendChild(cardEl(view[i]));
    listEl.replaceChildren(frag);

    if (view.length === 0) {
      listEl.style.transform = 'none';
      const empty = document.createElement('div');
      empty.className = 'gb-empty';
      empty.textContent = 'Geen resultaten — pas je zoekopdracht of filters aan.';
      listEl.replaceChildren(empty);
    }
  }

  // ---- Chips / badges ----
  function chip(cls, txt) {
    const s = document.createElement('span');
    s.className = 'gb-chip ' + cls;
    s.textContent = txt;
    return s;
  }
  function badgesFor(e, extra) {
    const b = document.createElement('div');
    b.className = 'gb-badges';
    if (e.flags.pepite) b.appendChild(chip('gb-chip--pepite', 'Pépite'));
    if (e.topic) b.appendChild(chip('gb-chip--topic', e.topic));
    if (e.year) b.appendChild(chip('gb-chip--year', e.year));
    if (e.source) b.appendChild(chip('gb-chip--source', e.source));
    if (e.flags.afk) b.appendChild(chip('gb-chip--afk', 'Afk.'));
    if (e.flags.domein) b.appendChild(chip('gb-chip--afk', e.flags.domein + '.'));
    if (extra && e.flags.tdf) b.appendChild(chip('gb-chip--topic', 'Tour'));
    return b;
  }

  // ---- Kaart ----
  function cardEl(e) {
    const card = document.createElement('article');
    card.className = 'gb-card';
    card.setAttribute('role', 'listitem');

    const row = document.createElement('div');
    row.className = 'gb-card__row';
    const txt = document.createElement('div');
    const fr = document.createElement('div');
    fr.className = 'gb-fr';
    fr.textContent = e.fr;
    const nl = document.createElement('div');
    nl.className = 'gb-nl';
    nl.textContent = e.nl;
    txt.append(fr, nl);
    row.appendChild(txt);
    const tts = ttsButton(e.fr);
    if (tts) row.appendChild(tts);
    card.appendChild(row);

    card.appendChild(badgesFor(e, false));

    // "toon origineel" -> toont .gb-raw inline (helper .gb-toggle)
    const isOpen = expanded.has(e.id);
    const rawId = 'raw-' + e.id;
    const toggle = document.createElement('button');
    toggle.className = 'gb-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggle.setAttribute('aria-controls', rawId);
    toggle.innerHTML = 'Toon origineel ' + CHEV_SVG;

    const raw = document.createElement('div');
    raw.className = 'gb-raw';
    raw.id = rawId;
    raw.textContent = e.raw;
    raw.hidden = !isOpen;

    toggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const open = raw.hidden;
      raw.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) expanded.add(e.id); else expanded.delete(e.id);
    });

    card.append(toggle, raw);
    return card;
  }

  // ---- TTS ----
  function ttsButton(text) {
    if (!ttsOK || !text) return null;
    const btn = document.createElement('button');
    btn.className = 'gb-tts';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Spreek Frans uit');
    btn.innerHTML = SPEAKER_SVG;
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); speak(text, btn); });
    return btn;
  }
  function clearPlaying() {
    document.querySelectorAll('.gb-tts.is-playing').forEach((b) => b.classList.remove('is-playing'));
  }
  function speak(text, btn) {
    if (!ttsOK) return;
    speechSynthesis.cancel();
    clearPlaying();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 0.95;
    if (btn) {
      u.onstart = () => btn.classList.add('is-playing');
      u.onend = () => btn.classList.remove('is-playing');
      u.onerror = () => btn.classList.remove('is-playing');
    }
    speechSynthesis.speak(u);
  }

  // ---- Étape du jour (deterministisch per dag) ----
  function dayHash() {
    const d = new Date();
    const key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    let h = key % 2147483647;
    h = (h * 48271) % 2147483647;
    return h;
  }
  function renderEtape() {
    const pool = ALL.filter((e) => e.flags.pepite);
    const src = pool.length > 30 ? pool : ALL;
    const e = src[dayHash() % src.length];

    const box = document.createElement('article');
    box.className = 'gb-etape';

    const head = document.createElement('div');
    head.className = 'gb-etape__head';
    const flag = document.createElement('span');
    flag.className = 'gb-etape__flag';
    flag.textContent = 'Étape du jour';
    const km = document.createElement('span');
    km.className = 'gb-etape__km';
    km.textContent = (e.source || '—') + (e.year ? ' · ' + e.year : '');
    head.append(flag, km);

    const body = document.createElement('div');
    body.className = 'gb-etape__body';
    const row = document.createElement('div');
    row.className = 'gb-card__row';
    const txt = document.createElement('div');
    const fr = document.createElement('div');
    fr.className = 'gb-fr';
    fr.textContent = e.fr;
    const nl = document.createElement('div');
    nl.className = 'gb-nl';
    nl.textContent = e.nl;
    txt.append(fr, nl);
    row.appendChild(txt);
    const tts = ttsButton(e.fr);
    if (tts) row.appendChild(tts);
    body.appendChild(row);
    body.appendChild(badgesFor(e, true));

    box.append(head, body);
    $('etapeWrap').replaceChildren(box);
  }

  // ---- Classement (ranglijst bronnen) ----
  function buildClassement() {
    const wrap = $('classement');
    META.sources.forEach((s, i) => {
      const row = document.createElement('button');
      row.className = 'gb-classement__row' + (i === 0 ? ' gb-classement__row--leader' : '');
      row.type = 'button';
      const pos = document.createElement('span');
      pos.className = 'gb-classement__pos';
      pos.textContent = (i + 1);
      const name = document.createElement('span');
      name.className = 'gb-classement__name';
      name.textContent = s.name;
      const score = document.createElement('span');
      score.className = 'gb-classement__score';
      score.textContent = s.count.toLocaleString('nl-NL');
      row.append(pos, name, score);
      row.addEventListener('click', () => {
        srcSel.value = s.name;
        setJersey('all');
        switchView('peloton');
      });
      wrap.appendChild(row);
    });
  }

  // ---- Tijdlijn (route met km-markeringen) ----
  function buildTimeline() {
    const wrap = $('timeline');
    const byYear = {};
    for (const e of ALL) if (e.year) byYear[e.year] = (byYear[e.year] || 0) + 1;
    for (const y of META.years) {
      const c = byYear[y] || 0;
      const tick = document.createElement('button');
      tick.className = 'gb-timeline__tick';
      tick.type = 'button';
      tick.title = y + ': ' + c + ' uitdrukkingen';
      const dot = document.createElement('span');
      dot.className = 'gb-timeline__dot';
      const lbl = document.createElement('span');
      lbl.className = 'gb-timeline__year';
      lbl.textContent = y;
      tick.append(dot, lbl);
      tick.addEventListener('click', () => {
        document.querySelectorAll('.gb-timeline__tick.is-active')
          .forEach((t) => t.classList.remove('is-active'));
        tick.classList.add('is-active');
        yrFrom.value = y; yrTo.value = y;
        yrFromLbl.textContent = y; yrToLbl.textContent = y;
        setJersey('all');
        switchView('peloton');
      });
      wrap.appendChild(tick);
    }
  }

  // ---- Tabs / views ----
  function switchView(name) {
    document.querySelectorAll('.gb-view').forEach((v) =>
      v.classList.toggle('is-active', v.id === 'view-' + name));
    document.querySelectorAll('.gb-tab').forEach((t) => {
      const on = t.dataset.view === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (name === 'peloton') { lastStart = -1; render(true); }
  }

  // ---- Events ----
  function bindEvents() {
    qInput.addEventListener('input', onSearch);
    qClear.addEventListener('click', () => { qInput.value = ''; qClear.hidden = true; applyFilters(); qInput.focus(); });
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
    viewport.addEventListener('scroll', () => render(false), { passive: true });
    window.addEventListener('resize', () => { lastStart = -1; render(true); });
  }

  // ---- Service worker ----
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }
})();
