// WebNoah-Games: Spielekatalog. Neues Spiel = Eintrag hier + Ordner spiele/<slug>/ mit <slug>.js (siehe README).
// id: interne Kennung für Rekorde und Datenbank (nie ändern). slug: Name in Adresse und Dateien.
// ext: Spiel liegt woanders und wird in einem neuen Tab geöffnet.
window.WNG_GAMES = [
  {
    id: "reich", slug: "reichenspiel", name: "Reichenspiel", isNew: true, mins: 20, players: "2–4 Spieler", spotlight: 0,
    cats: ["Karten & Brett", "Strategie", "Zu zweit"],
    desc: "Firmen gründen, Branchen ausbauen, Marktnachrichten überstehen. Wer wird am reichsten?",
    long: "Ein eigenes Wirtschafts-Brettspiel: Würfle ums Brett, gründe Firmen vom Würstelstand bis zum Raumfahrt-Start-up, bau ganze Branchen aus und kassier mit. Finanzamt, Glückstopf und Marktnachrichten mischen mit. Nach 20 Runden zählt das Vermögen.",
    controls: "Klick · Leertaste", scoreLabel: "Siege", bestLabel: "Siege", better: "high", unit: "",
    help: "Würfeln, dann freie Firmen gründen oder liegen lassen. Wer auf deiner Firma landet, zahlt dir mit, doppelt bei kompletter Branche. Mit kompletter Branche kannst du bis Stufe 3 ausbauen. Wer pleite ist, scheidet aus. Gezählt werden deine Siege gegen den Computer."
  },
  {
    id: "steine", slug: "steine-schmeissen", name: "Steine schmeißen", isNew: true, mins: 6, players: "1 Spieler", spotlight: 1,
    cats: ["Action", "Geschicklichkeit"],
    desc: "Fallende Brocken stapeln, volle Reihen räumen. Der Goldstein sprengt seine Reihe.",
    long: "Acht eigene Steinformen aus drei und fünf Feldern fallen in einen elf Felder breiten Schacht. Volle Reihen verschwinden, Serien bringen Bonus, und ab und zu kommt ein Goldstein, der seine ganze Reihe sprengt.",
    controls: "Pfeile · Leertaste · Wischen", scoreLabel: "Punkte", better: "high", unit: "P.",
    help: "← → schieben, ↑ drehen, ↓ schneller, Leertaste schmeißt den Stein ganz nach unten, P pausiert. Am Handy: tippen dreht, seitlich wischen schiebt, nach unten wischen schmeißt, oder die Knöpfe nutzen."
  },
  {
    id: "heast", slug: "heast-chue-amoi", name: "Heast chü amoi", isNew: true, mins: 15, players: "2–4 Spieler", spotlight: 2,
    cats: ["Karten & Brett", "Zu zweit"],
    desc: "Würfeln, rausschmeißen, heimbringen. Auf einem runden Brett, mit Schmäh.",
    long: "Vier Figuren pro Farbe, mit einer 6 raus aus dem Haus, einmal ums runde Brett und ab ins Ziel. Wer auf einer fremden Figur landet, schickt sie heim, und die bekommt ihren Kommentar dazu.",
    controls: "Klick · Leertaste · 1–4", scoreLabel: "Siege", bestLabel: "Siege", better: "high", unit: "",
    help: "Würfeln, dann eine leuchtende Figur antippen (oder 1–4 drücken). Mit einer 6 kommt eine Figur aus dem Haus, und du würfelst nochmal. Ist keine Figur draußen, hast du drei Versuche. Ins Ziel genau einziehen, eigene Figuren werden nicht übersprungen. Gezählt werden deine Siege gegen den Computer."
  },
  {
    id: "huepfer", slug: "huepfer", name: "Hüpfer", isNew: true, mins: 2, players: "1 Spieler",
    cats: ["Action", "Kurze Spiele", "Geschicklichkeit"],
    desc: "Endlos laufen, über Kristalle springen, unter Satelliten ducken, Sterne sammeln.",
    controls: "Leertaste · Tippen · ↓", scoreLabel: "Punkte", better: "high", unit: "P.",
    help: "Leertaste, ↑ oder Tippen springt, zweimal schnell für einen Doppelsprung. ↓ oder nach unten wischen duckt dich unter Satelliten. Jeder Stern bringt 25 Punkte extra."
  },
  {
    id: "muehle", slug: "muehle", name: "Mühle", mins: 12, players: "1–2 Spieler",
    cats: ["Karten & Brett", "Strategie", "Zu zweit"],
    desc: "Der Brettspiel-Klassiker: Mühlen bauen, Steine nehmen, den Gegner einsperren.",
    long: "Neun Steine setzen, dann ziehen und am Ende springen. Drei in einer Reihe sind eine Mühle und kosten den Gegner einen Stein. Gegen einen Computer, der vier Züge vorausdenkt, oder zu zweit.",
    controls: "Klick · Touch", scoreLabel: "Siege", bestLabel: "Siege", better: "high", unit: "",
    help: "Setzphase: freies Feld antippen. Zugphase: eigenen Stein wählen, dann ein Nachbarfeld. Mit drei Steinen darfst du springen. Nach einer Mühle einen rot markierten Stein antippen. 60 Züge ohne Schlag sind unentschieden. Gezählt werden deine Siege gegen den Computer."
  },
  {
    id: "sudoku9", slug: "sudoku", name: "Sudoku", mins: 15, players: "1 Spieler",
    variant: "leicht", variantLabel: "Leicht", variants: [["leicht", "Leicht"], ["mittel", "Mittel"], ["schwer", "Schwer"]],
    cats: ["Logik", "Denkspiele"],
    desc: "Jedes Rätsel frisch erzeugt, mit genau einer Lösung. Drei Stufen, Notizen, Tipps.",
    long: "Jedes Rätsel wird neu gebaut und hat genau eine Lösung. Leicht, mittel oder schwer, mit Notizen für Kandidaten, Tipps gegen Zeitstrafe und automatisch gespeichertem Spielstand.",
    controls: "Klick · Ziffern · Pfeile", scoreLabel: "Sekunden", better: "low", unit: "s",
    help: "Feld wählen, Zahl tippen (oder Ziffer drücken). N schaltet Notizen um, Pfeiltasten bewegen die Auswahl. Rot heißt: doppelt in Zeile, Spalte oder Block. Ein Tipp kostet 30 Sekunden. Rekorde gibt es pro Stufe."
  },
  {
    id: "wortjagd", slug: "wortjagd", name: "Wortjagd", mins: 5, players: "1 Spieler",
    cats: ["Denkspiele", "Kurze Spiele"],
    desc: "Zehn Wörter zu einem Thema im Buchstabengitter, kreuz und quer und rückwärts.",
    controls: "Ziehen · Tippen", scoreLabel: "Sekunden", better: "low", unit: "s",
    help: "Über ein Wort ziehen oder erst den Anfang, dann das Ende antippen. Wörter liegen waagrecht, senkrecht und schräg, auch rückwärts. Gewertet wird die Zeit."
  },
  {
    id: "farbton", slug: "andersfarbig", name: "Andersfarbig", mins: 1, players: "1 Spieler",
    cats: ["Kurze Spiele", "Geschicklichkeit"],
    desc: "Ein Feld hat einen anderen Farbton. Wie viele findest du in 60 Sekunden?",
    controls: "Klick · Touch", scoreLabel: "Treffer", better: "high", unit: "Treffer",
    help: "Tipp auf das Feld, das anders aussieht. Jede Runde wird das Gitter größer und der Unterschied kleiner. Falsch getippt kostet 3 Sekunden."
  },
  {
    id: "minigolf", slug: "minigolf", name: "Minigolf", mins: 6, players: "1 Spieler",
    cats: ["Geschicklichkeit", "Action"],
    desc: "Sechs Bahnen unterm Sternenhimmel: Banden, Sand, Teiche und ein Pendel.",
    long: "Zieh vom Ball weg, wähl die Stärke, lass los. Sechs eigene Bahnen mit Banden, Sandkasten, Teich und beweglicher Sperre. Wer Wasser trifft, zahlt einen Strafschlag.",
    controls: "Ziehen · Pfeile + Leertaste", scoreLabel: "Schläge", better: "low", unit: "Schläge",
    help: "Vom Ball weg ziehen und loslassen, je weiter, desto fester. Tastatur: ← → zielen, ↑ ↓ Stärke, Leertaste schlagen. Wasser kostet einen Strafschlag, nach 8 Schlägen wird der Ball aufgehoben. Deine Runde wird nach jeder Bahn gespeichert."
  },
  {
    id: "rennen", slug: "kometenrennen", name: "Kometenrennen", mins: 10, players: "2–4 Spieler",
    cats: ["Karten & Brett", "Zu zweit", "Strategie"],
    desc: "Würfeln, Wurmlöcher nutzen, Kometen ausweichen. Gegen Computer oder zu viert.",
    long: "Zwei Raketen pro Farbe, eine Runde mit 40 Feldern. Sterne schieben dich vor, Wurmlöcher werfen dich quer übers Brett, Kometen zurück. Wer auf einer fremden Rakete landet, schickt sie heim.",
    controls: "Klick · Leertaste · 1/2", scoreLabel: "Siege", bestLabel: "Siege", better: "high", unit: "",
    help: "Würfeln mit Knopf, Klick auf den Würfel oder Leertaste. Dann eine leuchtende Rakete antippen (oder 1/2 drücken). ★ bringt drei Felder, ◎ springt zum anderen Wurmloch, ☄ wirft vier Felder zurück. Eine 6 gibt einen Extrawurf. Gezählt werden deine Siege gegen den Computer."
  },
  {
    id: "solitaer", slug: "solitaer", name: "Solitär", mins: 8, players: "1 Spieler",
    cats: ["Karten & Brett", "Denkspiele"],
    desc: "Der Kartenklassiker: Spalten abwechselnd nach Farbe ordnen, Asse ablegen.",
    controls: "Ziehen · Tippen · Leertaste", scoreLabel: "Sekunden", better: "low", unit: "s",
    help: "Karte antippen legt sie automatisch an die beste Stelle, oder zieh sie hin. Spalten: abwechselnd rot und schwarz, absteigend. Leere Spalten nur mit König. Stapel antippen oder Leertaste zieht eine Karte, Z macht rückgängig. Gewertet wird die Zeit."
  },
  {
    id: "schiffe", slug: "schiffe-versenken", name: "Schiffe versenken", mins: 7, players: "1 Spieler",
    cats: ["Strategie", "Denkspiele"],
    desc: "Flotte aufstellen und die des Computers finden, bevor er deine findet.",
    controls: "Klick · R zum Drehen", scoreLabel: "Schüsse", better: "low", unit: "Schüsse",
    help: "Stell deine fünf Schiffe auf (R oder Knopf dreht, ein Klick auf das letzte Schiff nimmt es wieder auf) oder lass sie zufällig verteilen. Schiffe berühren sich nicht. Ein Treffer gibt einen weiteren Schuss. Gewertet wird, mit wie wenigen Schüssen du gewinnst."
  },
  {
    id: "schlange", slug: "schlange", name: "Schlange", mins: 4, players: "1 Spieler",
    cats: ["Action", "Kurze Spiele", "Geschicklichkeit"],
    desc: "Futter sammeln, länger werden, nicht in die Wand fahren.",
    controls: "Pfeile · WASD · Wischen", scoreLabel: "Punkte", better: "high", unit: "P.",
    help: "Pfeiltasten oder WASD lenken, die Leertaste pausiert. Am Handy wischen oder die Pfeile unter dem Feld nutzen."
  },
  {
    id: "memory", slug: "faecher-memory", name: "Fächer-Memory", mins: 3, players: "1 Spieler",
    cats: ["Denkspiele", "Kurze Spiele"],
    desc: "Acht Fächer-Paare aufdecken. Wer braucht die wenigsten Züge?",
    controls: "Klick · Touch", scoreLabel: "Züge", better: "low", unit: "Züge",
    help: "Ein Zug sind zwei aufgedeckte Karten. Weniger Züge sind besser."
  },
  {
    id: "vier", slug: "vier-in-einer-reihe", name: "Vier in einer Reihe", mins: 6, players: "1–2 Spieler",
    cats: ["Strategie", "Denkspiele", "Zu zweit"],
    desc: "Gegen den Computer oder zu zweit am selben Gerät.",
    long: "Steine fallen in die Spalte, die du wählst. Vier gleiche in einer Linie gewinnen, waagrecht, senkrecht oder schräg. Der Computer denkt fünf Züge voraus.",
    controls: "Klick · Tasten 1–7", scoreLabel: "Stand", bestLabel: "Siege", better: "high", unit: "",
    help: "Steine fallen nach unten. Vier gleiche waagrecht, senkrecht oder schräg gewinnen. Gezählt werden deine Siege gegen den Computer."
  },
  {
    id: "minen", slug: "minenfeld", name: "Minenfeld", mins: 8, players: "1 Spieler", variant: "klein", variantLabel: "9×9", variants: [["klein", "9 × 9"], ["mittel", "12 × 12"]],
    cats: ["Logik", "Denkspiele"],
    desc: "Zahlen verraten, wie viele Minen angrenzen. Räum das Feld.",
    controls: "Klick · Rechtsklick · Halten", scoreLabel: "Sekunden", better: "low", unit: "s",
    help: "Rechtsklick oder lange drücken setzt eine Flagge. Ein Klick auf eine Zahl mit passend vielen Flaggen deckt die Nachbarfelder auf. Der erste Klick ist immer sicher."
  },
  {
    id: "ziegel", slug: "ziegelbrecher", name: "Ziegelbrecher", mins: 10, players: "1 Spieler",
    cats: ["Action", "Geschicklichkeit"],
    desc: "Ball abprallen lassen, Ziegel abräumen, Level steigern.",
    long: "Drei Bälle, fünf Reihen Ziegel. Wo der Ball den Schläger trifft, bestimmt den Winkel. Jedes Level wird schneller und jeder Ziegel zählt mehr.",
    controls: "Maus · Finger · Pfeile", scoreLabel: "Punkte", better: "high", unit: "P.",
    help: "Wo der Ball den Schläger trifft, bestimmt den Abprallwinkel. Ziegel zählen in höheren Levels mehr."
  },
  {
    id: "reaktion", slug: "reaktionstest", name: "Reaktionstest", mins: 1, players: "1 Spieler",
    cats: ["Kurze Spiele", "Geschicklichkeit"],
    desc: "Fünf Runden auf Grün warten. Gemessen in Millisekunden.",
    controls: "Klick · Touch · Leertaste", scoreLabel: "Schnitt", better: "low", unit: "ms",
    help: "Gewertet wird der Durchschnitt aus fünf Runden. Zu frühes Tippen wiederholt die Runde."
  },
  {
    id: "adlige", name: "Krieg der Adligen", mins: 15, players: "1–2 Spieler",
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
