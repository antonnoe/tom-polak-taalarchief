# Dekkingsrapport — La Grande Boucle de Tom

Gegenereerd door `scripts/parse.js` uit `archive/source/woordenlijst_V2.html`.
Reproduceerbaar met `node scripts/parse.js`.

**Totaal ingangen:** 12080
**Uitgesloten "cp. >"-notities (comparez/vergelijk-voorbeelden):** 147 (bron blijft intact in archive/source/)
**Frans-eerst (kolommen omgewisseld t.o.v. de kop):** 2801 (23.2%)
**Regels zonder herkende taal (gelijkspel, kop-volgorde aangehouden):** 34
**Regels zonder herkende bron:** 6101
**Regels zonder herkend jaar:** 5969

## Belangrijkste bevinding (geverifieerd, niet aangenomen)
De opdracht ging uit van **2004–2020**, maar de bron loopt door tot **2025**
(en bevat 2 regels uit 2002). De tijdlijn is daarom gebouwd op het **werkelijke**
bereik. Zie de jaartabel hieronder.

## Aantal per bron (ranglijst)
| Bron | Aantal |
|---|---:|
| (geen) | 6101 |
| RTL | 3531 |
| France 2 | 1431 |
| TV5 Monde | 317 |
| Aujourd'hui en France | 274 |
| Le Figaro | 112 |
| Info | 80 |
| L'Équipe | 33 |
| Journal du Dimanche | 21 |
| Libération | 21 |
| Métro | 14 |
| M6 | 11 |
| France-Soir | 10 |
| Sud Ouest | 10 |
| France 3 | 7 |
| La Nouvelle République | 7 |
| i>Télé | 7 |
| Le Dauphiné Libéré | 7 |
| La Provence | 6 |
| Direct Matin | 6 |
| LCI | 6 |
| TV | 6 |
| Le Républicain Lorrain | 6 |
| TF1 | 5 |
| Eurosport | 5 |
| Ouest-France | 4 |
| France 5 | 3 |
| France Inter | 3 |
| Ile-de-France | 3 |
| Philippe | 3 |
| Confluent | 2 |
| BFM TV | 2 |
| La Voix du Nord | 2 |
| Arte | 2 |
| Canal+ | 2 |
| France Bleu | 2 |
| Planète | 1 |
| Rodez | 1 |
| Direct Soir | 1 |
| JT | 1 |
| Eaufficiel | 1 |
| Colmar | 1 |
| Le Parisien | 1 |
| TYL | 1 |
| RMC | 1 |
| Cahors | 1 |
| Salon | 1 |
| LCP | 1 |
| BNR | 1 |
| Culture | 1 |
| Albertville | 1 |
| Youtube | 1 |
| Bein | 1 |
| Courtepaille | 1 |

## Aantal per jaar (tijdlijn)
| Jaar | Aantal |
|---|---:|
| 2002 | 8 |
| 2003 | 1 |
| 2004 | 108 |
| 2005 | 342 |
| 2006 | 677 |
| 2007 | 773 |
| 2008 | 703 |
| 2009 | 535 |
| 2010 | 483 |
| 2011 | 456 |
| 2012 | 315 |
| 2013 | 212 |
| 2014 | 217 |
| 2015 | 214 |
| 2016 | 283 |
| 2017 | 239 |
| 2018 | 210 |
| 2019 | 65 |
| 2020 | 74 |
| 2021 | 74 |
| 2022 | 52 |
| 2023 | 37 |
| 2024 | 28 |
| 2025 | 5 |

## Vlaggen
| Vlag | Aantal |
|---|---:|
| Pépites (ruw, met *) | 697 |
| **Pépites (na ontdubbeling op fr+nl)** | **694** |
| Afkortingen (afk) | 171 |
| Tour de France (tdf) | 72 |
| Domein-labels (jur./med./fin./techn./…) | 76 |
| JT-bronnotitie (extrait du JT) | 93 |

## Onbekende/onverwerkte broncodes (source leeg gelaten, gelogd)
| Code/tekst | Aantal |
|---|---:|
| F1 | 11 |
| hebdo | 6 |
| Courrier des Yvelines | 4 |
| Union presse | 4 |
| sport + | 2 |
| femme | 2 |
| fille | 2 |
| homme | 2 |
| TV magazine | 2 |
| Europe 1 | 2 |
| N2 | 2 |
| Eauficiel du Tour | 1 |
| l’Echo Républicain | 1 |
| dame chique dans la rue > | 1 |
| TV hebdo | 1 |
| guide Tour | 1 |
| *F2 | 1 |
| AJ 03- | 1 |
| G&E | 1 |
| aire d’autoroute | 1 |
| site | 1 |
| vivacité | 1 |
| Sport + | 1 |
| animateur Tour de France | 1 |
| RTL 2TL | 1 |
| Speedy Reims | 1 |
| propos arbitre TT > Metz | 1 |
| B2 | 1 |
| La Croix | 1 |
| speaker Besançon | 1 |
| BFM TV | 1 |
| homme > enfant | 1 |
| S. Hucliez > Salzbourg | 1 |
| ô | 1 |
| cine | 1 |
| Courrier picard | 1 |
| animateur quiz | 1 |
| vol Air France | 1 |
| Carrefour savoirs | 1 |
| ciné | 1 |

## Filter-aanbevelingen (input voor STAP 2)
- **Bron**: 53 herkende bronnen — ranglijst-filter is zinvol (RTL & France 2 domineren).
- **Jaar**: volledige reeks 2002–2025 — tijdlijn-filter zinvol.
- **Tour de France**: 72 treffers — étappe-filter zinvol.
- **Pépites**: 694 unieke — filter opnemen.
- **Afkortingen**: 171 treffers — detectie betekenisvol; opnemen als quickfilter. Let op vals-positieven (eigennamen in kapitaal).
- **Onderwerp (m.b.t.)**: geen dropdown; doorzoekbaar + op de kaart getoond.
