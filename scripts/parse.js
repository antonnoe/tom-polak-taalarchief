#!/usr/bin/env node
/*
 * parse.js — data-archeologie voor "La Grande Boucle de Tom"
 * -----------------------------------------------------------
 * Leest de bron (archive/source/woordenlijst_V2.html, 12.227 regels) en
 * produceert data/taalarchief.json + data/dekkingsrapport.md.
 *
 * Reproduceerbaar:  node scripts/parse.js
 *
 * Uitgangspunten (geverifieerd, niet aangenomen):
 *  - Regels staan als <tr><td>NL?</td><td>FR?</td></tr>. De kop zegt
 *    "Nederlands | Frans", maar de volgorde is per regel NIET consistent:
 *    ~24% van de regels staat Frans-eerst (vooral de "(cp. >"-regels).
 *    Daarom bepalen we per regel welke kolom Frans is.
 *  - raw bewaart ALTIJD de originele regel ongewijzigd (alleen HTML-entiteiten
 *    ontleed). Typefouten blijven staan — dat is het portret.
 *  - year-bereik in de bron is 2002 + 2004..2025 (niet 2004-2020 zoals
 *    oorspronkelijk aangenomen). Zie dekkingsrapport.
 */

'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 0. Bron inlezen
// ---------------------------------------------------------------------------
const CANDIDATES = [
  path.join(__dirname, '..', 'archive', 'source', 'woordenlijst_V2.html'),
  path.join(__dirname, '..', 'woordenlijst_V2.html'),
];
const SRC = CANDIDATES.find(p => fs.existsSync(p));
if (!SRC) {
  console.error('Bron niet gevonden. Verwacht op:', CANDIDATES.join(' of '));
  process.exit(1);
}
const txt = fs.readFileSync(SRC, 'utf8');

// ---------------------------------------------------------------------------
// 1. Helpers
// ---------------------------------------------------------------------------
function unescapeHtml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// Alle aanhalingsteken-varianten die als jaar/datum-apostrof kunnen dienen.
const QUOTE = "['’‘`´]";

// Datum-/jaartag: (dd-mm-'jj)  of  (mm-'jj)  of  ('jj)  binnen haakjes.
const DATE_RE = new RegExp(
  `\\((?:[^()]*?\\s)?(\\d{1,2}-\\d{1,2}-${QUOTE}(\\d{2})|\\d{1,2}-${QUOTE}(\\d{2})|${QUOTE}(\\d{2}))\\)`,
  'g'
);

// Bron-tag: (BRON ... date). De brontekst staat vóór de datum binnen de haakjes.
const SOURCE_RE = new RegExp(
  `\\(\\s*([^()\\d][^()]*?)\\s+\\d{1,2}-\\d{1,2}-${QUOTE}\\d{2}\\s*\\)|` +
  `\\(\\s*([^()\\d][^()]*?)\\s+\\d{1,2}-${QUOTE}\\d{2}\\s*\\)`,
  'g'
);

// Onderwerp: (m.b.t. ...). Pak de inhoud tot de sluithaak (geen geneste haken).
const TOPIC_RE = /\(m\.b\.t\.?\s*([^()]*?)\)/i;

// JT-bronnotitie.
const JT_RE = /extrait\s+du\s+JT/i;
// De voetnoot zelf, zodat we 'm uit de tekst kunnen halen.
const JT_NOTE_RE = /\(\s*\*?\s*extrait\s+du\s+JT\s*\)/gi;

// Domein-vaklabels.
const DOMAIN_RE = /\((jur|med|fin|techn|écon|econ|pol|inform|mil|sport|biol|chim|géol|geol|astr|gram)\.?\)/i;

// Tour-de-France / wielertermen.
const TDF_TERMS = [
  'tour de france', 'étape', 'etape', 'maillot', 'peloton', 'coureur',
  'coureurs', 'vélo', 'velo', 'contre-la-montre', 'contre la montre',
  'cyclisme', 'cycliste', 'grande boucle', 'col du', 'col de',
  'maillot jaune', 'maillot à pois', 'maillot vert',
];
// "col" alleen als losstaand wielerwoord met richtingaanduiding, om
// vals-positieven (col=kraag/hals) te vermijden; "le col du/de la" telt.
const TDF_RE = new RegExp(
  '\\b(' + TDF_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i'
);

