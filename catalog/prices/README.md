# Preise

`2026-09-aldi-sued.csv` enthält die Rohdaten, aus denen die Richtpreise in `../ingredients.csv` stammen.

## Regeln

- **Quelle:** Online-Sortiment von Aldi Süd (Unterkategorie-Seiten, im Browser abgerufen und aus dem Seitentext übernommen). Abrufdatum steht in jeder Zeile.
- **Welcher Preis:** die günstigste reguläre Eigenmarke. Aktionsartikel (auf der Seite mit „Aktion“, „Spare x %“ oder Fußnote ¹ gekennzeichnet) werden nicht verwendet; bei „Spare“-Angaben zählt der reguläre Preis.
- **Bio-/Premium-Linie** nur, wenn es online keine andere Variante gibt.
- **Menge in Gramm.** Flüssigkeiten: ml × Dichte der Zutat. Konserven: Abtropfgewicht (ATG).
- **Mehrere Größen** derselben Eigenmarke werden alle übernommen – die App wählt die günstigste Kombination.
- **Kein Online-Preis** (frisches Obst und Gemüse, einige Trockenwaren): `quelle = schaetzung`, Wert auf Discounter-Niveau im September 2026. Diese Preise sind ausdrücklich Schätzungen und können im Haushalt überschrieben werden.
- REWE, Kaufland und Netto blockieren automatische Abrufe (HTTP 403) und werden nicht verwendet.

## Aldi-Süd-Unterkategorien (Stand 26.09.2026)

| Kategorie | URL |
|---|---|
| Milch | https://www.aldi-sued.de/produkte/milchprodukte-eier/milch/k/1588161425467094 |
| Speisequark | https://www.aldi-sued.de/produkte/milchprodukte-eier/speisequark/k/1588161425467095 |
| Naturjoghurt & Skyr | https://www.aldi-sued.de/produkte/milchprodukte-eier/naturjoghurt-skyr/k/1588161425467097 |
| Sahne & Schmand | https://www.aldi-sued.de/produkte/milchprodukte-eier/sahne-schmand-creme-fraiche/k/1588161425467098 |
| Butter | https://www.aldi-sued.de/produkte/milchprodukte-eier/butter-margarine/k/1588161425467099 |
| Eier | https://www.aldi-sued.de/produkte/milchprodukte-eier/eier/k/1588161425467100 |
| Frischkäse | https://www.aldi-sued.de/produkte/kaese/frischkaese/k/1588161425467086 |
| Feta & Hirtenkäse | https://www.aldi-sued.de/produkte/kaese/feta-hirtenkaese/k/1588161425467087 |
| Mozzarella | https://www.aldi-sued.de/produkte/kaese/mozzarella/k/1588161425467089 |
| Reibekäse | https://www.aldi-sued.de/produkte/kaese/reibekaese/k/1588161425467091 |
| Hartkäse | https://www.aldi-sued.de/produkte/kaese/hartkaese-stueckkaese/k/1588161425467088 |
| Geflügel | https://www.aldi-sued.de/produkte/fleisch-fisch/gefluegel/k/1588161425467059 |
| Hackfleisch | https://www.aldi-sued.de/produkte/fleisch-fisch/hackfleisch/k/1588161425467061 |
| Rindfleisch | https://www.aldi-sued.de/produkte/fleisch-fisch/rindfleisch/k/1588161425467064 |
| Schweinefleisch | https://www.aldi-sued.de/produkte/fleisch-fisch/schweinefleisch/k/1588161425467066 |
| Fisch & Meeresfrüchte | https://www.aldi-sued.de/produkte/fleisch-fisch/fisch-meeresfruechte/k/1588161425467055 |
| TK Fisch | https://www.aldi-sued.de/produkte/tiefkuehlung/tk-fisch-meeresfruechte/k/1588161425467143 |
| Reis | https://www.aldi-sued.de/produkte/nudeln-reis-huelsenfruechte/reis/k/1588161425467117 |
| Nudeln | https://www.aldi-sued.de/produkte/nudeln-reis-huelsenfruechte/nudeln-pasta/k/1588161425467116 |
| Hülsenfrüchte | https://www.aldi-sued.de/produkte/nudeln-reis-huelsenfruechte/huelsenfruechte-getreide/k/1588161425467120 |
| Gemüsekonserven | https://www.aldi-sued.de/produkte/konserven-fertiggerichte/gemuesekonserven/k/1588161425467137 |
| Fischkonserven | https://www.aldi-sued.de/produkte/konserven-fertiggerichte/fischkonserven/k/1588161425467136 |
| Essig & Öl | https://www.aldi-sued.de/produkte/saucen-oele-gewuerze/essig-oel/k/1588161425467129 |
| Gewürze | https://www.aldi-sued.de/produkte/saucen-oele-gewuerze/gewuerze-frische-kraeuter/k/1588161425467132 |
| Saucen | https://www.aldi-sued.de/produkte/saucen-oele-gewuerze/saucen-fertigsaucen/k/1588161425467122 |
| Senf | https://www.aldi-sued.de/produkte/saucen-oele-gewuerze/senf-meerrettich/k/1588161425467131 |
| Asiatisch | https://www.aldi-sued.de/produkte/asiatische-vielfalt/k/1588161426583078 |
| Brot | https://www.aldi-sued.de/produkte/backwaren-aufstriche-cerealien/brot/k/1588161425467102 |
| Toastbrot | https://www.aldi-sued.de/produkte/backwaren-aufstriche-cerealien/toastbrot/k/1588161425467103 |
| Wraps | https://www.aldi-sued.de/produkte/backwaren-aufstriche-cerealien/hotdogs-burger-buns-wraps/k/1588161425467106 |
| Mehl | https://www.aldi-sued.de/produkte/backzutaten-mehl-zucker/mehl/k/1588161425467159 |
| Nüsse | https://www.aldi-sued.de/produkte/suessigkeiten-salzige-snacks/nuesse-trockenfruechte/k/1588161425467168 |
| TK Gemüse | https://www.aldi-sued.de/produkte/tiefkuehlung/tk-gemuese/k/1588161425467150 |
| TK Obst | https://www.aldi-sued.de/produkte/tiefkuehlung/tk-obst/k/1588161425467151 |
| Tofu | https://www.aldi-sued.de/produkte/vegetarisch-vegan/tofu-falafel-gemuesebaellchen/k/1588161425467046 |
