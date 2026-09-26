# Mealprep-Planer – Design-Spezifikation

**Datum:** 2026-09-26
**Status:** Entwurf zur Prüfung
**Arbeitstitel:** Mealprep-Planer

---

## 1. Ziel und Kontext

Eine Progressive Web App (PWA) zur Planung von Mahlzeiten und Mealprep für einen Haushalt, zunächst für zwei Personen (Nutzer und Partnerin). Die App plant eine Woche, liefert vollständige Rezepte mit Nährwerten, erzeugt eine Einkaufsliste und kann die Woche automatisch anhand von Budget, Kalorien- und Makrozielen, Kochtagen und Vorlieben füllen.

**Erfolg bedeutet:**
- Einmal pro Woche in wenigen Minuten einen Plan erstellen, der die Ziele beider Personen ungefähr trifft.
- Mit **einer** gemeinsamen, in Packungen gerundeten Einkaufsliste einkaufen gehen.
- Am Kochtag wissen, was gekocht wird und wie es auf Boxen verteilt wird.
- Die App funktioniert vollständig offline.

**Rahmenbedingungen:**
- Zunächst privat; eine spätere Veröffentlichung ist möglich. Deshalb: Mehrhaushaltsfähigkeit von Anfang an, nur rechtlich unbedenkliche Datenquellen.
- Keine laufenden Kosten im privaten Betrieb.
- Sprache der App: Deutsch. Rezepte, Zutaten und Preise: deutsch/europäisch.
- Der Code wird überwiegend von Claude geschrieben; der Nutzer liest und steuert.

---

## 2. Umfang und Ausbaustufen

Jede Stufe ist eigenständig nutzbar. Diese Spec beschreibt alle vier Stufen; der erste Umsetzungsplan umfasst **nur Stufe 1**.

| Stufe | Inhalt |
|---|---|
| **1 – Fundament** (lokal, offline) | Zutatenkatalog (BLS-Nährwerte, Richtpreise, Packungsgrößen); Startpaket mit ca. 100 Rezepten; Haushalt mit mehreren Personenprofilen und Zielen; eigene Rezepte anlegen/bearbeiten; Startrezepte als eigene Version anpassen; Wochenplan manuell mit Portionen pro Person; Kochtag-Ansicht; Einkaufsliste (Woche/Tag/Kochtag) mit Packungsrundung und Abhaken; Ziel-Rechner; Export/Import als JSON |
| **2 – Automatische Planung** | Solver (Abschnitt 6); Festpinnen, Neu würfeln, Tauschen pro Person; Portionsskalierung pro Person; Hinweise auf Zielabweichungen |
| **3 – Haushalt teilen** | Supabase-Login (Magic Link), Einladungscode, Sync über RxDB ↔ Supabase, Live-Abhaken der Einkaufsliste, Keep-alive gegen Pausierung |
| **4 – Vorrat & Import** | Vorrat mit automatischer Resteverbuchung, Solver bevorzugt Resteverwertung; Rezept-Import per Link (schema.org/Recipe) über eine Supabase Edge Function |

**Ausdrücklich nicht Teil dieser Spec:** Live-Supermarktpreise, Wochenangebote, Open-Prices-Anbindung, Barcode-Scan, Mehrsprachigkeit, Bezahlfunktionen, Veröffentlichung (Datenschutzerklärung, Impressum).

---

## 3. Architektur

```
┌─────────────────────────── Browser (PWA) ───────────────────────────┐
│  React-UI  ──►  Domänenlogik (reines TS)  ──►  Solver (Web Worker)  │
│     │                   │                                           │
│     ▼                   ▼                                           │
│  RxDB (Dexie/IndexedDB) – Haushaltsdaten      Katalog (JSON, statisch)│
│     │                                                                │
│  Service Worker (vite-plugin-pwa): App + Katalog vorgespeichert     │
└─────┼────────────────────────────────────────────────────────────────┘
      │ Replikation (ab Stufe 3)
      ▼
  Supabase: Postgres + Auth + Row Level Security (+ Edge Function ab Stufe 4)
```

