const STORAGE_KEY = "daylight-study-sessions";
const DAILY_GOAL_MINUTES = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

const elements = {
  todayLabel: document.getElementById("today-label"),
  streakCount: document.getElementById("streak-count"),
  currentStreak: document.getElementById("current-streak"),
  streakCaption: document.getElementById("streak-caption"),
  totalTime: document.getElementById("total-time"),
  daysCount: document.getElementById("days-count"),
  todayTitle: document.getElementById("today-title"),
  todayDescription: document.getElementById("today-description"),
  todayMinutes: document.getElementById("today-minutes"),
  progressBar: document.getElementById("progress-bar"),
  progressFill: document.getElementById("progress-fill"),
  sessionForm: document.getElementById("session-form"),
  subjectInput: document.getElementById("subject-input"),
  minutesInput: document.getElementById("minutes-input"),
  formMessage: document.getElementById("form-message"),
  sessionList: document.getElementById("session-list"),
  sessionCount: document.getElementById("session-count"),
  calendarGrid: document.getElementById("calendar-grid"),
  monthLabel: document.getElementById("month-label"),
  previousMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
};

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readSessions() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Stored study data is not a list.");

    return parsed.filter((session) =>
      session &&
      typeof session.id === "string" &&
      typeof session.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(session.date) &&
      Number.isInteger(session.minutes) &&
      session.minutes > 0 &&
      typeof session.subject === "string" &&
      Number.isFinite(session.createdAt)
    );
  } catch (error) {
    console.error("Could not read saved study sessions.", error);
    elements.formMessage.textContent = "Saved sessions couldn't be loaded. New sessions may still be logged.";
    elements.formMessage.classList.add("error");
    return [];
  }
}

let sessions = readSessions();
const today = new Date();
let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error("Could not save study sessions.", error);
    elements.formMessage.textContent = "Your browser couldn't save this session. Check available storage and try again.";
    elements.formMessage.classList.add("error");
    return false;
  }
}

function sessionsByDate() {
  return sessions.reduce((totals, session) => {
    totals[session.date] = (totals[session.date] || 0) + session.minutes;
    return totals;
  }, {});
}

function getCurrentStreak(studiedDates) {
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!studiedDates[localDateKey(currentDate)]) currentDate.setDate(currentDate.getDate() - 1);

  let streak = 0;
  while (studiedDates[localDateKey(currentDate)]) {
    streak += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  return streak;
}