// Bron-normalisatiekaart (code → volledige naam).
const SOURCE_MAP = {
  'RTL': 'RTL', 'RTl': 'RTL',
  'F2': 'France 2', 'F3': 'France 3', 'F5': 'France 5',
  'M6': 'M6', 'TF 1': 'TF1', 'TF1': 'TF1',
  'info': 'Info', 'Info': 'Info',  // terugkerende code (76×), veel in juli (Tour)
  'AJ': "Aujourd'hui en France",
  'JDD': 'Journal du Dimanche',
  'TV5': 'TV5 Monde', 'TV 5': 'TV5 Monde', 'TV 5 tt': 'TV5 Monde',
  'Figaro': 'Le Figaro', 'Figaro emploi': 'Le Figaro', 'le Figaro': 'Le Figaro',
  'Libération': 'Libération', 'Libé': 'Libération',
  'Métro': 'Métro', 'Metro': 'Métro',
  'Le Parisien': 'Le Parisien', 'Parisien': 'Le Parisien',
  'Equipe': "L'Équipe", "l'Equipe": "L'Équipe", "L'Equipe": "L'Équipe", 'Léquipe': "L'Équipe",
  'France-Soir': 'France-Soir', 'France Soir': 'France-Soir',
  'LCI': 'LCI', 'BFM': 'BFM TV', 'Arte': 'Arte', 'Inter': 'France Inter',
  'Eurosport': 'Eurosport', 'Canal +': 'Canal+', 'Canal+': 'Canal+',
  'itélé': 'i>Télé', 'I télé': 'i>Télé', 'i télé': 'i>Télé', 'I-télé': 'i>Télé',
  'Sud Ouest': 'Sud Ouest', 'Sud-Ouest': 'Sud Ouest',
  'Ouest France': 'Ouest-France', 'Ouest-France': 'Ouest-France',
  'La Provence': 'La Provence', 'la Provence': 'La Provence',
  'Nouvelle République': 'La Nouvelle République', 'Dauphiné Libéré': 'Le Dauphiné Libéré',
  'Républicain Lorrain': 'Le Républicain Lorrain', 'la Voix du Nord': 'La Voix du Nord',
  'Directmatin': 'Direct Matin', 'directmatin': 'Direct Matin', 'DirectSoir': 'Direct Soir',
  'France bleue': 'France Bleu', 'France Bleu': 'France Bleu',
};

// Acroniem-detectie: losse hoofdletter-token (2+) in FR, evt. met punten.
const ACRONYM_RE = /\b([A-ZÉÈÀ]{2,}(?:\.[A-ZÉÈÀ]+)*|(?:[A-ZÉÈÀ]\.){2,})\b/g;
// Tokens die GEEN vocabulaire-afkorting zijn (broncodes, romeinse cijfers e.d.).
const NOT_ACRONYM = new Set([
  'RTL', 'F2', 'F3', 'F5', 'F1', 'M6', 'TV5', 'TV', 'AJ', 'JDD', 'LCI', 'BFM',
  'JT', 'TF', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'OK', 'NL', 'FR', 'EO', 'OPA', 'CD', 'DVD', // CD/DVD/OPA twijfelachtig maar laat ze
]);

// ---------------------------------------------------------------------------
// 2. Taaldetectie (welke kolom is Frans?)
// ---------------------------------------------------------------------------
const FR_ACC = new Set('éèêëàâäôöîïûüùçœæÉÈÊÀÂÔÎÏÛÜÙÇ'.split(''));
const FR_WORDS = new Set(('le la les un une des du de au aux et ou est sont dans pour ' +
  'avec sur ne pas plus ce cet cette il elle on qui que vous nous se son sa ses leur ' +
  'leurs ont a à où être avoir fait très entre chez sans après avant deux trois quatre ' +
  'ils elles je tu me te lui en y dont quand comme mais donc car ni car').split(/\s+/));
const NL_WORDS = new Set(('het de een van met voor zijn dat die deze er niet meer naar ' +
  'bij om te worden wordt heeft hebben geen veel ook nog maar als over tegen door zo ' +
  'wij hij zij ik je jij we men aan uit op onder tussen wel was waren zou zal kan moet ' +
  'hier dit deze hun jullie ').split(/\s+/));

