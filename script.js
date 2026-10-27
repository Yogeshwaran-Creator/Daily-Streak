const STORAGE_KEY = "daylight-study-sessions";
const THEME_STORAGE_KEY = "daylight-theme";
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
  hoursInput: document.getElementById("hours-input"),
  minutesInput: document.getElementById("minutes-input"),
  timerDisplay: document.getElementById("timer-display"),
  timerStatus: document.getElementById("timer-status"),
  timerToggle: document.getElementById("timer-toggle"),
  timerReset: document.getElementById("timer-reset"),
  formMessage: document.getElementById("form-message"),
  sessionList: document.getElementById("session-list"),
  sessionCount: document.getElementById("session-count"),
  calendarGrid: document.getElementById("calendar-grid"),
  monthLabel: document.getElementById("month-label"),
  previousMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  themeToggle: document.getElementById("theme-toggle"),
  themeToggleIcon: document.getElementById("theme-toggle-icon"),
  themeToggleLabel: document.getElementById("theme-toggle-label"),
};

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  elements.themeToggleIcon.textContent = isDark ? "☼" : "☾";
  elements.themeToggleLabel.textContent = isDark ? "Light mode" : "Dark mode";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#151c19" : "#d9dde0");
}

function loadTheme() {
  try {
    setTheme(localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light");
  } catch (error) {
    console.error("Could not load the saved theme.", error);
    setTheme("light");
    elements.formMessage.textContent = "Your saved theme couldn't be loaded.";
    elements.formMessage.classList.add("error");
  }
}

elements.themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error("Could not save the selected theme.", error);
    elements.formMessage.textContent = "Your theme changed, but couldn't be saved for next time.";
    elements.formMessage.classList.add("error");
  }
});

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
let timerState = "idle";
let timerRemainingMs = 30 * 60 * 1000;
let timerEndsAt = null;
let timerDurationMinutes = 30;
let timerInterval = null;
let audioContext = null;

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
  const savedSessions = [...sessions].sort((a, b) => b.createdAt - a.createdAt);

  elements.sessionCount.textContent = String(savedSessions.length);
  elements.sessionList.replaceChildren();
  if (!savedSessions.length) {
    const empty = document.createElement("li");
    empty.className = "empty-sessions";
    empty.textContent = "No study sessions saved yet. Log your first one above.";
    elements.sessionList.append(empty);
    return;
  }

  savedSessions.forEach((session) => {
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
    meta.textContent = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(session.createdAt));
    info.append(subject, meta);

    const duration = document.createElement("span");
    duration.className = "session-minutes";
    const hours = Math.floor(session.minutes / 60);
    const minutes = session.minutes % 60;
    duration.textContent = [
      hours ? `${hours} hr${hours === 1 ? "" : "s"}` : "",
      minutes ? `${minutes} min` : "",
    ].filter(Boolean).join(" ");

    item.append(mark, info, duration);
    elements.sessionList.append(item);
  });
}

function render() {
  renderStats();
  renderCalendar();
  renderSessions();
}

function selectedDurationMinutes() {
  const hours = Number(elements.hoursInput.value);
  const minutes = Number(elements.minutesInput.value);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 24 ||
    minutes < 0 ||
    minutes > 59
  ) return null;

  const durationMinutes = hours * 60 + minutes;
  return durationMinutes >= 1 && durationMinutes <= 1440 ? durationMinutes : null;
}

