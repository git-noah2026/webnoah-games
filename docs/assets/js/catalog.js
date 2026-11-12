// WebNoah-Games: Spielekatalog. Neues Spiel = Eintrag hier + Ordner spiele/<id>/ (siehe README).
// ext: Spiel liegt woanders und wird in einem neuen Tab geöffnet.
window.WNG_GAMES = [
  {
    id: "minigolf", name: "Minigolf", isNew: true, mins: 6, players: "1 Spieler", spotlight: 0,
    cats: ["Geschicklichkeit", "Action"],
    desc: "Sechs Bahnen unterm Sternenhimmel: Banden, Sand, Teiche und ein Pendel.",
    long: "Zieh vom Ball weg, wähl die Stärke, lass los. Sechs eigene Bahnen mit Banden, Sandkasten, Teich und beweglicher Sperre. Wer Wasser trifft, zahlt einen Strafschlag.",
    controls: "Ziehen · Pfeile + Leertaste", scoreLabel: "Schläge", better: "low", unit: "Schläge",
    help: "Vom Ball weg ziehen und loslassen, je weiter, desto fester. Tastatur: ← → zielen, ↑ ↓ Stärke, Leertaste schlagen. Wasser kostet einen Strafschlag, nach 8 Schlägen wird der Ball aufgehoben. Deine Runde wird nach jeder Bahn gespeichert."
  },
  {
    id: "rennen", name: "Kometenrennen", isNew: true, mins: 10, players: "2–4 Spieler", spotlight: 1,
    cats: ["Karten & Brett", "Zu zweit", "Strategie"],
    desc: "Würfeln, Wurmlöcher nutzen, Kometen ausweichen. Gegen Computer oder zu viert.",
    long: "Zwei Raketen pro Farbe, eine Runde mit 40 Feldern. Sterne schieben dich vor, Wurmlöcher werfen dich quer übers Brett, Kometen zurück. Wer auf einer fremden Rakete landet, schickt sie heim.",
    controls: "Klick · Leertaste · 1/2", scoreLabel: "Siege", bestLabel: "Siege", better: "high", unit: "",
    help: "Würfeln mit Knopf, Klick auf den Würfel oder Leertaste. Dann eine leuchtende Rakete antippen (oder 1/2 drücken). ★ bringt drei Felder, ◎ springt zum anderen Wurmloch, ☄ wirft vier Felder zurück. Eine 6 gibt einen Extrawurf. Gezählt werden deine Siege gegen den Computer."
  },
  {
    id: "solitaer", name: "Solitär", isNew: true, mins: 8, players: "1 Spieler",
    cats: ["Karten & Brett", "Denkspiele"],
    desc: "Der Kartenklassiker: Spalten abwechselnd nach Farbe ordnen, Asse ablegen.",
    controls: "Ziehen · Tippen · Leertaste", scoreLabel: "Sekunden", better: "low", unit: "s",
    help: "Karte antippen legt sie automatisch an die beste Stelle, oder zieh sie hin. Spalten: abwechselnd rot und schwarz, absteigend. Leere Spalten nur mit König. Stapel antippen oder Leertaste zieht eine Karte, Z macht rückgängig. Gewertet wird die Zeit."
  },
  {
    id: "schiffe", name: "Schiffe versenken", isNew: true, mins: 7, players: "1 Spieler",
    cats: ["Strategie", "Denkspiele"],
    desc: "Flotte aufstellen und die des Computers finden, bevor er deine findet.",
    controls: "Klick · R zum Drehen", scoreLabel: "Schüsse", better: "low", unit: "Schüsse",
    help: "Stell deine fünf Schiffe auf (R oder Knopf dreht, ein Klick auf das letzte Schiff nimmt es wieder auf) oder lass sie zufällig verteilen. Schiffe berühren sich nicht. Ein Treffer gibt einen weiteren Schuss. Gewertet wird, mit wie wenigen Schüssen du gewinnst."
  },
  {
    id: "schlange", name: "Schlange", mins: 4, players: "1 Spieler",
    cats: ["Action", "Kurze Spiele", "Geschicklichkeit"],
    desc: "Futter sammeln, länger werden, nicht in die Wand fahren.",
    controls: "Pfeile · WASD · Wischen", scoreLabel: "Punkte", better: "high", unit: "P.",
    help: "Pfeiltasten oder WASD lenken, die Leertaste pausiert. Am Handy wischen oder die Pfeile unter dem Feld nutzen."
  },
  {
    id: "memory", name: "Fächer-Memory", mins: 3, players: "1 Spieler",
    cats: ["Denkspiele", "Kurze Spiele"],
    desc: "Acht Fächer-Paare aufdecken. Wer braucht die wenigsten Züge?",
    controls: "Klick · Touch", scoreLabel: "Züge", better: "low", unit: "Züge",
    help: "Ein Zug sind zwei aufgedeckte Karten. Weniger Züge sind besser."
  },
  {
    id: "vier", name: "Vier in einer Reihe", mins: 6, players: "1–2 Spieler",
    cats: ["Strategie", "Denkspiele", "Zu zweit"],
    desc: "Gegen den Computer oder zu zweit am selben Gerät.",
    long: "Steine fallen in die Spalte, die du wählst. Vier gleiche in einer Linie gewinnen, waagrecht, senkrecht oder schräg. Der Computer denkt fünf Züge voraus.",
    controls: "Klick · Tasten 1–7", scoreLabel: "Stand", bestLabel: "Siege", better: "high", unit: "",
    help: "Steine fallen nach unten. Vier gleiche waagrecht, senkrecht oder schräg gewinnen. Gezählt werden deine Siege gegen den Computer."
  },
  {
    id: "minen", name: "Minenfeld", mins: 8, players: "1 Spieler", variant: "klein", variantLabel: "9×9",
    cats: ["Logik", "Denkspiele"],
    desc: "Zahlen verraten, wie viele Minen angrenzen. Räum das Feld.",
    controls: "Klick · Rechtsklick · Halten", scoreLabel: "Sekunden", better: "low", unit: "s",
    help: "Rechtsklick oder lange drücken setzt eine Flagge. Ein Klick auf eine Zahl mit passend vielen Flaggen deckt die Nachbarfelder auf. Der erste Klick ist immer sicher."
  },
  {
    id: "ziegel", name: "Ziegelbrecher", mins: 10, players: "1 Spieler",
    cats: ["Action", "Geschicklichkeit"],
    desc: "Ball abprallen lassen, Ziegel abräumen, Level steigern.",
    long: "Drei Bälle, fünf Reihen Ziegel. Wo der Ball den Schläger trifft, bestimmt den Winkel. Jedes Level wird schneller und jeder Ziegel zählt mehr.",
    controls: "Maus · Finger · Pfeile", scoreLabel: "Punkte", better: "high", unit: "P.",
    help: "Wo der Ball den Schläger trifft, bestimmt den Abprallwinkel. Ziegel zählen in höheren Levels mehr."
  },
  {
    id: "reaktion", name: "Reaktionstest", mins: 1, players: "1 Spieler",
    cats: ["Kurze Spiele", "Geschicklichkeit"],
    desc: "Fünf Runden auf Grün warten. Gemessen in Millisekunden.",
    controls: "Klick · Touch · Leertaste", scoreLabel: "Schnitt", better: "low", unit: "ms",
    help: "Gewertet wird der Durchschnitt aus fünf Runden. Zu frühes Tippen wiederholt die Runde."
  },
  {
    id: "adlige", name: "Krieg der Adligen", mins: 15, players: "1–2 Spieler", spotlight: 2,
    ext: "https://games.webnoah.andrerer.org/krieg-der-adeligen/index.html",
    cats: ["Strategie", "Zu zweit", "Karten & Brett"],
    desc: "Strategie auf dem Brett. Zu zweit oder gegen die KI in drei Stufen.",
    long: "Das Brettspiel-Original von WebNoah-Games. Spiel lokal zu zweit oder gegen die KI, wähle deine Farbe und eine von drei Stärken.",
    controls: "Klick · Touch"
  },
  {
    id: "sudoku", name: "Sudoku Solver", mins: 5, players: "1 Spieler",
    ext: "https://games.webnoah.andrerer.org/sudoku-solver/index.html",
    cats: ["Logik", "Denkspiele"],
    desc: "Rätsel eintippen und von der Sudoku-Engine lösen lassen.",
    controls: "Klick · Tastatur"
  }
];