function dateOrdinal(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function getBestStreak(studiedDates) {
  const dates = Object.keys(studiedDates).sort();
  let best = 0;
  let run = 0;
  let previousOrdinal = null;

  dates.forEach((dateKey) => {
    const ordinal = dateOrdinal(dateKey);
    if (previousOrdinal !== null && ordinal - previousOrdinal === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    previousOrdinal = ordinal;
  });
  return best;
}

function renderStats() {
  const studiedDates = sessionsByDate();
  const todayKey = localDateKey(today);
  const todayMinutes = sessions
    .filter((session) => session.date === todayKey)
    .reduce((total, session) => total + session.minutes, 0);
  const streak = getCurrentStreak(studiedDates);
  const totalMinutes = sessions.reduce((total, session) => total + session.minutes, 0);
  const goalProgress = Math.min(100, (todayMinutes / DAILY_GOAL_MINUTES) * 100);
  const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

  elements.todayLabel.textContent = dateFormatter.format(today).toUpperCase();
  elements.streakCount.textContent = String(streak);
  elements.currentStreak.textContent = String(streak);
  elements.streakCaption.textContent = streak > 0 ? `Your best is ${getBestStreak(studiedDates)} days` : "Every day is a fresh start";
  elements.totalTime.innerHTML = `${totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}<span class="stat-unit"> hr${Math.floor(totalMinutes / 60) === 1 ? "" : "s"} </span>${totalMinutes % 60 ? `${totalMinutes % 60}<span class="stat-unit"> min</span>` : ""}` : `${totalMinutes}<span class="stat-unit"> min</span>`}`;
  elements.daysCount.textContent = String(Object.keys(studiedDates).length);
  elements.todayMinutes.textContent = String(todayMinutes);
  elements.progressFill.style.width = `${goalProgress}%`;
  elements.progressBar.setAttribute("aria-valuenow", String(Math.min(todayMinutes, DAILY_GOAL_MINUTES)));
  elements.todayTitle.textContent = todayMinutes >= DAILY_GOAL_MINUTES ? "You showed up today!" : "Make today count";
  elements.todayDescription.textContent = todayMinutes >= DAILY_GOAL_MINUTES
    ? "Daily goal reached. Take a moment to be proud of your progress."
    : "A focused session is all it takes to keep your momentum going.";
}

function renderCalendar() {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = localDateKey(today);
  const studiedDates = sessionsByDate();
  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
  const weekdayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  elements.monthLabel.textContent = monthFormatter.format(displayedMonth);
  elements.calendarGrid.replaceChildren();

  weekdayNames.forEach((name) => {
    const weekday = document.createElement("span");
    weekday.className = "weekday";
    weekday.setAttribute("role", "columnheader");
    weekday.textContent = name;
    elements.calendarGrid.append(weekday);
  });

  for (let index = 0; index < firstWeekday; index += 1) {
    const empty = document.createElement("span");
    empty.className = "calendar-day empty";
    empty.setAttribute("role", "gridcell");
    elements.calendarGrid.append(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = localDateKey(new Date(year, month, day));
    const dateButton = document.createElement("span");
    const isToday = dateKey === todayKey;
    const isFuture = dateKey > todayKey;
    dateButton.className = `calendar-day${studiedDates[dateKey] ? " studied" : ""}${isToday ? " today" : ""}${isFuture ? " future" : ""}`;
    dateButton.setAttribute("role", "gridcell");
    dateButton.textContent = String(day);
    if (studiedDates[dateKey]) dateButton.setAttribute("aria-label", `${monthFormatter.format(displayedMonth)} ${day}: studied ${studiedDates[dateKey]} minutes`);
    else dateButton.setAttribute("aria-label", `${monthFormatter.format(displayedMonth)} ${day}${isToday ? ", today" : ""}`);
    elements.calendarGrid.append(dateButton);
  }
}

function renderSessions() {
  const todayKey = localDateKey(today);
  const todaysSessions = sessions
    .filter((session) => session.date === todayKey)
    .sort((a, b) => b.createdAt - a.createdAt);

  elements.sessionCount.textContent = String(todaysSessions.length);
  elements.sessionList.replaceChildren();
  if (!todaysSessions.length) {
    const empty = document.createElement("li");
    empty.className = "empty-sessions";
    empty.textContent = "No sessions yet today. Log your first one above.";
    elements.sessionList.append(empty);
    return;
  }

  todaysSessions.forEach((session) => {
    const item = document.createElement("li");
    item.className = "session-item";

    const mark = document.createElement("span");
    mark.className = "session-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✦";

    const info = document.createElement("div");
    info.className = "session-info";
    const subject = document.createElement("div");
    subject.className = "session-subject";
    subject.textContent = session.subject || "Study session";
    const meta = document.createElement("div");
    meta.className = "session-meta";
    meta.textContent = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(session.createdAt));
    info.append(subject, meta);

    const duration = document.createElement("span");
    duration.className = "session-minutes";
    duration.textContent = `${session.minutes} min`;

    const removeButton = document.createElement("button");
    removeButton.className = "delete-session";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${session.subject || "study session"}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => removeSession(session.id));

    item.append(mark, info, duration, removeButton);
    elements.sessionList.append(item);
  });
}

function render() {
  renderStats();
  renderCalendar();
  renderSessions();
}

function removeSession(id) {
  const previousSessions = sessions;
  sessions = sessions.filter((session) => session.id !== id);
  if (!saveSessions()) {
    sessions = previousSessions;
    return;
  }
  elements.formMessage.textContent = "Session removed.";
  elements.formMessage.classList.remove("error");
  render();
}

elements.sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const minutes = Number(elements.minutesInput.value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    elements.formMessage.textContent = "Enter a whole number of minutes between 1 and 1440.";
    elements.formMessage.classList.add("error");
    elements.minutesInput.focus();
    return;
  }

  const session = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: localDateKey(new Date()),
    minutes,
    subject: elements.subjectInput.value.trim(),
    createdAt: Date.now(),
  };
  sessions.push(session);
  if (!saveSessions()) {
    sessions.pop();
    return;
  }

  elements.formMessage.textContent = "Session logged. Nice work!";
  elements.formMessage.classList.remove("error");
  elements.subjectInput.value = "";
  elements.minutesInput.value = "30";
  render();
});

elements.previousMonth.addEventListener("click", () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
  renderCalendar();
});

elements.nextMonth.addEventListener("click", () => {
  const nextMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
  if (nextMonth <= new Date(today.getFullYear(), today.getMonth(), 1)) {
    displayedMonth = nextMonth;
    renderCalendar();
  }
});

render();
