/* Data layer. Every read and write goes through here so a future sync
   module (Supabase) can wrap these functions without touching the views.
   Each day record carries its own updatedAt for last-write-wins merging. */
const STORE_KEY = "work.challenge.v1";

const Store = (() => {
  let state = null;

  function blank() {
    return { schemaVersion: 1, startDate: null, days: {}, updatedAt: null };
  }

  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schemaVersion === 1) {
          state = parsed;
          return state;
        }
      }
    } catch (e) { /* storage unavailable or corrupt: run in-memory */ }
    state = blank();
    return state;
  }

  function persist() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* in-memory only this session */ }
  }

  function getState() { return load(); }

  function setStartDate(isoDate) {
    load();
    state.startDate = isoDate;
    persist();
  }

  function getDay(n) {
    load();
    return state.days[String(n)] || null;
  }

  function patchDay(n, partial) {
    load();
    const key = String(n);
    const current = state.days[key] || {
      checklist: {}, feedback: null, notes: "", updatedAt: null
    };
    const next = Object.assign({}, current, partial);
    if (partial.checklist) {
      next.checklist = Object.assign({}, current.checklist, partial.checklist);
    }
    if (partial.feedback) {
      next.feedback = Object.assign({}, current.feedback || {}, partial.feedback);
    }
    next.updatedAt = new Date().toISOString();
    state.days[key] = next;
    persist();
    return next;
  }

  function reset() {
    state = blank();
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  return { getState, setStartDate, getDay, patchDay, reset };
})();

/* ---- Challenge day math ---- */

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

/* Raw day count since start (1-based, uncapped; 0 or less never happens
   because start date is never in the future). */
function rawDayNumber() {
  const s = Store.getState();
  if (!s.startDate) return null;
  const start = new Date(s.startDate + "T00:00:00");
  const now = new Date(todayISO() + "T00:00:00");
  const diff = Math.round((now - start) / 86400000);
  return diff + 1;
}

/* Current challenge day, capped at 31. Dev override: ?d=16 on the URL. */
function currentDay() {
  const params = new URLSearchParams(location.search);
  const dev = parseInt(params.get("d"), 10);
  if (dev >= 1 && dev <= 31) return dev;
  const raw = rawDayNumber();
  if (raw === null) return null;
  return Math.min(raw, 31);
}

function challengeFinished() {
  const raw = rawDayNumber();
  return raw !== null && raw > 31;
}

/* ---- Day status for the Plan map and Progress stats ---- */

function dayStatus(n, current) {
  const rec = Store.getDay(n);
  const items = checklistForDay(n);
  const done = rec ? items.filter(i => rec.checklist && rec.checklist[i.key]).length : 0;
  const hasFeedback = !!(rec && rec.feedback &&
    (rec.feedback.fillers != null || rec.feedback.pace || rec.feedback.energy ||
     rec.feedback.sentences || (rec.feedback.fixToday || "").trim()));
  const complete = done === items.length;
  if (n === current && !challengeFinished()) {
    return complete ? "complete" : "current";
  }
  if (n > current) return "upcoming";
  if (complete) return "complete";
  if (done > 0 || hasFeedback || (rec && (rec.notes || "").trim())) return "partial";
  return "missed";
}
