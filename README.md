# WebNoah-Games

Browser-Spiele für die Pause. Ohne Konto, ohne Werbung, ohne Build-Schritt.
Ein Projekt der WebNoah Services GmbH, aus der WebNoah+ Familie.

## Spiele

| Spiel | Ordner | Kategorie |
| --- | --- | --- |
| Schlange | `docs/spiele/schlange/` | Action, Kurze Spiele |
| Fächer-Memory | `docs/spiele/faecher-memory/` | Denkspiele |
| Vier in einer Reihe | `docs/spiele/vier-in-einer-reihe/` | Strategie, Zu zweit |
| Minenfeld | `docs/spiele/minenfeld/` | Logik |
| Ziegelbrecher | `docs/spiele/ziegelbrecher/` | Action, Geschicklichkeit |
| Reaktionstest | `docs/spiele/reaktionstest/` | Kurze Spiele |
| Minigolf | `docs/spiele/minigolf/` | Geschicklichkeit |
| Kometenrennen | `docs/spiele/kometenrennen/` | Karten & Brett, Zu zweit |
| Solitär | `docs/spiele/solitaer/` | Karten & Brett |
| Schiffe versenken | `docs/spiele/schiffe-versenken/` | Strategie |
| Mühle | `docs/spiele/muehle/` | Karten & Brett, Zu zweit |
| Sudoku (3 Stufen) | `docs/spiele/sudoku/` | Logik |
| Wortjagd | `docs/spiele/wortjagd/` | Denkspiele |
| Andersfarbig | `docs/spiele/andersfarbig/` | Kurze Spiele |
| Reichenspiel | `docs/spiele/reichenspiel/` | Karten & Brett, Strategie |
| Steine schmeißen | `docs/spiele/steine-schmeissen/` | Action |
| Heast chü amoi | `docs/spiele/heast-chue-amoi/` | Karten & Brett, Zu zweit |
| Hüpfer | `docs/spiele/huepfer/` | Action, Kurze Spiele |
| Krieg der Adligen | extern auf games.webnoah.andrerer.org | Strategie |
| Sudoku Solver | extern auf games.webnoah.andrerer.org | Logik |

Ohne Konto speichert der Browser Rekorde und Favoriten in `localStorage`. Mit Konto landen sie zusätzlich in der Datenbank und sind auf jedem Gerät da.

## Konten

- Anmeldung mit Benutzername und Passwort, ohne E-Mail. Registrieren kann sich jeder.
- Mit Konto: Rekorde und Favoriten auf allen Geräten, Spielstand (Ziegelbrecher merkt sich das Level), Bestenliste pro Spiel, Profilseite unter `/profil/?u=name`.
- Passwörter werden mit PBKDF2-SHA256 (100 000 Runden, eigenes Salt) gespeichert. Die Sitzung liegt in einem HttpOnly-Cookie, in der Datenbank steht nur ein Hash davon.
- Jedes Konto kann sich im Profil selbst löschen. Dabei werden alle Daten auf dem Server entfernt.
- Passwort vergessen: Es gibt keinen automatischen Reset. Ein Admin kann das Konto in der D1-Konsole von Cloudflare löschen, dann kann sich die Person neu registrieren.
- Die API läuft nur auf Cloudflare. Auf GitHub Pages fehlt sie, dort bleibt alles lokal und der Anmelde-Knopf ist ausgeblendet.

Die Tabellen legt der Worker beim ersten Aufruf selbst an (`src/worker.js`, Konstante `SCHEMA`).

## Admin-Portal

Unter `/admin/` (nur auf Cloudflare, nicht auf GitHub Pages).

- **Übersicht:** Konten, Aktive in 24 h, Partien, Rekorde, Sitzungen, Sperren, neue Konten der letzten 30 Tage, Partien pro Spiel, fleißigste Spieler, neueste Konten.
- **Nutzer:** Suche, Filter (aktiv, Admins, gesperrt), Sortierung, CSV-Export. Pro Konto: Anzeigename ändern, zum Admin ernennen oder zurückstufen, sperren mit Grund, überall abmelden, temporäres Passwort erzeugen, einzelne oder alle Rekorde löschen, Konto löschen.
- **Bestenlisten:** alle Einträge pro Spiel prüfen und löschen, gesperrte Konten sind markiert.
- **Inhalte:** Ankündigungsleiste für alle Seiten (Info, Neuigkeit, Warnung) und Spiele pausieren.
- **Protokoll:** jede Admin-Aktion mit Zeitpunkt, Admin, Konto und Details.

**Haupt-Admin einrichten:** In Cloudflare unter *Workers & Pages → webnoah-games → Settings → Variables and Secrets* eine Variable `ADMIN_USERS` mit deinem Benutzernamen anlegen (mehrere mit Komma). Diese Konten sind immer Admin und können weder gesperrt noch gelöscht noch zurückgestuft werden. `keep_vars` in `wrangler.jsonc` sorgt dafür, dass die Variable beim Deploy erhalten bleibt. Weitere Admins ernennst du im Portal.

