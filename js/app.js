/* WORK - views and interactions. All persistence goes through Store (store.js). */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const startScreen = $("#startScreen");
  const appShell = $("#appShell");
  const chartTip = $("#chartTip");

  let activeView = "today";
  let viewingDay = null; // day shown in the Today view (may be a past day)

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
    viewingDay = currentDay();
    bindTabs();
    renderAll();
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

  function bindTabs() {
    $$(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.view === "today") viewingDay = currentDay();
        switchView(btn.dataset.view);
      });
    });
  }

  function switchView(name) {
    activeView = name;
    $$(".tab").forEach(b => {
      if (b.dataset.view === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $$(".view").forEach(v => { v.hidden = v.id !== "view-" + name; });
    renderAll();
    window.scrollTo({ top: 0 });
  }

  function renderAll() {
    if (activeView === "today") renderToday();
    if (activeView === "plan") renderPlan();
    if (activeView === "progress") renderProgress();
  }

  /* ---------- Today view ---------- */

  function trackHTML(cur) {
    let cells = "";
    for (let n = 1; n <= 31; n++) {
      const st = dayStatus(n, cur);
      cells += `<span class="t-${st}"></span>`;
    }
    const doneCount = countComplete(cur);
    return `
      <div class="track" aria-hidden="true">${cells}</div>
      <div class="track-caption">
        <span>${doneCount} of 31 days complete</span>
        <span>${31 - Math.min(cur, 31)} left</span>
      </div>`;
  }

  function countComplete(cur) {
    let c = 0;
    for (let n = 1; n <= 31; n++) if (dayStatus(n, cur) === "complete") c++;
    return c;
  }

  function renderToday() {
    const root = $("#view-today");
    const cur = currentDay();
    const finished = challengeFinished();
    const day = viewingDay || cur;
    const p = planForDay(day);
    const rec = Store.getDay(day);
    const items = checklistForDay(day);
    const isPast = day < cur || (finished && day <= 31);
    const checkedCount = items.filter(i => rec && rec.checklist && rec.checklist[i.key]).length;
    const allChecked = checkedCount === items.length;
    const fb = (rec && rec.feedback) || {};

    let html = "";
    let i = 0;

    if (finished && day === cur) {
      html += `
        <div class="done-hero reveal" style="--i:${i++}">
          <h2>31 days. Done.</h2>
          <p>The challenge is complete. Go to Progress and watch how far your voice came, then decide what the next 31 look like.</p>
          <button class="btn-primary" id="goProgressBtn" type="button">See my progress</button>
        </div>`;
    }

    if (isPast && !(finished && day === cur)) {
      html += `
        <div class="past-banner reveal" style="--i:${i++}">
          <span>Viewing Day ${day}, ${fmtDate(dateForDay(day))}</span>
          <button type="button" id="backToTodayBtn">Back to today</button>
        </div>`;
    }

    html += `
      <div class="hero reveal" style="--i:${i++}">
        <div class="hero-topline">
          <span class="hero-date">${fmtDate(dateForDay(day))}</span>
          <span class="hero-chip">40 MIN DAILY</span>
        </div>
        <h1 class="hero-day">DAY ${String(day).padStart(2, "0")}<span class="of">/ 31</span></h1>
        <p class="hero-focus-label">${esc(p.phaseLabel)} focus</p>
        <h2 class="hero-focus-title">${esc(p.focusTitle)}</h2>
        <p class="hero-focus-prompt">${esc(p.focusPrompt)}</p>
        ${trackHTML(cur)}
      </div>`;

    // Fix directive for the shown day
    const fix = (fb.fixToday || "").trim();
    if (fix) {
      html += `
        <div class="fix-banner reveal" style="--i:${i++}">
          <p class="fix-label">Fix today</p>
          <p class="fix-text">${esc(fix)}</p>
        </div>`;
    } else if (p.reviewRequired) {
      html += `
        <div class="fix-banner is-empty reveal" style="--i:${i++}">
          <p class="fix-label">Fix today</p>
          <p class="fix-text">Review yesterday's video below and write down the one thing you will fix in today's video.</p>
        </div>`;
    }

    // Checklist
    html += `
      <div class="card reveal" style="--i:${i++}">
        <div class="card-head">
          <h3 class="card-title">Daily checklist</h3>
          <span class="card-meta" id="checkMeta">${checkedCount}/${items.length}</span>
        </div>
        <div role="group" aria-label="Daily checklist">
        ${items.map(item => {
          const on = !!(rec && rec.checklist && rec.checklist[item.key]);
          return `
          <button class="check-row" type="button" role="checkbox" aria-checked="${on}" data-check="${item.key}">
            <span class="check-box" aria-hidden="true">
              <svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17.5 19 7"/></svg>
            </span>
            <span class="check-label">${esc(item.label)}</span>
          </button>`;
        }).join("")}
        </div>
        <div id="stampSlot">${allChecked ? `<p class="stamp">DAY COMPLETE</p>` : ""}</div>
      </div>`;

    // Rubric
    html += `<div class="card reveal" style="--i:${i++}">
      <div class="card-head">
        <h3 class="card-title">Video feedback</h3>
        <span class="card-meta">${day === 1 ? "" : "Day " + (day - 1) + "'s video"}</span>
      </div>`;
    if (!p.reviewRequired) {
      html += `<p class="rubric-empty">You film your first video today. Tomorrow you review it here with the rubric and set your first fix.</p>`;
    } else {
      html += `
        ${rateField("pace", "Pace", "Rushed", "Controlled", fb.pace)}
        <div class="field">
          <span class="field-label" id="fillersLabel">Filler word count <span class="field-hint">(um, uh, like, you know)</span></span>
          <div class="stepper">
            <button type="button" data-step="-1" aria-label="Decrease filler count">
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span class="stepper-value" id="fillerValue" aria-labelledby="fillersLabel" role="status">${fb.fillers != null ? fb.fillers : "0"}</span>
            <button type="button" data-step="1" aria-label="Increase filler count">
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
            </button>
          </div>
        </div>
        ${rateField("sentences", "Finished sentences without backtracking", "Kept restarting", "Clean finishes", fb.sentences)}
        ${rateField("energy", "Energy and confidence", "Flat", "Commanding", fb.energy)}
        <div class="field">
          <label for="fixInput">One specific thing to fix today</label>
          <input type="text" class="text-input" id="fixInput" maxlength="140"
            value="${esc(fb.fixToday || "")}" autocomplete="off">
        </div>`;
    }
    html += `</div>`;

    // Notes
    html += `
      <div class="card reveal" style="--i:${i++}">
        <div class="card-head">
          <h3 class="card-title">Notes</h3>
        </div>
        <label class="sr-only" for="notesInput">Notes for day ${day}</label>
        <textarea class="text-input" id="notesInput" placeholder="What happened in today's practice. What felt different.">${esc(rec ? rec.notes || "" : "")}</textarea>
        <p class="save-note" id="notesSaved"></p>
      </div>`;

    root.innerHTML = html;
    bindToday(day, items);
  }

  function rateField(key, label, lo, hi, val) {
    let btns = "";
    for (let n = 1; n <= 5; n++) {
      btns += `<button type="button" data-rate="${key}" data-val="${n}" aria-pressed="${val === n}" aria-label="${esc(label)}: ${n} of 5">${n}</button>`;
    }
    return `
      <div class="field">
        <span class="field-label">${esc(label)}</span>
        <div class="rate" role="group" aria-label="${esc(label)}, 1 to 5">${btns}</div>
        <div class="rate-ends" aria-hidden="true"><span>${esc(lo)}</span><span>${esc(hi)}</span></div>
      </div>`;
  }

  function bindToday(day, items) {
    const root = $("#view-today");

    const back = $("#backToTodayBtn", root);
    if (back) back.addEventListener("click", () => { viewingDay = currentDay(); renderToday(); });

    const goProg = $("#goProgressBtn", root);
    if (goProg) goProg.addEventListener("click", () => switchView("progress"));

    // Checklist toggles: update in place so the tick animation plays
    $$(".check-row", root).forEach(row => {
      row.addEventListener("click", () => {
        const key = row.dataset.check;
        const on = row.getAttribute("aria-checked") !== "true";
        row.setAttribute("aria-checked", String(on));
        const patch = {}; patch[key] = on;
        const rec = Store.patchDay(day, { checklist: patch });
        const checked = items.filter(it => rec.checklist[it.key]).length;
        $("#checkMeta", root).textContent = checked + "/" + items.length;
        $("#stampSlot", root).innerHTML =
          checked === items.length ? `<p class="stamp">DAY COMPLETE</p>` : "";
      });
    });

    // Ratings
    $$("[data-rate]", root).forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.rate;
        const val = parseInt(btn.dataset.val, 10);
        const patch = {}; patch[key] = val;
        Store.patchDay(day, { feedback: patch });
        $$(`[data-rate="${key}"]`, root).forEach(b =>
          b.setAttribute("aria-pressed", String(b === btn)));
      });
    });

    // Filler stepper
    $$("[data-step]", root).forEach(btn => {
      btn.addEventListener("click", () => {
        const rec = Store.getDay(day);
        const cur = rec && rec.feedback && rec.feedback.fillers != null ? rec.feedback.fillers : 0;
        const next = Math.max(0, Math.min(999, cur + parseInt(btn.dataset.step, 10)));
        Store.patchDay(day, { feedback: { fillers: next } });
        $("#fillerValue", root).textContent = String(next);
      });
    });

    // Fix input: save on input (debounced) and refresh the banner on blur
    const fixInput = $("#fixInput", root);
    if (fixInput) {
      let t;
      fixInput.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          Store.patchDay(day, { feedback: { fixToday: fixInput.value.trim() } });
        }, 400);
      });
      fixInput.addEventListener("blur", () => {
        Store.patchDay(day, { feedback: { fixToday: fixInput.value.trim() } });
        renderToday();
      });
    }

    // Notes autosave
    const notes = $("#notesInput", root);
    const savedNote = $("#notesSaved", root);
    let nt;
    notes.addEventListener("input", () => {
      clearTimeout(nt);
      savedNote.textContent = "";
      nt = setTimeout(() => {
        Store.patchDay(day, { notes: notes.value });
        savedNote.textContent = "Saved";
      }, 500);
    });
  }

  /* ---------- Plan view ---------- */

  function renderPlan() {
    const root = $("#view-plan");
    const cur = currentDay();
    const stateWord = {
      complete: "Done", partial: "Partial", current: "Today",
      missed: "Missed", upcoming: ""
    };

    let html = `
      <h1 class="view-title reveal" style="--i:0">The 31 days</h1>
      <p class="view-sub reveal" style="--i:1">Every day: film, review, drill. Tap any past day to open it, backfill it, or reread your notes.</p>`;

    let i = 2;
    for (const phase of PLAN_PHASES) {
      const span = phase.days.length === 1
        ? "Day " + phase.days[0]
        : "Days " + phase.days[0] + " to " + phase.days[phase.days.length - 1];
      html += `
        <div class="phase reveal" style="--i:${i++}">
          <div class="phase-head">
            <span class="phase-days">${span}</span>
            <h2 class="phase-title">${esc(phase.title)}</h2>
          </div>
          <div class="phase-grid">
            ${phase.days.map(n => {
              const st = dayStatus(n, cur);
              return `
              <button class="day-cell s-${st}" type="button" data-day="${n}"
                aria-label="Open day ${n}, ${st}">
                <span class="d-num">${String(n).padStart(2, "0")}</span>
                <span class="d-state">${stateWord[st]}</span>
              </button>`;
            }).join("")}
          </div>
        </div>`;
    }

    root.innerHTML = html;
    $$(".day-cell", root).forEach(cell => {
      cell.addEventListener("click", () => {
        viewingDay = parseInt(cell.dataset.day, 10);
        switchView("today");
      });
    });
  }

  /* ---------- Progress view ---------- */

  function feedbackSeries(field) {
    // [{day, value}] for days that have this rubric value logged
    const out = [];
    for (let n = 2; n <= 31; n++) {
      const rec = Store.getDay(n);
      if (rec && rec.feedback && rec.feedback[field] != null) {
        out.push({ day: n, value: rec.feedback[field] });
      }
    }
    return out;
  }

  function streak(cur) {
    let s = 0;
    let n = dayStatus(cur, cur) === "complete" ? cur : cur - 1;
    while (n >= 1 && dayStatus(n, cur) === "complete") { s++; n--; }
    return s;
  }

  function renderProgress() {
    const root = $("#view-progress");
    const cur = currentDay();
    const fillers = feedbackSeries("fillers");
    const doneCount = countComplete(cur);

    // Filler trend: average of first 3 logged vs last 3 logged
    let delta = "";
    let deltaGood = false;
    if (fillers.length >= 4) {
      const first = fillers.slice(0, 3);
      const last = fillers.slice(-3);
      const avgF = first.reduce((a, b) => a + b.value, 0) / first.length;
      const avgL = last.reduce((a, b) => a + b.value, 0) / last.length;
      const diff = Math.round((avgL - avgF) * 10) / 10;
      deltaGood = diff < 0;
      delta = diff === 0 ? "holding steady" : (diff < 0 ? diff + " vs your start" : "+" + diff + " vs your start");
    }

    let html = `
      <h1 class="view-title reveal" style="--i:0">Progress</h1>
      <p class="view-sub reveal" style="--i:1">The rubric numbers do not lie. Fillers should fall. Confidence should climb.</p>
      <div class="stat-row reveal" style="--i:2">
        <div class="stat-tile">
          <p class="s-label">Days complete</p>
          <p class="s-value">${doneCount}<span style="font-size:16px;color:var(--ink-3)"> / 31</span></p>
        </div>
        <div class="stat-tile">
          <p class="s-label">Current streak</p>
          <p class="s-value">${streak(cur)}</p>
        </div>
        <div class="stat-tile">
          <p class="s-label">Filler words</p>
          <p class="s-value">${fillers.length ? fillers[fillers.length - 1].value : "0"}</p>
          <p class="s-delta ${deltaGood ? "good" : ""}">${delta || "latest review"}</p>
        </div>
      </div>`;

    // Filler chart
    html += `<div class="card reveal" style="--i:3">
      <div class="card-head"><h3 class="card-title">Filler words per video</h3></div>`;
    if (fillers.length === 0) {
      html += `<p class="empty-note">No reviews logged yet. Your first filler count lands here after tomorrow's review.</p>`;
    } else {
      html += `<div class="chart-wrap">${barChart(fillers)}</div>
        <p class="chart-note">Counted while reviewing the previous day's video.</p>
        ${dataTable("Filler words per video", fillers, "Fillers")}`;
    }
    html += `</div>`;

    // Ratings small multiples
    const paceS = feedbackSeries("pace");
    const sentS = feedbackSeries("sentences");
    const energyS = feedbackSeries("energy");
    html += `<div class="card reveal" style="--i:4">
      <div class="card-head"><h3 class="card-title">Ratings, 1 to 5</h3></div>`;
    if (!paceS.length && !sentS.length && !energyS.length) {
      html += `<p class="empty-note">Rate pace, sentence finishes, and energy in each review and the trend lines build here.</p>`;
    } else {
      html += `<div class="multi-grid">
        ${miniLine("Pace", paceS)}
        ${miniLine("Finished sentences", sentS)}
        ${miniLine("Energy and confidence", energyS)}
      </div>`;
    }
    html += `</div>`;

    // Fix log
    const fixes = [];
    for (let n = 31; n >= 1; n--) {
      const rec = Store.getDay(n);
      if (rec && rec.feedback && (rec.feedback.fixToday || "").trim()) {
        fixes.push({ day: n, text: rec.feedback.fixToday.trim() });
      }
    }
    html += `<div class="card reveal" style="--i:5">
      <div class="card-head"><h3 class="card-title">Fix log</h3><span class="card-meta">${fixes.length ? fixes.length + " fixes" : ""}</span></div>`;
    if (!fixes.length) {
      html += `<p class="empty-note">Every "one thing to fix" you write ends up here. It becomes the list of habits you beat.</p>`;
    } else {
      html += `<ul class="fixlog">${fixes.map(f =>
        `<li><span class="f-day">DAY ${String(f.day).padStart(2, "0")}</span><span class="f-text">${esc(f.text)}</span></li>`
      ).join("")}</ul>`;
    }
    html += `</div>`;

    root.innerHTML = html;
    bindChartTips(root);
  }

  /* ---------- Charts: dependency-free inline SVG ---------- */

  function barChart(series) {
    const W = 640, H = 210, padL = 34, padB = 26, padT = 12;
    const plotW = W - padL - 8, plotH = H - padT - padB;
    const maxV = Math.max(5, ...series.map(d => d.value));
    const n = series.length;
    const gap = 2;
    const bw = Math.max(6, Math.floor(plotW / n) - gap);

    // recessive gridlines at nice steps
    const step = maxV <= 10 ? 2 : maxV <= 30 ? 5 : 10;
    let grid = "";
    for (let v = 0; v <= maxV; v += step) {
      const y = padT + plotH - (v / maxV) * plotH;
      grid += `<line x1="${padL}" y1="${y}" x2="${W - 8}" y2="${y}" stroke="var(--line-soft)" stroke-width="1"/>
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)" font-family="var(--font-mono)">${v}</text>`;
    }

    let bars = "";
    series.forEach((d, idx) => {
      const h = Math.max(3, (d.value / maxV) * plotH);
      const x = padL + idx * (bw + gap);
      const y = padT + plotH - h;
      bars += `<path d="M${x} ${padT + plotH} V${y + 4} Q${x} ${y} ${x + 4} ${y} H${x + bw - 4} Q${x + bw} ${y} ${x + bw} ${y + 4} V${padT + plotH} Z"
        fill="var(--accent)" tabindex="0" role="img"
        data-tip="Day ${d.day}: ${d.value} fillers"
        aria-label="Day ${d.day}: ${d.value} filler words"/>`;
      if (idx === 0 || idx === series.length - 1) {
        bars += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--ink)" font-family="var(--font-mono)">${d.value}</text>`;
      }
    });

    // x labels: first, last
    const xFirst = padL + bw / 2, xLast = padL + (n - 1) * (bw + gap) + bw / 2;
    let xLabels = `<text x="${xFirst}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--ink-3)" font-family="var(--font-mono)">D${series[0].day}</text>`;
    if (n > 1) xLabels += `<text x="${xLast}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--ink-3)" font-family="var(--font-mono)">D${series[n - 1].day}</text>`;

    return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Bar chart of filler words per reviewed video">
      ${grid}${bars}${xLabels}
    </svg>`;
  }

  function miniLine(title, series) {
    const W = 220, H = 130, padL = 20, padB = 20, padT = 10, padR = 8;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    let body;
    if (!series.length) {
      body = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="12" fill="var(--ink-3)">No data yet</text>`;
    } else {
      const x = idx => series.length === 1
        ? padL + plotW / 2
        : padL + (idx / (series.length - 1)) * plotW;
      const y = v => padT + plotH - ((v - 1) / 4) * plotH;
      let grid = "";
      [1, 3, 5].forEach(v => {
        grid += `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" stroke="var(--line-soft)" stroke-width="1"/>
          <text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--ink-3)" font-family="var(--font-mono)">${v}</text>`;
      });
      const pts = series.map((d, idx) => `${x(idx)},${y(d.value)}`).join(" ");
      const line = series.length > 1
        ? `<polyline points="${pts}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : "";
      const dots = series.map((d, idx) =>
        `<circle cx="${x(idx)}" cy="${y(d.value)}" r="4" fill="var(--accent)" stroke="var(--card)" stroke-width="2"
          tabindex="0" role="img" data-tip="Day ${d.day}: ${d.value} of 5" aria-label="${esc(title)}, day ${d.day}: ${d.value} of 5"/>`
      ).join("");
      body = grid + line + dots;
    }
    return `<div>
      <p class="mini-chart-title">${esc(title)}</p>
      <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Line chart, ${esc(title)}, rated 1 to 5">${body}</svg></div>
      ${series.length ? dataTable(title, series, "Rating") : ""}
    </div>`;
  }

  function dataTable(caption, series, valueName) {
    return `<table class="sr-only">
      <caption>${esc(caption)}</caption>
      <thead><tr><th scope="col">Day</th><th scope="col">${esc(valueName)}</th></tr></thead>
      <tbody>${series.map(d => `<tr><td>${d.day}</td><td>${d.value}</td></tr>`).join("")}</tbody>
    </table>`;
  }

  function bindChartTips(root) {
    $$("[data-tip]", root).forEach(el => {
      const show = (cx, cy) => {
        chartTip.textContent = el.dataset.tip;
        chartTip.hidden = false;
        chartTip.style.left = cx + "px";
        chartTip.style.top = cy + "px";
      };
      el.addEventListener("mousemove", e => show(e.clientX, e.clientY));
      el.addEventListener("mouseleave", () => { chartTip.hidden = true; });
      el.addEventListener("focus", () => {
        const r = el.getBoundingClientRect();
        show(r.left + r.width / 2, r.top);
      });
      el.addEventListener("blur", () => { chartTip.hidden = true; });
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