**Technik:**
- React + Vite + **TypeScript** + Tailwind CSS
- `vite-plugin-pwa` (Service Worker, Installierbarkeit, Update-Hinweis)
- **RxDB** mit kostenloser Dexie-Speicherung (IndexedDB) als lokale Datenbank; ab Stufe 3 Replikation mit Supabase. Ist das offizielle Supabase-Replikations-Plugin kostenpflichtig, wird RxDBs kostenloses generisches Replikationsprotokoll gegen die Supabase-REST-API genutzt.
- **Supabase** (Gratis-Tarif) ab Stufe 3
- Hosting auf **GitHub Pages**, Deploy per GitHub Actions

**Trennung der Daten:**
- **Katalogdaten** (Zutaten, Startrezepte) sind für alle gleich, werden als versioniertes JSON mit der App ausgeliefert und nie in die Datenbank geschrieben.
- **Haushaltsdaten** gehören dem Haushalt, liegen lokal in RxDB und werden ab Stufe 3 synchronisiert.

**Modulgrenzen** (jede Einheit einzeln testbar, ohne UI):
- `units` – Umrechnung aller Mengen in Gramm
- `nutrition` – Nährwerte eines Rezepts/einer Portion aus Zutaten
- `pricing` – Preis pro Portion und Packungsrundung
- `shopping` – Einkaufsliste aus Planeinträgen zusammenrechnen
- `rules` – harte Regeln (Ernährungsform, Allergien, Abneigungen, Haltbarkeit, Slot, Zeit)
- `solver` – Auswahl und Portionierung (Web Worker)
- `targets` – Ziel-Rechner (Mifflin-St-Jeor)
- `db` – RxDB-Schemas und Zugriff
- `ui` – React-Komponenten und Bildschirme

Der Kostenrahmen: privat 0 €. Kosten entstehen erst bei einer Veröffentlichung mit Wachstum (Supabase Pro ca. 25 $/Monat bei > 500 MB oder ohne Pausierung).

---

## 4. Datenquellen

| Zweck | Quelle | Lizenz / Hinweis |
|---|---|---|
| Nährwerte der Zutaten | **Bundeslebensmittelschlüssel (BLS) 4.0**, Excel-Download von blsdb.de | CC BY 4.0 – Namensnennung in der App („Quellen“) |
| Preise | **Richtpreise** pro Zutat/Packung auf Discounter-Niveau, einmalig manuell aus öffentlich sichtbaren Preisen ermittelt, mit „Stand“-Datum; vom Haushalt überschreibbar | Einzelne Preisangaben; kein systematisches Scraping, keine Umgehung technischer Schutzmaßnahmen |
| Rezepte (Startpaket) | Eigene Texte, im Repo gepflegt | frei veröffentlichbar |
| Rezepte (Import, Stufe 4) | schema.org/Recipe-Daten der angegebenen Seite | Wird nur als private Kopie des Haushalts gespeichert, nie in den Katalog übernommen |

**Nicht genutzt:** Supermarkt-APIs (REWE schützt die API technisch; Lidl/Kaufland/Netto/Edeka bieten keine vollständigen Sortimentspreise), Spoonacular/Edamam (englisch, US-Preise, Speicherverbot), Scraping-Dienste.

---

## 5. Datenmodell

**Grundregel:** Intern rechnet die App in **Gramm**. Milliliter und Stück werden über Dichte bzw. Stückgewicht umgerechnet. Nährwerte, Preise, Ernährungsform-Eignung und Einkaufsliste werden **aus den Zutaten abgeleitet** und nicht gespeichert.

