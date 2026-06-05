# La Grande Boucle de Tom 🚴‍♂️🟡

Een feestelijk eerbetoon aan het **Frans–Nederlandse taalarchief van Tom Polak**:
bijna **12.000 uitdrukkingen**, opgetekend uit **radio en krant** tussen
**2004 en 2025**. Mobile-first, installeerbaar (PWA), werkt offline na de eerste
load. Geen woordenboek, geen naslagwerk-claim — een **portret** van de taal zoals
die echt klonk.

> Toon: levend en feestelijk, in Tour-de-France-stijl. De bronnen vormen een
> peloton, de jaren een tijdlijn, en Tom’s favorieten zijn de *pépites*.

## Wat zit erin
- **Le Peloton** — gevirtualiseerde lijst van alle uitdrukkingen (vloeiend op
  telefoon), met full-text zoeken over Frans + Nederlands + onderwerp + origineel.
- **Truien (quickfilters)** — 🟡 Alles · 🔴 Tour de France · 🟢 Pépites · ⚪ Afkortingen.
- **Bron & jaar** — bronfilter (ranglijst) en jaar-range (2004–2025).
- **Classement** — ranglijst van Tom’s bronnen.
- **Tijdlijn** — uitdrukkingen per jaar; tik een jaar aan om te filteren.
- **Étape du jour** — een deterministisch gekozen uitdrukking per dag.
- **Toon origineel** — de regel ongewijzigd (fidelity; ook tikfouten blijven staan).
- **TTS** — Franse uitspraak via de Web Speech API (verbergt zich netjes als de
  browser het niet ondersteunt).

## Projectstructuur
```
index.html              app-shell (mobile-first)
app.js                  data laden, virtualisatie, zoeken, filters, TTS, PWA
styles.css              BASELINE/placeholder-stijl (Claude Design vervangt dit)
data/taalarchief.json   geparste data (gegenereerd)
data/dekkingsrapport.md dekkingsrapport (gegenereerd)
scripts/parse.js        reproduceerbare parser (bron -> JSON)
scripts/make-icons.js   placeholder-iconen genereren
manifest.json           PWA-manifest
sw.js                   service worker (cache-first, offline)
icons/                  placeholder-iconen (Claude Design vervangt deze)
vercel.json             statische hosting-config
archive/                bevroren bron + oude UI's
  source/woordenlijst_V2.html   bron van waarheid (12.227 regels)
```

## Data opnieuw genereren
De data is volledig reproduceerbaar uit de bron:
```bash
node scripts/parse.js      # -> data/taalarchief.json + data/dekkingsrapport.md
node scripts/make-icons.js # -> placeholder-iconen in icons/
```
Zie [`data/dekkingsrapport.md`](data/dekkingsrapport.md) voor de dekking
(aantallen per bron/jaar, pépites, afkortingen, Tour-termen, domeinlabels).

### Data-archeologie — kernpunten (geverifieerd, niet aangenomen)
- De kop zegt *Nederlands | Frans*, maar **~24% van de regels staat Frans-eerst**
  (vooral de `(cp. >`-regels). De parser bepaalt **per regel** welke kolom Frans is.
- Het bereik is in werkelijkheid **2004–2025** (plus 2 regels uit 2002), **niet**
  2004–2020 zoals oorspronkelijk aangenomen.
- `raw` bewaart altijd de originele regel ongewijzigd.

## Lokaal bekijken
Een service worker vereist `http(s)`, dus serveer statisch:
```bash
python3 -m http.server 8000   # open http://localhost:8000
```

## Hosten op Vercel
Statische site, **geen build-stap**, relatieve paden, SW-scope op root.
1. Vercel → **Add New… → Project** → importeer `antonnoe/tom-polak-taalarchief`.
2. Framework Preset: **Other**. Build Command: **leeg**. Output Directory: **leeg**
   (root). Install Command: **leeg**.
3. Deploy. De preview-URL verschijnt na de eerste deploy.

## Voor Claude Design
De HTML gebruikt een vast **class-contract** (zie `index.html`). Vervang
`styles.css` en de bestanden in `icons/`; raak de class-namen niet aan.

## Licentie
© Tom Polak. Gepubliceerd onder
**CC BY-NC-ND 4.0** (zie [`LICENSE`](LICENSE)).

<!-- TODO Anton: persoonlijke tekst over Tom (ook in de Prologue-sectie van de app) -->
