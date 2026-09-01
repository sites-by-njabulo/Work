/* The 31-day communication challenge plan.
   scriptRequired drives the fourth checklist item (days 16-31).
   reviewRequired is false only on Day 1 (there is no video to review yet). */
const PLAN_PHASES = [
  { days: [1, 2],    title: "Speak Clearly & Sound Intelligent",
    prompt: "Slow down, hit your consonants, and end every sentence with intent." },
  { days: [3, 4],    title: "Stop Stuttering & Vocal Clarity",
    prompt: "Breathe before you speak and let each word land fully before the next." },
  { days: [5],       title: "Cut Filler Words & Stop Rambling",
    prompt: "Say it once, say it clean, then stop talking." },
  { days: [6, 7],    title: "How to Be Dangerously Confident",
    prompt: "Hold eye contact with the lens and speak like your opinion is the answer." },
  { days: [8],       title: "Study Creators",
    prompt: "Watch the creators you look up to and write down exactly what their delivery and body language does." },
  { days: [9],       title: "Practice What You Studied",
    prompt: "Film today's video applying exactly what you wrote down yesterday." },
  { days: [10, 11, 12], title: "Storytelling",
    prompt: "Tell one story with a hook, real tension, and a payoff." },
  { days: [13, 14],  title: "Sounding Articulate / Talk Less, Influence More",
    prompt: "Use fewer words and make each one carry more weight." },
  { days: [15],      title: "Speaking On The Spot",
    prompt: "Pick a random topic and speak on it for two minutes with zero prep." },
  { days: [16, 17],  title: "Communication Under Pressure Drills",
    prompt: "Answer hard questions fast without losing your structure." },
  { days: [18, 19, 20], title: "Alex Hormozi Ultimate Sales Training",
    prompt: "Work through the sales training and speak the frameworks out loud." },
  { days: [21, 22],  title: "Watch Real Sales Call Recordings",
    prompt: "Watch real sales calls and note what the closer does that you do not." },
  { days: [23, 24],  title: "Objection Handling Training",
    prompt: "Learn the objection frameworks until the responses are automatic." },
  { days: [25, 26],  title: "Objection Handling Practice",
    prompt: "Run live objection reps out loud until your answers sound calm." },
  { days: [27, 28],  title: "Networking Like the Top 1%",
    prompt: "Practice introducing yourself and asking questions that open doors." },
  { days: [29, 30],  title: "AI Pressure Training for Sales",
    prompt: "Run AI roleplay sales calls under pressure and hold your frame." },
  { days: [31],      title: "Final Review",
    prompt: "Rewatch Day 1, compare it to yesterday, and write down how far you came." }
];

const PLAN = (() => {
  const list = [];
  for (const phase of PLAN_PHASES) {
    const span = phase.days.length === 1
      ? "Day " + phase.days[0]
      : "Days " + phase.days[0] + " to " + phase.days[phase.days.length - 1];
    for (const day of phase.days) {
      list.push({
        day,
        phaseLabel: span,
        focusTitle: phase.title,
        focusPrompt: phase.prompt,
        scriptRequired: day >= 16,
        reviewRequired: day >= 2
      });
    }
  }
  return list;
})();

function planForDay(day) {
  return PLAN[Math.min(Math.max(day, 1), 31) - 1];
}

/* Checklist items applicable to a given day, in display order. */
function checklistForDay(day) {
  const p = planForDay(day);
  const items = [
    { key: "film",   label: "Film a 3 to 5 minute video" }
  ];
  if (p.reviewRequired) {
    items.push({ key: "review", label: "Review yesterday's video with the rubric" });
  }
  items.push(
    { key: "drill",  label: "Pencil drill: 10 minutes reading out loud, pencil between your teeth" }
  );
  if (p.scriptRequired) {
    items.push({ key: "script", label: "Read sales script out loud" });
  }
  return items;
}