**Stabile IDs:** Zutaten- und Rezept-IDs im Katalog ändern sich nie. Wird eine Zutat oder ein Rezept entfernt, bleibt die ID reserviert, und Verweise darauf werden als „nicht mehr verfügbar“ angezeigt.

### 5.1 Katalog

**Zutat (`Ingredient`)**
- `id`, `name`, `blsCode`
- `category` – Supermarktbereich für die Sortierung der Einkaufsliste (z. B. Obst & Gemüse, Kühlregal, Trockenware, Tiefkühl, Fleisch & Fisch, Gewürze)
- `per100g` – `kcal`, `protein`, `fat`, `carbs`, `fiber`, `sugar`, `salt`
- `densityGPerMl` (optional), `pieceWeightG` (optional)
- `packages` – Liste von `{ sizeG, priceEur }`
- `priceAsOf` – Datum des Richtpreises
- `flags` – `animal`, `meat`, `pork`, `fish`, `dairy`, `egg`, `honey`
- `allergens` – nach den 14 EU-Hauptallergenen (z. B. `gluten`, `milk`, `nuts`, `peanuts`, `soy`, `egg`, `fish`, `crustaceans`, `celery`, `mustard`, `sesame`, `sulphites`, `lupin`, `molluscs`)
- `pantryStaple` (bool) – Grundvorrat wie Salz, Pfeffer, Öl: erscheint auf der Liste nur als „prüfen“ ohne Preis

**Rezept (`Recipe`)**
- `id`, `title`, `description`, `servings` (Grundportionen)
- `ingredients` – Liste von `{ ingredientId, amount, unit: 'g'|'ml'|'stk'|'el'|'tl', note?, optional? }`
- `steps` – Liste von Texten
- `prepMinutes`, `cookMinutes`
- `mealTypes` – Teilmenge von `breakfast`, `lunch`, `dinner`, `snack`
- `storage` – `{ kind: 'prep', fridgeDays, freezable }` oder `{ kind: 'fresh' }`
- `tags` – frei (z. B. „One-Pot“, „Low Carb“)
- `source` – `starter` | `own` | `import` (mit `url`)
- `basedOn` (optional) – ID des Startrezepts, aus dem eine eigene Version entstand
- `version` – Zahl, wird bei Katalogänderungen erhöht

Abgeleitet: Nährwerte pro Portion und pro 100 g, Preis pro Portion, Ernährungsform (vegan, vegetarisch, pescetarisch, ohne Schwein), enthaltene Allergene.

### 5.2 Haushaltsdaten (RxDB-Collections)

Alle Dokumente haben `id`, `householdId`, `updatedAt` und `_deleted` (weiches Löschen für die Replikation).

- **household** – `name`, `weeklyBudgetEur`, `cookDays` (Wochentage), `weekStartsOn`, `variety` (`maxCooksPerWeek` Standard 1, `maxConsecutiveDays` Standard 3, `avoidRepeatFromLastWeek` Standard `true`)
- **person** – `name`, `userId?` (leer bei Profil ohne Konto), `targets` (`kcal`, `proteinMin`, `fatMin?`, `fatMax?`, `carbsMin?`, `carbsMax?`), `mealSlots` (welche Slots diese Person isst), `diet` (`omnivore`|`vegetarian`|`vegan`|`pescetarian`), `noPork`, `allergies[]`, `dislikedIngredientIds[]`, `maxMinutesWeekday`, `maxMinutesCookDay`
- **recipe** – eigene und importierte Rezepte sowie eigene Versionen von Startrezepten; Aufbau wie `Recipe`
- **rating** – `personId`, `recipeId`, `value`: `up` | `down` | `favorite`
- **priceOverride** – `ingredientId`, `packages` (ersetzt die Richtpreise dieser Zutat)
- **meal** – ein Eintrag im Wochenplan: `date`, `slot`, `recipeId`, `cookDate` (Tag der Zubereitung; bei `fresh` = `date`), `portions` (Zuordnung `personId → Faktor`, z. B. `{A: 1.4, B: 0.9}`), `pinned` (bool)
- **shoppingCheck** – `weekStart`, `ingredientId`, `checked`
- **pantryItem** (Stufe 4) – `ingredientId`, `amountG`, `updatedAt`

