# Katalog

- `bls-slim.json` – Auszug aus dem Bundeslebensmittelschlüssel (Code, Name, kcal, Protein, Fett, Kohlenhydrate, Ballaststoffe, Zucker, Salz pro 100 g). Erzeugt mit `npm run bls:extract` aus der offiziellen Excel-Datei.
- `ingredients.csv` – Zutaten der App (Trennzeichen `;`, Dezimalkomma erlaubt).
- `recipes/*.yaml` – ein Rezept pro Datei, Dateiname = Rezept-ID.
- `ids.lock` – alle je vergebenen IDs (wird von `npm run catalog` gepflegt, nicht von Hand ändern).
- `retired-ids.txt` – bewusst entfernte IDs, eine pro Zeile.

## Quelle und Lizenz der Nährwerte

Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0. Lizenz: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Die Daten wurden auf sieben Nährwerte reduziert und gerundet.
