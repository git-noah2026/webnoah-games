# WebNoah-Games

Browser-Spiele für die Pause. Ohne Konto, ohne Werbung, ohne Build-Schritt.
Ein Projekt der WebNoah Services GmbH, aus der WebNoah+ Familie.

## Spiele

| Spiel | Ordner | Kategorie |
| --- | --- | --- |
| Schlange | `spiele/schlange/` | Action, Kurze Spiele |
| Fächer-Memory | `spiele/memory/` | Denkspiele |
| Vier in einer Reihe | `spiele/vier/` | Strategie, Zu zweit |
| Minenfeld | `spiele/minen/` | Logik |
| Ziegelbrecher | `spiele/ziegel/` | Action, Geschicklichkeit |
| Reaktionstest | `spiele/reaktion/` | Kurze Spiele |
| Krieg der Adligen | extern auf games.webnoah.andrerer.org | Strategie |
| Sudoku Solver | extern auf games.webnoah.andrerer.org | Logik |

Rekorde und Favoriten speichert der Browser in `localStorage`. Es gibt keinen Server und kein Tracking.

## Lokal starten

Die Seite besteht nur aus HTML, CSS und JavaScript. Ein einfacher Webserver im Projektordner reicht:

```bash
npx serve .
```

oder

```bash
python -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Die Fehlerseite `404.html` nutzt absolute Pfade und funktioniert deshalb nur, wenn die Seite im Root einer Domain liegt.

## Aufbau

```
index.html            Startseite: Rampenlicht, Pausenplan, Suche, Kategorien, Favoriten
404.html              Fehlerseite für GitHub Pages
assets/css/site.css   gemeinsames Design (Farben, Schriften, alle Bausteine)
assets/js/core.js     Helfer, Speicher, Kopf- und Fußzeile
assets/js/catalog.js  Spielekatalog (Name, Kategorien, Dauer, Wertung)
assets/js/previews.js animierte Vorschauen für die Karten
assets/js/cards.js    Spielkarte mit Vorschau, Favorit und Rekord
assets/js/hub.js      Logik der Startseite
assets/js/shell.js    Rahmen jeder Spielseite (Punkte, Rekord, Tasten)
spiele/<id>/          eine Seite pro Spiel: index.html + game.js
```

## Neues Spiel hinzufügen

1. Ordner `spiele/<id>/` anlegen und `index.html` aus einem bestehenden Spiel kopieren. `data-game="<id>"` und den Titel anpassen.
2. In `spiele/<id>/game.js` eine Funktion `WNG.games.<id> = function (stage, ui) { … }` anlegen. `stage` ist der Spielbereich, `ui` bietet:
   - `ui.score(wert)` und `ui.status(text, notiz)` für Anzeige und Statuszeile
   - `ui.submit(wert, variante)` speichert einen Rekord und liefert `true`, wenn er neu ist
   - `ui.onKey(fn)`, `ui.onKeyUp(fn)`, `ui.onRestart(fn)` für Tasten und den Neu-starten-Knopf
   - `ui.tools` als Platz für Umschalter über dem Spielfeld
   Die Funktion darf eine Aufräumfunktion zurückgeben.
3. Einen Eintrag in `assets/js/catalog.js` ergänzen (`better: "high"` oder `"low"`).
4. Optional eine Vorschau in `assets/js/previews.js` unter `PREVIEW.<id>` zeichnen.

## Veröffentlichen

Die Seite läuft auf GitHub Pages direkt aus dem `main`-Branch (Ordner `/`). Für eine eigene Domain eine Datei `CNAME` mit dem Domainnamen anlegen und beim DNS-Anbieter einen CNAME-Eintrag auf `git-noah2026.github.io` setzen.

## Fehler und Ideen

Bitte als [Issue](https://github.com/git-noah2026/webnoah-games/issues) melden.