**Tauschen:** Tauscht Person B eine gemeinsame Mahlzeit, wird B aus `portions` der gemeinsamen Mahlzeit entfernt und eine neue `meal` für denselben Slot mit `portions = {B: …}` angelegt.

**Eigene Version eines Startrezepts:** Bearbeiten eines Startrezepts erzeugt ein `recipe` mit `source: 'own'` und `basedOn`. Der Haushalt sieht fortan seine Version an Stelle des Originals (auch in bestehenden Plänen). „Original wiederherstellen“ löscht die eigene Version. Ist `version` des Originals höher als beim Anlegen der Kopie gespeichert, erscheint „Original wurde aktualisiert“.

**Rezeptänderungen und Pläne:** Eine `meal` verweist auf die Rezept-ID; Pläne zeigen immer den aktuellen Stand des Rezepts.

---

## 6. Solver (Stufe 2)

Läuft in einem Web Worker, Ziel-Laufzeit ≤ 2 Sekunden auf einem Mittelklasse-Handy.

**Eingaben:** Haushalt, Personen, Woche, Kochtage, Katalog- und eigene Rezepte, Bewertungen, Plan der Vorwoche, Vorrat (Stufe 4), festgepinnte Mahlzeiten, Zufallswert (Seed).

**Harte Regeln** (werden nie verletzt; ein Plan mit Verstoß wird nicht ausgegeben):
1. Ernährungsform, Allergien, abgelehnte Zutaten jeder Person. Bei gemeinsamen Mahlzeiten gelten die Regeln **aller** Esser.
2. Rezept passt zum Slot (`mealTypes`).
3. Haltbarkeit: bei `prep` gilt `date − cookDate ≤ fridgeDays`, und `cookDate` ist ein Kochtag oder derselbe Tag; bei `fresh` gilt `cookDate = date`.
4. Zeit: Wird an einem Nicht-Kochtag frisch gekocht, gilt `prepMinutes + cookMinutes ≤ maxMinutesWeekday` jeder beteiligten Person; an Kochtagen gilt `maxMinutesCookDay`.
5. Festgepinnte Mahlzeiten bleiben unverändert.

**Weiche Ziele** (gewichtete Strafpunkte, Gewichte als Konstanten in einer Datei):
- Abweichung von kcal pro Person und Tag (höchstes Gewicht); Unterschreitung von `proteinMin` (hohes Gewicht); Verlassen der Fett-/Kohlenhydrat-Bereiche (mittleres Gewicht)
- Überschreitung des Wochenbudgets
- Bewertungen: `favorite` belohnt, `up` leicht belohnt, `down` stark bestraft
- Abwechslung: Verstöße gegen `maxCooksPerWeek`, `maxConsecutiveDays`, `avoidRepeatFromLastWeek` (Abwechslung zählt **Kochgänge**, nicht Tage)
- Packungsreste (nicht verbrauchte Packungsanteile) und – ab Stufe 4 – nicht verwerteter Vorrat

**Ablauf:**
1. **Auswahl:** Zufälliger, regelkonformer Startplan aus dem Seed, anschließend lokale Suche (Simulated Annealing) mit Zügen wie „Gericht in einem Slot tauschen“, „Kochgang verlängern/verkürzen“, „Kochtag eines Gerichts verschieben“. Jeder Zug wird gegen die harten Regeln geprüft.
2. **Portionierung:** Für jede Person und jeden Tag werden die Portionsfaktoren (0,5–2,0, gerundet auf 0,25) so gewählt, dass die Strafpunkte der Makroziele minimal werden (begrenzte kleinste Quadrate). Snack-Slots dürfen Protein- oder kcal-Lücken schließen.