function formatTimerTime(milliseconds) {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function renderTimer() {
  elements.timerDisplay.textContent = formatTimerTime(timerRemainingMs);
  elements.timerToggle.textContent = timerState === "running"
    ? "Pause timer"
    : timerState === "paused" ? "Resume timer" : "Start timer";
  elements.timerReset.disabled = timerState === "idle";
  const isActive = timerState === "running" || timerState === "paused";
  elements.hoursInput.disabled = isActive;
  elements.minutesInput.disabled = isActive;
  elements.subjectInput.disabled = isActive;
}

function initializeAudio() {
  if (audioContext) return true;
  if (!window.AudioContext) {
    return false;
  }
  try {
    audioContext = new AudioContext();
  } catch (error) {
    console.error("Could not initialize timer alarm audio.", error);
    return false;
  }
  audioContext.resume().catch((error) => {
    console.error("Could not enable timer alarm audio.", error);
  });
  return true;
}

function playCompletionAlarm() {
  if (!audioContext) {
    elements.timerStatus.textContent = "Timer complete! Sound is unavailable in this browser.";
    return;
  }

  audioContext.resume().then(() => {
    const startAt = audioContext.currentTime;
    for (let beep = 0; beep < 3; beep += 1) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const beepStart = startAt + beep * 0.4;
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, beepStart);
      gain.gain.exponentialRampToValueAtTime(0.2, beepStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, beepStart + 0.22);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(beepStart);
      oscillator.stop(beepStart + 0.23);
    }
  }).catch((error) => {
    console.error("Could not play the timer alarm.", error);
    elements.timerStatus.textContent = "Timer complete, but the alarm couldn't play.";
  });
}

function finishTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRemainingMs = 0;
  timerEndsAt = null;
  timerState = "completed";
  renderTimer();
  elements.timerStatus.textContent = "Time's up!";

  const session = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: localDateKey(new Date()),
    minutes: timerDurationMinutes,
    subject: elements.subjectInput.value.trim(),
    createdAt: Date.now(),
  };
  sessions.push(session);
  if (!saveSessions()) {
    sessions.pop();
  } else {
    elements.formMessage.textContent = "Session logged. Nice work!";
    elements.formMessage.classList.remove("error");
    render();
  }
  playCompletionAlarm();
}

function updateTimer() {
  if (timerState !== "running" || timerEndsAt === null) return;
  timerRemainingMs = timerEndsAt - Date.now();
  if (timerRemainingMs <= 0) {
    finishTimer();
    return;
  }
  renderTimer();
}

function startTimer() {
  const soundAvailable = initializeAudio();
  timerEndsAt = Date.now() + timerRemainingMs;
  timerState = "running";
  elements.timerStatus.textContent = soundAvailable
    ? "Timer running. Stay focused!"
    : "Timer running. Sound is unavailable in this browser.";
  timerInterval = window.setInterval(updateTimer, 250);
  updateTimer();
}

elements.sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (timerState === "running") {
    updateTimer();
    if (timerState !== "running") return;
    timerRemainingMs = timerEndsAt - Date.now();
    timerEndsAt = null;
    clearInterval(timerInterval);
    timerInterval = null;
    timerState = "paused";
    elements.timerStatus.textContent = "Timer paused.";
    renderTimer();
    return;
  }

  if (timerState === "paused") {
    startTimer();
    return;
  }

  const subject = elements.subjectInput.value.trim();
  if (!subject) {
    elements.formMessage.textContent = "Enter what you're studying before starting the timer.";
    elements.formMessage.classList.add("error");
    elements.subjectInput.focus();
    return;
  }

  const durationMinutes = selectedDurationMinutes();
  if (durationMinutes === null) {
    elements.formMessage.textContent = "Set a duration between 1 minute and 24 hours.";
    elements.formMessage.classList.add("error");
    elements.minutesInput.focus();
    return;
  }

  timerDurationMinutes = durationMinutes;
  timerRemainingMs = durationMinutes * 60 * 1000;
  elements.formMessage.textContent = "";
  elements.formMessage.classList.remove("error");
  startTimer();
});

elements.timerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerEndsAt = null;
  timerState = "idle";
  const durationMinutes = selectedDurationMinutes();
  timerRemainingMs = (durationMinutes || 0) * 60 * 1000;
  elements.timerStatus.textContent = "Timer reset. Set a duration and start when ready.";
  elements.formMessage.textContent = "";
  elements.formMessage.classList.remove("error");
  renderTimer();
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
renderTimer();
