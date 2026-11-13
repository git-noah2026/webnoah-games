// WebNoah-Games: Andersfarbig. 60 Sekunden lang das Feld mit dem anderen Farbton finden. Wird von assets/js/shell.js gestartet.
// Jede Runde wird das Gitter größer und der Unterschied kleiner. Falsch getippt kostet 3 Sekunden.
(() => {
  "use strict";
  const { h, rnd } = WNG;
  const TIME = 60;

  function mountFarbton(stage, ui) {
    const wrap = h("div", "ft");
    wrap.innerHTML = `<div class="ft-bar"><i></i></div><div class="ft-grid" role="grid" aria-label="Farbfelder"></div>
      <div class="ft-start"><b class="display">Andersfarbig</b><p>Ein Feld hat einen anderen Farbton. Finde es so oft wie möglich in 60 Sekunden. Falsch kostet 3 Sekunden.</p>
      <button class="btn primary big" type="button">Start</button></div>`;
    stage.append(wrap);
    const grid = wrap.querySelector(".ft-grid"), bar = wrap.querySelector(".ft-bar i"), start = wrap.querySelector(".ft-start");
    let level, score, endAt, timer, odd, running = false, penaltyUntil = 0;

    const size = l => Math.min(8, 2 + Math.floor((l + 1) / 2));
    const delta = l => Math.max(3.2, 22 - l * 1.05);

    function round() {
      const n = size(level), d = delta(level);
      const hue = rnd(360), sat = 48 + rnd(30), light = 40 + rnd(22);
      const sign = light > 52 ? -1 : 1;
      odd = rnd(n * n);
      grid.style.setProperty("--n", n);
      grid.innerHTML = Array.from({ length: n * n }, (_, i) =>
        `<button type="button" class="ft-cell" data-i="${i}" style="background:hsl(${hue} ${sat}% ${i === odd ? light + sign * d : light}%)" aria-label="Feld ${i + 1}"></button>`).join("");
    }
    function tick() {
      const left = Math.max(0, endAt - Date.now());
      bar.style.transform = `scaleX(${left / (TIME * 1000)})`;
      bar.parentElement.classList.toggle("low", left < 10000);
      ui.status(`${Math.ceil(left / 1000)} Sekunden · Runde ${level + 1} · ${size(level)} × ${size(level)}`);
      if (!left) end();
    }
    function begin() {
      level = 0; score = 0; ui.score(0); running = true;
      start.hidden = true; wrap.classList.add("on");
      endAt = Date.now() + TIME * 1000;
      round(); clearInterval(timer); timer = setInterval(tick, 100); tick();
    }
    function end() {
      running = false; clearInterval(timer); wrap.classList.remove("on");
      const rec = ui.submit(score);
      grid.querySelector(`[data-i="${odd}"]`)?.classList.add("reveal");
      start.innerHTML = `<b class="display">${score} ${score === 1 ? "Treffer" : "Treffer"}</b>
        <p>${score >= 30 ? "Adleraugen!" : score >= 18 ? "Starke Leistung." : "Da geht noch was."} Das letzte gesuchte Feld ist markiert.</p>
        <button class="btn primary big" type="button">Nochmal</button>`;
      start.querySelector("button").onclick = begin;
      start.hidden = false;
      ui.status(`Zeit um. ${score} Felder gefunden.`, rec && score > 0 ? "Neuer Rekord!" : "");
    }
    grid.addEventListener("pointerdown", e => {
      const b = e.target.closest(".ft-cell"); if (!b || !running) return;
      e.preventDefault();
      if (+b.dataset.i === odd) { score++; level++; ui.score(score); round(); }
      else {
        if (Date.now() < penaltyUntil) return;
        penaltyUntil = Date.now() + 250;
        endAt -= 3000; b.classList.remove("nope"); void b.offsetWidth; b.classList.add("nope");
        wrap.classList.remove("hurt"); void wrap.offsetWidth; wrap.classList.add("hurt");
        tick();
      }
    });
    start.querySelector("button").onclick = begin;
    ui.onKey(e => { if ((e.key === " " || e.key === "Enter") && !running) { e.preventDefault(); begin(); } });
    ui.onRestart(() => { clearInterval(timer); running = false; begin(); });
    ui.score(0); ui.status("Tippe auf Start.");
    level = 0; round();
    return () => clearInterval(timer);
  }

  WNG.games.farbton = mountFarbton;
})();