**Ausgabe:** Plan, Strafpunkte, Liste der verbleibenden Abweichungen in Klartext (z. B. „Budget um 4,20 € überschritten“, „Di: Protein 12 g unter Ziel bei B“).

**Bedienung:** „Automatisch planen“ (ganze Woche, gepinnte Mahlzeiten bleiben), „Neu würfeln“ (neuer Seed, einzelne Mahlzeit oder Woche), „Tauschen“ (eine Person, eine Mahlzeit; Rest des Tages dieser Person wird neu portioniert).

**Kein Plan möglich:** Findet der Solver für einen Slot kein regelkonformes Rezept, bleibt der Slot leer und wird mit Grund markiert (z. B. „Kein veganes Frühstück unter 10 Minuten vorhanden“).

---

## 7. Bildschirme

Mobile-first, Deutsch, heller und dunkler Modus, untere Navigationsleiste mit fünf Bereichen.

1. **Woche** (Startseite) – 7 Tage mit Slots; pro Mahlzeit Gericht und Portionen pro Person; pro Tag und Person Fortschrittsbalken für kcal, Protein, Fett, Kohlenhydrate; Budget-Zähler. Aktionen: Automatisch planen (ab Stufe 2), 📌, 🎲, ⇄, manuell wählen.
2. **Kochtag** – pro Kochtag alle Gerichte mit Gesamtmengen; Boxen-Aufteilung (z. B. „Chili → 5 Boxen: Mo/Di/Mi A je 1,4, Mo/Di B je 0,9“) mit „haltbar bis …“ bzw. „einfrieren“; Koch-Modus mit abhakbaren Schritten und aktiver Bildschirmsperre-Verhinderung (Wake Lock).
3. **Einkauf** – umschaltbar Woche / Tag / Kochtag. Maßgeblich ist immer der Zubereitungstag (`cookDate`), nicht der Esstag: „Tag“ listet, was an diesem Tag gekocht wird; „Kochtag“ listet alles vom jeweiligen Kochtag bis vor den nächsten Kochtag (also auch frisch gekochte Gerichte dazwischen); „Woche“ fasst alles zusammen. Packungen werden in jeder Ansicht für den gewählten Zeitraum gerundet. Sortiert nach Supermarktbereich sortiert; Packungen, Preis pro Position, Summe; Grundvorrat als „prüfen“; Abhaken; Teilen als Text.
4. **Rezepte** – Suche und Filter (Mahlzeit, vorkochbar/frisch, Zeit, Ernährungsform, Favoriten); Detail mit skalierbaren Zutaten, Schritten, Nährwerttabelle pro Portion und pro 100 g, Preis pro Portion, Lagerung, Bewertung, „Zum Plan hinzufügen“; Rezept anlegen/bearbeiten mit Zutaten-Autovervollständigung und Live-Nährwerten; bei Startrezepten „Original wiederherstellen“.
5. **Haushalt** – Personen (Ziele, Regeln, Slots, Zeitlimits); Budget, Kochtage, Abwechslungsregeln; eigene Preise; Datensicherung (Export/Import JSON); Quellen/Lizenzen; ab Stufe 3 Konto und Einladen; ab Stufe 4 Vorrat.

**Ersteinrichtung:** Assistent für Haushalt, Personen, Ziele, Budget und Kochtage. **Ziel-Rechner:** Gewicht, Größe, Alter, Geschlecht, Aktivität, Ziel (abnehmen/halten/aufbauen) → Grundumsatz nach Mifflin-St-Jeor × Aktivitätsfaktor ± Zielanpassung; Protein-Vorschlag 1,6–2,0 g/kg; Fett 25–35 % der kcal; Rest Kohlenhydrate. Alle Werte bleiben änderbar.

**Update-Hinweis:** Liegt eine neue App-/Katalogversion vor, erscheint „Neue Version verfügbar – neu laden“.

