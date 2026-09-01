/* WORK - single page: header, progress minibars, daily checklist, 31 day plan accordion.
   All persistence goes through Store (store.js). */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const startScreen = $("#startScreen");
  const appShell = $("#appShell");

  const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`;
  const CHEVRON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
  const MINUS_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const PLUS_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>`;

  let expandedPhase = null; // index into PLAN_PHASES, null = all closed

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(d) {
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  function dateForDay(n) {
    const s = Store.getState();
    const d = new Date(s.startDate + "T00:00:00");
    d.setDate(d.getDate() + (n - 1));
    return d;
  }

  function phaseIndexForDay(day) {
    return PLAN_PHASES.findIndex(p => p.days.includes(day));
  }

  /* ---------- boot ---------- */

  function boot() {
    const s = Store.getState();
    if (!s.startDate) {
      startScreen.hidden = false;
      bindStartScreen();
      return;
    }
    startScreen.hidden = true;
    appShell.hidden = false;
    expandedPhase = phaseIndexForDay(currentDay());
    render();
  }

  function bindStartScreen() {
    $("#startTodayBtn").addEventListener("click", () => {
      Store.setStartDate(todayISO());
      location.reload();
    });
    $("#startPickBtn").addEventListener("click", () => {
      const row = $("#startPickRow");
      row.hidden = !row.hidden;
      if (!row.hidden) $("#startDateInput").focus();
    });
    $("#startConfirmBtn").addEventListener("click", () => {
      const v = $("#startDateInput").value;
      if (!v) return;
      if (new Date(v + "T00:00:00") > new Date(todayISO() + "T00:00:00")) return;
      Store.setStartDate(v);
      location.reload();
    });
  }

  /* ---------- render ---------- */

  function render() {
    const cur = currentDay();
    const finished = challengeFinished();

    appShell.innerHTML =
      headerHTML(cur, finished) +
      trackHTML(cur) +
      fixLineHTML(cur, finished) +
      checklistHTML(cur, finished) +
      planHTML(cur);

    bind(cur);
  }

  function headerHTML(cur, finished) {
    return `
      <p class="head-kicker">WORK<span class="dot">.</span></p>
      <h1 class="head-title">${finished ? "31 days. Done." : "Day " + cur + " of 31"}</h1>
      <p class="head-sub">${finished ? "Reread your notes and watch how far your voice came." : fmtDate(dateForDay(cur)) + " &middot; 40 min daily"}</p>`;
  }

  function trackHTML(cur) {
    let cells = "";
    for (let n = 1; n <= 31; n++) {
      const st = dayStatus(n, cur);
      cells += `<button type="button" class="t-${st}" data-track="${n}" aria-label="Day ${n}, ${st}. Open in plan."><span></span></button>`;
    }
    const done = countComplete(cur);
    return `
      <div class="track">${cells}</div>
      <div class="track-caption">
        <span>${done} of 31 days complete</span>
        <span>${Math.max(0, 31 - cur)} left</span>
      </div>`;
  }

  function countComplete(cur) {
    let c = 0;
    for (let n = 1; n <= 31; n++) if (dayStatus(n, cur) === "complete") c++;
    return c;
  }

  function fixLineHTML(cur, finished) {
    if (finished) return "";
    const p = planForDay(cur);
    if (!p.reviewRequired) return "";
    const rec = Store.getDay(cur);
    const fix = (rec && rec.feedback && rec.feedback.fixToday || "").trim();
    if (fix) {
      return `<div class="fix-line" id="fixLine"><span class="fx-label">Fix today</span><span class="fx-text" id="fixText">${esc(fix)}</span></div>`;
    }
    return `<div class="fix-line is-empty" id="fixLine"><span class="fx-label">Fix today</span><span class="fx-text" id="fixText">Review yesterday's video below and set the one thing to fix.</span></div>`;
  }

  function checklistHTML(cur, finished) {
    if (finished) return "";
    const items = checklistForDay(cur);
    const rec = Store.getDay(cur);
    const checks = (rec && rec.checklist) || {};
    const allDone = items.every(i => checks[i.key]);
    return `
      <div class="card">
        <h2 class="card-title">Daily checklist</h2>
        <p class="card-sub">Resets every day. Same work, every day, for 31 days.</p>
        <div role="group" aria-label="Daily checklist">
          ${items.map(item => `
            <button class="task" type="button" role="checkbox" aria-checked="${!!checks[item.key]}" data-check="${item.key}">
              <span class="task-check" aria-hidden="true">${CHECK_SVG}</span>
              <span class="task-label">${esc(item.label)}</span>
            </button>`).join("")}
        </div>
        ${allDone ? `<div class="all-done">${CHECK_SVG} All done today. Keep going.</div>` : ""}
      </div>`;
  }

  function planHTML(cur) {
    return `
      <div class="plan-header">
        <h2 class="plan-title">31 Day Plan</h2>
        <p class="plan-sub">Click any day to expand. Everything saves automatically.</p>
      </div>
      <div class="plan">
        ${PLAN_PHASES.map((phase, i) => {
          const open = expandedPhase === i;
          const span = phase.days.length === 1
            ? "Day " + phase.days[0]
            : "Days " + phase.days[0] + " to " + phase.days[phase.days.length - 1];
          return `
          <div class="phase-row ${open ? "open" : ""}">
            <button class="phase-head" type="button" data-phase="${i}" aria-expanded="${open}">
              <span class="phase-badge">${span}</span>
              <span class="phase-name">${esc(phase.title)}</span>
              <span class="phase-chevron">${CHEVRON_SVG}</span>
            </button>
            ${open ? `
            <div class="phase-body">
              <p class="phase-desc">${esc(phase.prompt)}</p>
              ${phase.days.map(n => dayBlockHTML(n, cur)).join("")}
            </div>` : ""}
          </div>`;
        }).join("")}
      </div>`;
  }

  function dayBlockHTML(n, cur) {
    const p = planForDay(n);
    const rec = Store.getDay(n);
    const fb = (rec && rec.feedback) || {};
    let html = `
      <div class="day-block" data-day="${n}">
        <div class="day-head">
          <span class="d-name">Day ${n}</span>
          <span class="d-date">${fmtDate(dateForDay(n))}</span>
          ${n === cur && !challengeFinished() ? `<span class="d-today">Today</span>` : ""}
        </div>`;

    html += `<span class="fb-label">Video feedback</span>`;
    if (!p.reviewRequired) {
      html += `<p class="fb-note">You film your first video today. Tomorrow you review it here.</p>`;
    } else {
      html += `
        ${rubricRateRow(n, "pace", "Pace", fb.pace)}
        ${rubricRateRow(n, "sentences", "Finished sentences", fb.sentences)}
        ${rubricRateRow(n, "energy", "Energy and confidence", fb.energy)}
        <div class="rub-row">
          <span class="rub-name" id="fill-l-${n}">Filler words</span>
          <div class="stepper">
            <button type="button" data-step="-1" data-day="${n}" aria-label="Decrease filler count, day ${n}">${MINUS_SVG}</button>
            <span class="stepper-value" data-fillers="${n}" aria-labelledby="fill-l-${n}" role="status">${fb.fillers != null ? fb.fillers : 0}</span>
            <button type="button" data-step="1" data-day="${n}" aria-label="Increase filler count, day ${n}">${PLUS_SVG}</button>
          </div>
        </div>
        <label class="sr-only" for="fix-${n}">One specific thing to fix, day ${n}</label>
        <input type="text" class="text-input" id="fix-${n}" data-fix="${n}" maxlength="140"
          placeholder="One specific thing to fix today" value="${esc(fb.fixToday || "")}" autocomplete="off" style="margin-top:8px">`;
    }

    html += `
        <label class="fb-label" for="notes-${n}">Day notes</label>
        <textarea class="text-input" id="notes-${n}" data-notes="${n}" rows="3"
          placeholder="Notes on today's focus area...">${esc(rec ? rec.notes || "" : "")}</textarea>
      </div>`;
    return html;
  }

  function rubricRateRow(day, key, name, val) {
    let btns = "";
    for (let v = 1; v <= 5; v++) {
      btns += `<button type="button" data-rate="${key}" data-day="${day}" data-val="${v}" aria-pressed="${val === v}" aria-label="${esc(name)}, day ${day}: ${v} of 5">${v}</button>`;
    }
    return `
      <div class="rub-row">
        <span class="rub-name">${esc(name)}</span>
        <div class="rate" role="group" aria-label="${esc(name)}, day ${day}, 1 to 5">${btns}</div>
      </div>`;
  }

  /* ---------- events ---------- */

  function bind(cur) {
    // Progress minibars: open that day's phase
    $$("[data-track]", appShell).forEach(btn => {
      btn.addEventListener("click", () => {
        const n = parseInt(btn.dataset.track, 10);
        expandedPhase = phaseIndexForDay(n);
        render();
        const block = $(`.day-block[data-day="${n}"]`, appShell);
        if (block) block.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    // Daily checklist
    $$("[data-check]", appShell).forEach(row => {
      row.addEventListener("click", () => {
        const key = row.dataset.check;
        const on = row.getAttribute("aria-checked") !== "true";
        const patch = {}; patch[key] = on;
        Store.patchDay(cur, { checklist: patch });
        render();
      });
    });

    // Accordion
    $$("[data-phase]", appShell).forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.phase, 10);
        expandedPhase = expandedPhase === i ? null : i;
        render();
      });
    });

    // Ratings: save + update in place (no re-render, keeps scroll)
    $$("[data-rate]", appShell).forEach(btn => {
      btn.addEventListener("click", () => {
        const day = parseInt(btn.dataset.day, 10);
        const key = btn.dataset.rate;
        const val = parseInt(btn.dataset.val, 10);
        const patch = {}; patch[key] = val;
        Store.patchDay(day, { feedback: patch });
        $$(`[data-rate="${key}"][data-day="${day}"]`, appShell).forEach(b =>
          b.setAttribute("aria-pressed", String(b === btn)));
        refreshTrack(cur);
      });
    });

    // Filler stepper
    $$("[data-step]", appShell).forEach(btn => {
      btn.addEventListener("click", () => {
        const day = parseInt(btn.dataset.day, 10);
        const rec = Store.getDay(day);
        const now = rec && rec.feedback && rec.feedback.fillers != null ? rec.feedback.fillers : 0;
        const next = Math.max(0, Math.min(999, now + parseInt(btn.dataset.step, 10)));
        Store.patchDay(day, { feedback: { fillers: next } });
        $(`[data-fillers="${day}"]`, appShell).textContent = String(next);
      });
    });

    // Fix inputs
    $$("[data-fix]", appShell).forEach(input => {
      const day = parseInt(input.dataset.fix, 10);
      let t;
      input.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          Store.patchDay(day, { feedback: { fixToday: input.value.trim() } });
          if (day === cur) refreshFixLine(input.value.trim());
        }, 400);
      });
    });

    // Notes: autosave + autoresize
    $$("[data-notes]", appShell).forEach(ta => {
      autosize(ta);
      const day = parseInt(ta.dataset.notes, 10);
      let t;
      ta.addEventListener("input", () => {
        autosize(ta);
        clearTimeout(t);
        t = setTimeout(() => Store.patchDay(day, { notes: ta.value }), 400);
      });
    });
  }

  function autosize(ta) {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }

  function refreshFixLine(text) {
    const line = $("#fixLine");
    if (!line) return;
    if (text) {
      line.classList.remove("is-empty");
      $("#fixText").textContent = text;
    } else {
      line.classList.add("is-empty");
      $("#fixText").textContent = "Review yesterday's video below and set the one thing to fix.";
    }
  }

  function refreshTrack(cur) {
    $$("[data-track]", appShell).forEach(btn => {
      const n = parseInt(btn.dataset.track, 10);
      btn.className = "t-" + dayStatus(n, cur);
    });
  }

  /* ---------- service worker ---------- */

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  boot();
})();