Lokal: Datei `.dev.vars` mit `ADMIN_USERS=deinname` anlegen (steht in `.gitignore`).

## Lokal starten

Die Seite besteht nur aus HTML, CSS und JavaScript im Ordner `docs/`. Ein einfacher Webserver reicht:

```bash
npx serve docs
```

oder

```bash
python -m http.server 8000 -d docs
```

Dann `http://localhost:8000` öffnen. Mit Konten, API und lokaler Datenbank: `npx wrangler dev --persist-to %TEMP%/wng-state`, danach `http://localhost:8787`. Der Zustand liegt bewusst außerhalb des Projekts, weil OneDrive die SQLite-Dateien sonst sperrt. Die Fehlerseite `404.html` nutzt absolute Pfade und funktioniert deshalb nur, wenn die Seite im Root einer Domain liegt.

## Aufbau

```
src/worker.js              API für Konten, Rekorde, Bestenliste (Cloudflare Worker + D1)
wrangler.jsonc             Cloudflare-Konfiguration
docs/index.html            Startseite: Bühne mit Rampenlicht, Bibliothek mit Suche und Kategorien, Ruhmeshalle
docs/404.html              Fehlerseite für GitHub Pages
docs/assets/css/site.css   gemeinsames Design (Farben, Schriften, alle Bausteine)
docs/assets/js/core.js     Helfer, Speicher, Kopf- und Fußzeile
docs/assets/js/catalog.js  Spielekatalog (Name, Kategorien, Dauer, Wertung)
docs/assets/js/previews.js animierte Vorschauen für die Karten
docs/assets/js/cards.js    Spielkarte mit Vorschau, Favorit und Rekord
docs/assets/js/hub.js      Logik der Startseite
docs/assets/js/auth.js     Anmelden, Registrieren, Abgleich mit dem Server
docs/assets/js/shell.js    Rahmen jeder Spielseite (Punkte, Rekord, Tasten, Bestenliste)
docs/profil/               Profilseite
docs/bestenliste/          Bestenlisten aller Spiele
docs/admin/                Admin-Portal
docs/spiele/<name>/        eine Seite pro Spiel: index.html + <name>.js (Vollbild, nur Zurück-Symbol)
docs/_redirects            leitet alte Spieladressen auf die neuen Namen um (Cloudflare)
```

## Neues Spiel hinzufügen

1. Ordner `docs/spiele/<name>/` anlegen (Name wie das Spiel, klein, mit Bindestrichen) und `index.html` aus einem bestehenden Spiel kopieren. `data-game="<id>"`, den Titel und das Skript `<name>.js` anpassen.
2. In `docs/spiele/<name>/<name>.js` eine Funktion `WNG.games.<id> = function (stage, ui) { … }` anlegen. `stage` ist der Spielbereich, `ui` bietet:
   - `ui.score(wert)` und `ui.status(text, notiz)` für Anzeige und Statuszeile
   - `ui.submit(wert, variante)` speichert einen Rekord und liefert `true`, wenn er neu ist
   - `ui.onKey(fn)`, `ui.onKeyUp(fn)`, `ui.onRestart(fn)` für Tasten und den Neu-starten-Knopf
   - `ui.tools` als Platz für Umschalter über dem Spielfeld
   Die Funktion darf eine Aufräumfunktion zurückgeben.
3. Einen Eintrag in `docs/assets/js/catalog.js` ergänzen, mit `id` (interne Kennung für Rekorde, nie ändern) und `slug` (Ordnername) (`better: "high"` oder `"low"`). Spiele mit getrennten Bestenlisten pro Stufe bekommen `variants: [["id", "Name"], …]` und `variant` für die Standardstufe. Für die Bestenliste das Spiel auch in `GAMES` in `src/worker.js` eintragen (mit erlaubtem Wertebereich).
4. Optional eine Vorschau in `docs/assets/js/previews.js` unter `PREVIEW.<id>` zeichnen.

## Veröffentlichen

**Cloudflare Workers:** Das Repo ist in Cloudflare unter *Workers & Pages → Create → Import a repository* verbunden. `wrangler.jsonc` liefert den Ordner `docs/` als statische Seite aus, ein Build-Schritt ist nicht nötig (Build command leer lassen, Deploy command `npx wrangler deploy`). Jeder Push auf `main` wird automatisch veröffentlicht. Eine eigene Domain kommt im Worker unter *Settings → Domains & Routes* dazu.

**GitHub Pages:** veröffentlicht den Ordner `docs/` aus dem `main`-Branch zusätzlich auf https://git-noah2026.github.io/webnoah-games/.

## Fehler und Ideen

Bitte als [Issue](https://github.com/git-noah2026/webnoah-games/issues) melden.