---

## 8. Katalog-Pipeline

Verzeichnis `catalog/` im Repo, Skripte in `tools/` (TypeScript, per `tsx` ausgeführt).

- `tools/import-bls.ts` liest die BLS-Excel-Datei (nicht im Repo, lokaler Pfad) und schreibt die Nährwerte der in `catalog/ingredients.csv` gelisteten BLS-Codes nach `catalog/ingredients.json`.
- `catalog/ingredients.csv` – von Hand gepflegt: ID, Name, BLS-Code, Kategorie, Dichte, Stückgewicht, Packungen mit Preisen, Preisstand, Flags, Allergene, Grundvorrat.
- `catalog/recipes/*.yaml` – ein Rezept pro Datei.
- `tools/build-catalog.ts` erzeugt `public/catalog.json` und **bricht ab**, wenn:
  - eine Zutat nicht existiert oder eine Einheit nicht umrechenbar ist,
  - `storage` fehlt oder `fridgeDays` außerhalb 1–5 liegt,
  - die Nährwerte pro Portion unplausibel sind (|kcal − (4·Protein + 4·KH + 9·Fett)| > 15 % bzw. kcal pro Portion außerhalb 50–1.500),
  - eine ID doppelt vorkommt oder eine zuvor vergebene ID fehlt, ohne in `catalog/retired-ids.txt` zu stehen.
- **Startpaket:** ca. 100 Rezepte, verteilt auf Frühstück, Mittag, Abend und Snacks, mit einem hohen Anteil vorkochbarer Gerichte sowie vegetarischen Optionen. Haltbarkeiten folgen gängigen Empfehlungen (gekochte Gerichte im Kühlschrank meist 3–4 Tage, Fisch und Reisgerichte kürzer).
- Nährwerte der Startrezepte entstehen ausschließlich rechnerisch aus BLS-Daten.

---

## 9. Offline und Synchronisation (Stufe 3)

- Service Worker speichert App-Shell und `catalog.json` vor; alle Funktionen außer Login, Einladen und Import arbeiten offline.
- **Login:** Supabase Auth mit E-Mail-Link (Magic Link).
- **Haushalt beitreten:** Einladungscode (8 Zeichen, 7 Tage gültig, einmal verwendbar), erzeugt im Bereich Haushalt.
- **Tabellen in Supabase** spiegeln die RxDB-Collections; zusätzlich `household_member (householdId, userId, role)`.
- **Row Level Security:** Lesen und Schreiben nur, wenn `householdId` zu einem Haushalt gehört, in dem der Nutzer Mitglied ist.
- **Replikation:** RxDB-Replikation pro Collection über `updatedAt`; Konflikte: neueste Änderung pro Dokument gewinnt; Löschen nur weich (`_deleted`). Abhaken ist pro Zutat ein eigenes Dokument, sodass paralleles Abhaken verschiedener Positionen keine Konflikte erzeugt.
- **Erster Login:** Lokal vorhandene Daten (aus Stufe 1–2) werden dem neuen Haushalt zugeordnet und hochgeladen. Tritt ein Gerät mit lokalen Daten einem bestehenden Haushalt bei, wird gefragt: „Lokale Daten verwerfen“ oder „als Export sichern und verwerfen“.
- **Sync-Status:** Symbol (synchron / ausstehend / offline / Fehler).
- **Keep-alive:** GitHub Action ruft Supabase alle 3 Tage mit einer leichten Leseabfrage auf.

---

## 10. Rezept-Import per Link (Stufe 4)

- Supabase Edge Function `import-recipe` lädt die angegebene URL, liest `application/ld+json` mit `@type: Recipe` und gibt Titel, Portionen, Zutatenzeilen, Schritte und Zeiten zurück. Die Funktion verlangt einen eingeloggten Nutzer und begrenzt auf 20 Aufrufe pro Nutzer und Tag.
- Die App ordnet Zutatenzeilen per Textabgleich Katalogzutaten zu; unsichere Zuordnungen werden markiert und vom Nutzer bestätigt.
- Das Ergebnis öffnet sich immer im Bearbeiten-Formular; gespeichert wird erst nach Bestätigung als `source: 'import'` mit `url`.