function frenchness(cell) {
  const s = cell.toLowerCase();
  const words = s.match(/[a-zà-ÿ'’]+/g) || [];
  let fr = 0, nl = 0;
  for (const w of words) {
    if (FR_WORDS.has(w)) fr++;
    if (NL_WORDS.has(w)) nl++;
  }
  for (const c of cell) if (FR_ACC.has(c)) fr++;
  fr += (s.match(/\b[lcdjnmstq]['’]/g) || []).length;       // elisies l' d' qu'…
  if (DATE_RE.test(cell)) fr += 6;                            // bron-/datumtag ⇒ FR
  DATE_RE.lastIndex = 0;
  nl += 2 * (s.match(/m\.b\.t\./g) || []).length;
  nl += 2 * (s.match(/\(hier\)/g) || []).length;
  nl += 2 * (s.match(/nl vertaling/g) || []).length;
  nl += (s.match(/ij/g) || []).length;                       // ij-digraaf
  return fr - nl;
}

// ---------------------------------------------------------------------------
// 3. Per regel parsen
// ---------------------------------------------------------------------------
const ROW_RE = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
const entries = [];
const unknownCodes = {};            // code → count
let swappedCount = 0, noLangCount = 0;

function extractSource(cell) {
  SOURCE_RE.lastIndex = 0;
  let m, best = null;
  while ((m = SOURCE_RE.exec(cell)) !== null) {
    const tok = (m[1] || m[2] || '').trim();
    if (tok) best = tok;            // laatste tag in de cel wint (zeldzaam meer dan 1)
  }
  return best;
}

function normalizeSource(code) {
  if (!code) return { source: '', code: null };
  // Soms zit er ruis vóór de code (bv. lange parenthetische zin). Pak de
  // betekenisvolle staart: laatste 1-3 woorden die op een bekende bron lijken.
  const cleaned = code.replace(/\s+/g, ' ').trim();
  if (SOURCE_MAP[cleaned]) return { source: SOURCE_MAP[cleaned], code: cleaned };
  // probeer losse tokens
  const parts = cleaned.split(' ');
  const tail = parts.slice(-1)[0];
  if (SOURCE_MAP[tail]) return { source: SOURCE_MAP[tail], code: tail };
  // "schoon" ogende eigennaam (begint met hoofdletter, redelijke lengte,
  // geen zin) ⇒ accepteer als bron maar markeer niet als bekende code.
  if (/^[A-ZÉÈÀ][\p{L}'’.\- ]{1,24}$/u.test(cleaned) && parts.length <= 3 &&
      !/\b(le|la|les|de|des|du|à|au)\b/i.test(cleaned) === false ? false : false) {
    // (bewust niet: te veel vals-positieven)
  }
  if (/^[A-ZÉÈÀ][\p{L}'’.\-]{1,18}$/u.test(cleaned) && parts.length === 1) {
    return { source: cleaned, code: cleaned, known: false };
  }
  return { source: '', code: cleaned, unknown: true };
}

function extractYear(cell) {
  DATE_RE.lastIndex = 0;
  let m, yy = null;
  while ((m = DATE_RE.exec(cell)) !== null) {
    yy = m[2] || m[3] || m[4];
  }
  if (yy == null) return null;
  const n = parseInt(yy, 10);
  return n <= 30 ? 2000 + n : 1900 + n;   // '02..'25 ⇒ 2002..2025
}

function stripMeta(cell, sourceCode) {
  let s = cell;
  s = s.replace(JT_NOTE_RE, '');                 // (* extrait du JT)
  s = s.replace(DATE_RE, '');                     // (BRON dd-mm-'jj) / ('jj)
  DATE_RE.lastIndex = 0;
  return s.replace(/\s{2,}/g, ' ').trim();
}

function detectPepite(rawCell) {
  // Verwijder eerst de JT-voetnoot, dan kijken of er nog een '*' náást een
  // woord staat (de inline pépite-markering).
  const s = rawCell.replace(JT_NOTE_RE, '');
  // ster grenzend aan een woord(teken): *woord, woord*, (* woord
  return /\*\s*\p{L}|\p{L}\s*\*/u.test(s);
}

function detectAcronyms(frText) {
  const found = [];
  let m;
  ACRONYM_RE.lastIndex = 0;
  while ((m = ACRONYM_RE.exec(frText)) !== null) {
    const tok = m[1];
    const bare = tok.replace(/\./g, '');
    if (bare.length < 2) continue;
    if (NOT_ACRONYM.has(bare) || NOT_ACRONYM.has(tok)) continue;
    if (/^\d/.test(bare)) continue;
    found.push(tok);
  }
  return found;
}

let m;
let cpRemoved = 0;
const CP_RE = /\bcp\.\s*>/;     // Tom's "comparez >"-vergelijkingsnotities
while ((m = ROW_RE.exec(txt)) !== null) {
  const rawC1 = unescapeHtml(m[1]);
  const rawC2 = unescapeHtml(m[2]);

  // "cp. >"-regels (comparez/vergelijk-voorbeelden) buiten de app-data laten.
  // De bron in archive/source/ blijft ongewijzigd; dit is enkel curatie.
  if (CP_RE.test(rawC1) || CP_RE.test(rawC2)) { cpRemoved++; continue; }

  // Welke kolom is Frans?
  const f1 = frenchness(rawC1);
  const f2 = frenchness(rawC2);
  let frCell, nlCell, swapped;
  if (f1 > f2) { frCell = rawC1; nlCell = rawC2; swapped = true; }
  else { frCell = rawC2; nlCell = rawC1; swapped = false; } // gelijkspel ⇒ kop-volgorde
  if (swapped) swappedCount++;
  if (f1 === 0 && f2 === 0) noLangCount++;

  // raw = originele regel, ongewijzigd (kop-volgorde NL | FR behouden).
  const raw = `${rawC1} | ${rawC2}`;

  // Bron + jaar zitten (vrijwel) altijd aan de Franse kant.
  const code = extractSource(frCell) || extractSource(nlCell);
  const { source, code: normCode, unknown } = normalizeSource(code);
  if (unknown && normCode) unknownCodes[normCode] = (unknownCodes[normCode] || 0) + 1;
  const year = extractYear(frCell) ?? extractYear(nlCell);

  // Onderwerp: voorkeur voor de cel die m.b.t. bevat.
  let topic = '';
  const tm = (nlCell.match(TOPIC_RE) || frCell.match(TOPIC_RE));
  if (tm) topic = tm[1].replace(/\s{2,}/g, ' ').trim().replace(/\)+$/, '');

  // Vlaggen.
  const jt = JT_RE.test(frCell) || JT_RE.test(nlCell);
  const pepite = detectPepite(frCell) || detectPepite(nlCell);
  const tdf = TDF_RE.test(frCell) || TDF_RE.test(nlCell);
  const domeinMatch = frCell.match(DOMAIN_RE) || nlCell.match(DOMAIN_RE);
  const domein = domeinMatch ? domeinMatch[1].toLowerCase() : '';
  const acroList = detectAcronyms(stripMeta(frCell, normCode));
  const afk = acroList.length > 0;

  // Leesbare tekst (metadata eruit, typefouten erin — fidelity).
  const fr = stripMeta(frCell, normCode);
  const nl = stripMeta(nlCell, normCode);

  entries.push({
    id: entries.length,
    fr, nl, raw,
    source, year: year ?? null, topic,
    swapped,
    flags: { pepite, afk, tdf, jt, domein: domein || null },
    acronyms: afk ? acroList : undefined,
  });
}

// ---------------------------------------------------------------------------
// 4. Pépite-ontdubbeling (echte pépites)
// ---------------------------------------------------------------------------
const pepiteKeys = new Set();
let pepiteRaw = 0;
for (const e of entries) {
  if (e.flags.pepite) {
    pepiteRaw++;
    pepiteKeys.add((e.fr + '||' + e.nl).toLowerCase());
  }
}
const pepiteUnique = pepiteKeys.size;

// ---------------------------------------------------------------------------
// 5. Dekkingsrapport samenstellen
// ---------------------------------------------------------------------------
const bySource = {}, byYear = {};
let nAfk = 0, nTdf = 0, nDomein = 0, nJt = 0, nNoLang = 0, nNoSource = 0, nNoYear = 0;
for (const e of entries) {
  bySource[e.source || '(geen)'] = (bySource[e.source || '(geen)'] || 0) + 1;
  byYear[e.year || '(geen)'] = (byYear[e.year || '(geen)'] || 0) + 1;
  if (e.flags.afk) nAfk++;
  if (e.flags.tdf) nTdf++;
  if (e.flags.domein) nDomein++;
  if (e.flags.jt) nJt++;
  if (!e.source) nNoSource++;
  if (!e.year) nNoYear++;
}
nNoLang = noLangCount;

const sourceRows = Object.entries(bySource)
  .sort((a, b) => b[1] - a[1]);
const yearRows = Object.entries(byYear)
  .filter(([y]) => y !== '(geen)')
  .sort((a, b) => Number(a[0]) - Number(b[0]));

function table(rows, h1, h2) {
  return [`| ${h1} | ${h2} |`, '|---|---:|', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join('\n');
}

const report = `# Dekkingsrapport — La Grande Boucle de Tom

Gegenereerd door \`scripts/parse.js\` uit \`archive/source/woordenlijst_V2.html\`.
Reproduceerbaar met \`node scripts/parse.js\`.

**Totaal ingangen:** ${entries.length}
**Uitgesloten "cp. >"-notities (comparez/vergelijk-voorbeelden):** ${cpRemoved} (bron blijft intact in archive/source/)
**Frans-eerst (kolommen omgewisseld t.o.v. de kop):** ${swappedCount} (${(swappedCount / entries.length * 100).toFixed(1)}%)
**Regels zonder herkende taal (gelijkspel, kop-volgorde aangehouden):** ${nNoLang}
**Regels zonder herkende bron:** ${nNoSource}
**Regels zonder herkend jaar:** ${nNoYear}

## Belangrijkste bevinding (geverifieerd, niet aangenomen)
De opdracht ging uit van **2004–2020**, maar de bron loopt door tot **2025**
(en bevat 2 regels uit 2002). De tijdlijn is daarom gebouwd op het **werkelijke**
bereik. Zie de jaartabel hieronder.

## Aantal per bron (ranglijst)
${table(sourceRows, 'Bron', 'Aantal')}

## Aantal per jaar (tijdlijn)
${table(yearRows, 'Jaar', 'Aantal')}

## Vlaggen
| Vlag | Aantal |
|---|---:|
| Pépites (ruw, met *) | ${pepiteRaw} |
| **Pépites (na ontdubbeling op fr+nl)** | **${pepiteUnique}** |
| Afkortingen (afk) | ${nAfk} |
| Tour de France (tdf) | ${nTdf} |
| Domein-labels (jur./med./fin./techn./…) | ${nDomein} |
| JT-bronnotitie (extrait du JT) | ${nJt} |

## Onbekende/onverwerkte broncodes (source leeg gelaten, gelogd)
${Object.keys(unknownCodes).length
    ? table(Object.entries(unknownCodes).sort((a, b) => b[1] - a[1]).slice(0, 40), 'Code/tekst', 'Aantal')
    : '_Geen._'}

## Filter-aanbevelingen (input voor STAP 2)
- **Bron**: ${sourceRows.filter(([k]) => k !== '(geen)').length} herkende bronnen — ranglijst-filter is zinvol (RTL & France 2 domineren).
- **Jaar**: volledige reeks ${yearRows[0] && yearRows[0][0]}–${yearRows.length && yearRows[yearRows.length - 1][0]} — tijdlijn-filter zinvol.
- **Tour de France**: ${nTdf} treffers — étappe-filter zinvol${nTdf < 30 ? ' (klein, maar thematisch kernonderdeel)' : ''}.
- **Pépites**: ${pepiteUnique} unieke — ${pepiteUnique >= 30 ? 'filter opnemen.' : 'te klein/ruizig, niet als hoofdfilter.'}
- **Afkortingen**: ${nAfk} treffers — ${nAfk >= 30 ? 'detectie betekenisvol; opnemen als quickfilter.' : 'weglaten (onbetrouwbaar).'} Let op vals-positieven (eigennamen in kapitaal).
- **Onderwerp (m.b.t.)**: geen dropdown; doorzoekbaar + op de kaart getoond.
`;

// ---------------------------------------------------------------------------
// 6. Wegschrijven
// ---------------------------------------------------------------------------
const OUT_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(OUT_DIR, { recursive: true });

const meta = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'archive/source/woordenlijst_V2.html',
  total: entries.length,
  swapped: swappedCount,
  years: yearRows.map(([y]) => Number(y)),
  sources: sourceRows.filter(([k]) => k !== '(geen)').map(([k, v]) => ({ name: k, count: v })),
  pepiteUnique,
  counts: { afk: nAfk, tdf: nTdf, domein: nDomein, jt: nJt },
};

fs.writeFileSync(path.join(OUT_DIR, 'taalarchief.json'),
  JSON.stringify({ meta, entries }, null, 0));
fs.writeFileSync(path.join(OUT_DIR, 'dekkingsrapport.md'), report);

console.log('OK —', entries.length, 'ingangen.');
console.log('  Frans-eerst:', swappedCount, '| pépites uniek:', pepiteUnique,
  '| afk:', nAfk, '| tdf:', nTdf, '| domein:', nDomein, '| jt:', nJt);
console.log('  Geschreven: data/taalarchief.json, data/dekkingsrapport.md');