---

## 11. Vorrat (Stufe 4)

- Nach dem Abschluss eines Einkaufs („Einkauf erledigt“) verbucht die App die Differenz zwischen gekaufter Packungsmenge und geplanter Verbrauchsmenge als Vorrat.
- Der Vorrat ist manuell korrigierbar.
- Der Solver berücksichtigt den Vorrat: vorhandene Mengen senken den Preis und reduzieren die Einkaufsliste, nicht verwerteter Vorrat erzeugt Strafpunkte.

---

## 12. Fehlerbehandlung

- **Solver unvollständig:** bestes Ergebnis plus Abweichungsliste, leere Slots mit Grund (Abschnitt 6).
- **Import fehlgeschlagen:** Formular mit allem Erkannten, Rest manuell.
- **Unbekannte Zutat beim Anlegen eines Rezepts:** Auswahl einer Katalogzutat oder Anlegen einer haushaltseigenen Zutat mit manuell eingetragenen Nährwerten pro 100 g (gleiche Struktur wie Katalogzutat, `source: 'own'`).
- **Verweis auf entfernte Katalog-ID:** Anzeige „nicht mehr verfügbar“, Mahlzeit bleibt im Plan, Einkaufsliste lässt die Zutat weg und zeigt einen Hinweis.
- **Speicher voll / IndexedDB nicht verfügbar:** deutliche Meldung mit Hinweis auf Export.
- **Sync-Fehler:** Änderungen bleiben lokal, erneuter Versuch mit steigendem Abstand, Status sichtbar.
- **Import einer Sicherungsdatei:** Prüfung des Formats und der Version vor dem Überschreiben; bei Fehler wird nichts verändert.

---

## 13. Tests und Qualität

- **Vitest-Unit-Tests** für `units`, `nutrition`, `pricing`, `shopping` (inkl. Packungsrundung und Zusammenfassen über Tage), `rules`, `targets` und die Portionierung.
- **Eigenschaftsbasierte Tests (fast-check)** für den Solver: für zufällig erzeugte Haushalte und Rezeptmengen werden harte Regeln nie verletzt, und das Ergebnis ist bei gleichem Seed identisch.
- **Katalog-Validierung** (`build-catalog.ts`) als eigener CI-Schritt.
- **Playwright-E2E-Tests** für die Kernabläufe: Ersteinrichtung → Woche manuell füllen → Einkaufsliste prüfen; ab Stufe 2 zusätzlich automatisch planen.
- **GitHub Actions:** Typprüfung, Lint, Tests, Katalog-Validierung, Build, Deploy auf GitHub Pages (nur `main`).

---

## 14. Rechtliches und Quellen

- In der App unter Haushalt → Quellen: „Nährwertdaten: Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut, CC BY 4.0“ mit Link.
- Richtpreise sind als Schätzung mit Stand-Datum gekennzeichnet.
- Importierte Rezepte werden nur haushaltsintern gespeichert und nie geteilt oder in den Katalog übernommen.
- Vor einer Veröffentlichung sind Datenschutzerklärung und Impressum nötig (außerhalb dieser Spec).

---

## 15. Offene Punkte für die Umsetzungspläne

- Genaue Gewichte der Solver-Strafpunkte werden in Stufe 2 anhand von Testhaushalten kalibriert.
- Ob das RxDB-Supabase-Plugin kostenlos ist, wird zu Beginn von Stufe 3 geprüft (Fallback siehe Abschnitt 3).
- Später möglich: Skill `neue-rezepte` zum Erweitern des Startpakets (analog zum Test-Trainer).
