import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const LEGACY_STORAGE_KEY = "beer-year-tracker-v1";
const GROUP_ID = "beeryear";
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const COLORS = ["#f59f00", "#4f8a55", "#a23e48", "#2563eb", "#7c3aed", "#0f766e"];
const FORMAT_LITERS = {
  Lata: 0.355,
  Botella: 0.355,
  Grifo: 0.473,
  Caguama: 0.94,
  Otra: 0.333,
};
const firebaseConfig = {
  apiKey: "AIzaSyC4gsYzlTYIyDpebjXp8IHQzZSsEgcCi84",
  authDomain: "beeryear-cfa32.firebaseapp.com",
  databaseURL: "https://beeryear-cfa32-default-rtdb.firebaseio.com",
  projectId: "beeryear-cfa32",
  storageBucket: "beeryear-cfa32.firebasestorage.app",
  messagingSenderId: "295617272114",
  appId: "1:295617272114:web:9e769b5b698649eaee1f2b",
  measurementId: "G-YC62DXF5D3",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const groupRef = doc(db, "groups", GROUP_ID);
const peopleRef = collection(db, "groups", GROUP_ID, "people");
const drinksRef = collection(db, "groups", GROUP_ID, "drinks");

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const initialState = {
  people: [
    { id: "nico", name: "Nico", color: "#f59f00" },
    { id: "vale", name: "Ale", color: "#4f8a55" },
    { id: "diego", name: "Nico", color: "#a23e48" },
  ],
  drinks: [],
};

let state = { people: [...initialState.people], drinks: [] };
const uiState = {
  leaderboardPeriod: "year",
  expandedLeaderId: "",
  statsPersonId: "all",
  companionPersonId: "",
  mainChartRange: "month",
};
const connectionState = {
  peopleReady: false,
  drinksReady: false,
  connected: false,
};

const els = {
  currentYear: document.querySelector("#currentYear"),
  yearTotal: document.querySelector("#yearTotal"),
  paceStat: document.querySelector("#paceStat"),
  leaderName: document.querySelector("#leaderName"),
  leaderStat: document.querySelector("#leaderStat"),
  biggestDay: document.querySelector("#biggestDay"),
  biggestDayStat: document.querySelector("#biggestDayStat"),
  monthChart: document.querySelector("#monthChart"),
  mainChartRange: document.querySelector("#mainChartRange"),
  mainChartLabel: document.querySelector("#mainChartLabel"),
  drinkForm: document.querySelector("#drinkForm"),
  personSelect: document.querySelector("#personSelect"),
  nowStamp: document.querySelector("#nowStamp"),
  beerName: document.querySelector("#beerName"),
  beerType: document.querySelector("#beerType"),
  drinkMood: document.querySelector("#drinkMood"),
  drinkCompanionPerson: document.querySelector("#drinkCompanionPerson"),
  drinkNote: document.querySelector("#drinkNote"),
  todayCount: document.querySelector("#todayCount"),
  nextMilestone: document.querySelector("#nextMilestone"),
  milestoneLeft: document.querySelector("#milestoneLeft"),
  friendForm: document.querySelector("#friendForm"),
  friendName: document.querySelector("#friendName"),
  friendColor: document.querySelector("#friendColor"),
  friendList: document.querySelector("#friendList"),
  leaderboard: document.querySelector("#leaderboard"),
  periodSelect: document.querySelector("#periodSelect"),
  statsGrid: document.querySelector("#statsGrid"),
  litersTotal: document.querySelector("#litersTotal"),
  sixPackEquivalent: document.querySelector("#sixPackEquivalent"),
  dailyPace: document.querySelector("#dailyPace"),
  statsMonthChart: document.querySelector("#statsMonthChart"),
  formatChart: document.querySelector("#formatChart"),
  typeChart: document.querySelector("#typeChart"),
  statsPersonFilter: document.querySelector("#statsPersonFilter"),
  companionPersonFilter: document.querySelector("#companionPersonFilter"),
  companionBreakdown: document.querySelector("#companionBreakdown"),
  activityList: document.querySelector("#activityList"),
  appViews: document.querySelectorAll(".app-view"),
  navItems: document.querySelectorAll("[data-nav]"),
  openBeerModal: document.querySelector("#openBeerModal"),
  beerModal: document.querySelector("#beerModal"),
  friendsMenuBtn: document.querySelector("#friendsMenuBtn"),
  friendsPanel: document.querySelector("#friendsPanel"),
  exportBtn: document.querySelector("#exportBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  rewardToast: document.querySelector("#rewardToast"),
  connectionOverlay: document.querySelector("#connectionOverlay"),
  connectionStatus: document.querySelector("#connectionStatus"),
  connectionRefreshBtn: document.querySelector("#connectionRefreshBtn"),
  cheersOverlay: document.querySelector("#cheersOverlay"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

function loadLegacyState() {
  const fallback = { people: [], drinks: [] };
  let raw = null;

  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return fallback;
  }

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.people) || !Array.isArray(parsed.drinks)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function markLegacyMigrated() {
  try {
    localStorage.setItem(`${LEGACY_STORAGE_KEY}-migrated`, new Date().toISOString());
  } catch {
    // localStorage can be blocked in private contexts; Firestore still works.
  }
}

function normalizePeople(people) {
  return people
    .filter((person) => person?.name)
    .map((person, index) => ({
      id: String(person.id || createId()),
      name: String(person.name).trim(),
      color: person.color || COLORS[index % COLORS.length],
    }));
}

function normalizeDrinks(drinks) {
  return drinks
    .filter((drink) => drink?.personId && drink?.date)
    .map((drink) => {
      const companionPersonIds = normalizeCompanionIds(drink);
      return {
        id: String(drink.id || createId()),
        personId: String(drink.personId),
        count: Number(drink.count) || 1,
        date: String(drink.date),
        beerName: drink.beerName ? String(drink.beerName) : "",
        type: drink.type ? String(drink.type) : "Lager",
        format: drink.format ? String(drink.format) : "Lata",
        liters: Number(drink.liters) || getFormatLiters(drink.format || "Lata"),
        mood: drink.mood ? String(drink.mood) : "Con amigos",
        companionPersonId: companionPersonIds[0] || "",
        companionPersonIds,
        note: drink.note ? String(drink.note) : "",
        createdAt: drink.createdAt ? String(drink.createdAt) : new Date().toISOString(),
      };
    });
}

function showFirebaseError(error) {
  console.error(error);
  setConnectionStatus(error?.code ? `Firebase: ${error.code}` : "No hay conexión con Firebase.");
  document.body.classList.add("connection-error");
  if (!connectionState.connected) return;
  els.rewardToast.classList.remove("show");
  void els.rewardToast.offsetWidth;
  els.rewardToast.querySelector("span").textContent = "!";
  els.rewardToast.querySelector("strong").textContent = error?.code || "Firebase no conectó";
  els.rewardToast.classList.add("show");
}

function setConnectionStatus(message) {
  els.connectionStatus.textContent = message;
}

function markServerSnapshotReady(kind, snapshot) {
  if (snapshot.metadata.fromCache && !connectionState[kind]) {
    setConnectionStatus("Esperando confirmación del servidor...");
    return false;
  }

  connectionState[kind] = true;
  checkConnectionReady();
  return connectionState.connected;
}

function checkConnectionReady() {
  if (connectionState.connected || !connectionState.peopleReady || !connectionState.drinksReady) return;
  connectionState.connected = true;
  document.body.classList.remove("is-connecting", "connection-error");
  document.body.classList.add("is-connected");
  render();
}

function refreshApp() {
  window.location.reload();
}

function todayISO() {
  return localDateISO();
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYear() {
  return new Date().getFullYear();
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameYear(dateString, year = getYear()) {
  return parseLocalDate(dateString).getFullYear() === year;
}

function isSameMonth(dateString, ref = new Date()) {
  const date = parseLocalDate(dateString);
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth();
}

function dayOfYear(dateString) {
  const date = parseLocalDate(dateString);
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date - start) / 86400000);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
  }).format(parseLocalDate(dateString));
}

function formatDateTime(drink) {
  const createdAt = drink.createdAt ? new Date(drink.createdAt) : parseLocalDate(drink.date);
  if (Number.isNaN(createdAt.getTime())) return formatDate(drink.date);

  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(createdAt);
}

function updateNowStamp() {
  els.nowStamp.textContent = new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function formatLiters(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function getFormatLiters(format) {
  return FORMAT_LITERS[format] || FORMAT_LITERS.Otra;
}

function getSelectedFormat() {
  return document.querySelector('input[name="beerFormat"]:checked')?.value || "Lata";
}

function normalizeCompanionIds(drink) {
  const ids = Array.isArray(drink.companionPersonIds)
    ? drink.companionPersonIds
    : drink.companionPersonId
      ? [drink.companionPersonId]
      : [];
  return [...new Set(ids.map((id) => String(id)).filter(Boolean))];
}

function getCompanionIds(drink) {
  return normalizeCompanionIds(drink);
}

function getSelectedChoice(container, fallback) {
  return container.querySelector("[data-choice-value].active")?.dataset.choiceValue || fallback;
}

function getSelectedDrinkerId() {
  return els.personSelect.querySelector("[data-person-id].active")?.dataset.personId || state.people[0]?.id || "";
}

function getSelectedCompanionIds() {
  return [...els.drinkCompanionPerson.querySelectorAll("[data-companion-id].active")]
    .map((button) => button.dataset.companionId)
    .filter(Boolean);
}

function drinkLiters(drink) {
  return Number(drink.liters) || getFormatLiters(drink.format) * (Number(drink.count) || 1);
}

function totalLiters(drinks) {
  return drinks.reduce((sum, drink) => sum + drinkLiters(drink), 0);
}

async function seedInitialDataIfEmpty() {
  const [peopleSnapshot, drinksSnapshot] = await Promise.all([getDocs(peopleRef), getDocs(drinksRef)]);
  if (!peopleSnapshot.empty) return;

  const legacyState = loadLegacyState();
  const seedPeople = normalizePeople(
    legacyState.people.length ? legacyState.people : initialState.people,
  );
  const seedDrinks = drinksSnapshot.empty ? normalizeDrinks(legacyState.drinks) : [];
  const batch = writeBatch(db);

  seedPeople.forEach((person) => {
    batch.set(doc(peopleRef, person.id), {
      name: person.name,
      color: person.color,
      createdAt: serverTimestamp(),
    });
  });

  seedDrinks.forEach((drink) => {
    batch.set(doc(drinksRef, drink.id), {
      personId: drink.personId,
      count: drink.count,
      date: drink.date,
      beerName: drink.beerName,
      type: drink.type,
      format: drink.format,
      liters: drink.liters,
      mood: drink.mood,
      companionPersonId: drink.companionPersonId,
      companionPersonIds: drink.companionPersonIds,
      note: drink.note,
      createdAt: drink.createdAt,
      serverCreatedAt: serverTimestamp(),
    });
  });

  batch.set(
    groupRef,
    {
      name: "Beer Year",
      seededAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
  markLegacyMigrated();
}

function listenToFirestore() {
  onSnapshot(
    peopleRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      state.people = snapshot.docs
        .map((personDoc) => ({
          id: personDoc.id,
          name: personDoc.data().name,
          color: personDoc.data().color,
        }))
        .filter((person) => person.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (markServerSnapshotReady("peopleReady", snapshot)) render();
    },
    showFirebaseError,
  );

  onSnapshot(
    drinksRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      state.drinks = snapshot.docs
        .map((drinkDoc) => ({
          id: drinkDoc.id,
          ...drinkDoc.data(),
        }))
        .filter((drink) => drink.personId && drink.date);
      if (markServerSnapshotReady("drinksReady", snapshot)) render();
    },
    showFirebaseError,
  );
}

async function startFirebase() {
  try {
    setConnectionStatus("Entrando al bar...");
    await signInAnonymously(auth);
    setConnectionStatus("Buscando la base de datos real...");
    await seedInitialDataIfEmpty();
    setConnectionStatus("Sincronizando marcador...");
    listenToFirestore();
  } catch (error) {
    showFirebaseError(error);
  }
}

function getPerson(id) {
  return state.people.find((person) => person.id === id);
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function drinkFilter(period) {
  if (period === "month") return (drink) => isSameMonth(drink.date);
  if (period === "year") return (drink) => isSameYear(drink.date);
  return () => true;
}

function totalsByPerson(period = "year") {
  const filter = drinkFilter(period);
  const totals = new Map(state.people.map((person) => [person.id, 0]));

  state.drinks.filter(filter).forEach((drink) => {
    totals.set(drink.personId, (totals.get(drink.personId) || 0) + Number(drink.count));
  });

  return state.people
    .map((person) => ({
      ...person,
      total: totals.get(person.id) || 0,
      sessions: state.drinks.filter((drink) => drink.personId === person.id && filter(drink)).length,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function yearDrinks() {
  return state.drinks.filter((drink) => isSameYear(drink.date));
}

function sumDrinks(drinks) {
  return drinks.reduce((sum, drink) => sum + Number(drink.count), 0);
}

function getDayTotals(drinks) {
  return drinks.reduce((map, drink) => {
    map.set(drink.date, (map.get(drink.date) || 0) + Number(drink.count));
    return map;
  }, new Map());
}

function biggestDayStat() {
  const totals = [...getDayTotals(yearDrinks()).entries()].sort((a, b) => b[1] - a[1]);
  return totals[0] || null;
}

function render() {
  const year = getYear();
  const drinksThisYear = yearDrinks();
  const yearTotal = sumDrinks(drinksThisYear);
  const leader = totalsByPerson("year")[0];
  const biggest = biggestDayStat();

  els.currentYear.textContent = year;
  els.yearTotal.textContent = yearTotal;
  els.paceStat.textContent = `Ritmo: ${projectedYearTotal(yearTotal)} al cierre`;
  els.leaderName.textContent = leader && leader.total > 0 ? leader.name : "Sin datos";
  els.leaderStat.textContent = `${leader?.total || 0} cervezas`;
  els.biggestDay.textContent = biggest ? formatDate(biggest[0]) : "Sin datos";
  els.biggestDayStat.textContent = `${biggest?.[1] || 0} cervezas`;

  renderPersonSelect();
  renderCompanionSelect();
  renderStatsPersonFilter();
  renderCompanionFilter();
  renderFriends();
  renderLeaderboard();
  renderMonthChart();
  renderRewardStats();
  renderStats();
  renderCompanionBreakdown();
  renderActivity();
}

function projectedYearTotal(total) {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  const elapsed = Math.max(1, Math.ceil((now - start) / 86400000) + 1);
  const totalDays = Math.ceil((end - start) / 86400000) + 1;
  return Math.round((total / elapsed) * totalDays);
}

function renderPersonSelect() {
  const currentValue = getSelectedDrinkerId();
  const selectedId = state.people.some((person) => person.id === currentValue)
    ? currentValue
    : state.people[0]?.id || "";
  els.personSelect.innerHTML = state.people
    .map(
      (person) => `
        <button class="choice-pill person-pill ${person.id === selectedId ? "active" : ""}" type="button" data-person-id="${person.id}">
          <span class="mini-avatar" style="background:${person.color}">${escapeHTML(initials(person.name))}</span>
          ${escapeHTML(person.name)}
        </button>
      `,
    )
    .join("");
}

function renderCompanionSelect() {
  const selectedIds = getSelectedCompanionIds();
  const drinkerId = getSelectedDrinkerId();
  const companions = state.people.filter((person) => person.id !== drinkerId);
  const validSelectedIds = selectedIds.filter((id) => companions.some((person) => person.id === id));
  els.drinkCompanionPerson.innerHTML = [
    `<button class="choice-pill ${validSelectedIds.length ? "" : "active"}" type="button" data-companion-none>Solo</button>`,
    ...companions.map(
      (person) => `
        <button class="choice-pill person-pill ${validSelectedIds.includes(person.id) ? "active" : ""}" type="button" data-companion-id="${person.id}">
          <span class="mini-avatar" style="background:${person.color}">${escapeHTML(initials(person.name))}</span>
          ${escapeHTML(person.name)}
        </button>
      `,
    ),
  ].join("");
}

function renderCompanionFilter() {
  const currentValue = uiState.companionPersonId || uiState.statsPersonId;
  const selectedId = state.people.some((person) => person.id === currentValue)
    ? currentValue
    : state.people[0]?.id || "";
  uiState.companionPersonId = selectedId;
  els.companionPersonFilter.innerHTML = state.people
    .map(
      (person) => `
        <button class="${person.id === selectedId ? "active" : ""}" type="button" data-companion-filter="${person.id}">
          ${escapeHTML(person.name)}
        </button>
      `,
    )
    .join("");
}

function renderStatsPersonFilter() {
  const selectedId = uiState.statsPersonId === "all" || state.people.some((person) => person.id === uiState.statsPersonId)
    ? uiState.statsPersonId
    : "all";
  uiState.statsPersonId = selectedId;
  els.statsPersonFilter.innerHTML = [
    `<button class="${selectedId === "all" ? "active" : ""}" type="button" data-stats-person="all">Todos</button>`,
    ...state.people.map(
      (person) => `
        <button class="${person.id === selectedId ? "active" : ""}" type="button" data-stats-person="${person.id}">
          ${escapeHTML(person.name)}
        </button>
      `,
    ),
  ].join("");
}

function renderFriends() {
  els.friendList.innerHTML = "";
  state.people.forEach((person) => {
    const chip = document.createElement("div");
    chip.className = "friend-chip";
    chip.innerHTML = `
      <div class="person-id">
        <span class="avatar" style="background:${person.color}">${escapeHTML(initials(person.name))}</span>
        <span>${escapeHTML(person.name)}</span>
      </div>
      <button class="danger-button" type="button" data-remove-person="${person.id}">Quitar</button>
    `;
    els.friendList.append(chip);
  });
}

function renderLeaderboard() {
  const period = uiState.leaderboardPeriod;
  const filter = drinkFilter(period);
  const totals = totalsByPerson(period);
  const max = Math.max(1, ...totals.map((person) => person.total));
  els.leaderboard.innerHTML = "";

  totals.forEach((person, index) => {
    const row = document.createElement("div");
    row.className = "leader-card";
    row.style.setProperty("--leader-width", `${Math.max(5, (person.total / max) * 100)}%`);
    const expanded = uiState.expandedLeaderId === person.id;
    const personDrinks = state.drinks
      .filter((drink) => drink.personId === person.id && filter(drink))
      .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`));
    const visibleDrinks = personDrinks.slice(0, 12);
    row.innerHTML = `
      <button class="leader-row" type="button" data-toggle-leader="${person.id}" aria-expanded="${expanded}">
        <div class="rank">#${index + 1}</div>
        <div class="leader-info">
          <strong>${escapeHTML(person.name)}</strong>
          <span>${person.sessions} subidas registradas · tocar para ver chelas</span>
        </div>
        <div class="leader-total">
          <strong>${person.total}</strong>
          <span>cervezas</span>
        </div>
      </button>
      ${
        expanded
          ? `<div class="leader-drinks">
              ${
                visibleDrinks.length
                  ? visibleDrinks.map((drink) => leaderDrinkMarkup(drink)).join("")
                  : `<div class="leader-drink empty-leader-drink">Sin birras en este periodo.</div>`
              }
              ${
                personDrinks.length > visibleDrinks.length
                  ? `<div class="leader-more">+${personDrinks.length - visibleDrinks.length} más en este periodo</div>`
                  : ""
              }
            </div>`
          : ""
      }
    `;
    els.leaderboard.append(row);
  });
}

function leaderDrinkMarkup(drink) {
  const beerName = drink.beerName || drink.type || "Cerveza";
  const companions = companionNames(drink);
  const details = [formatDateTime(drink), drink.format, `${formatLiters(drinkLiters(drink))} L`, companions]
    .filter(Boolean)
    .join(" · ");
  return `
    <div class="leader-drink">
      <strong>${escapeHTML(beerName)}</strong>
      <span>${escapeHTML(details)}</span>
    </div>
  `;
}

function renderRewardStats() {
  const today = todayISO();
  const todayTotal = sumDrinks(state.drinks.filter((drink) => drink.date === today));
  const yearTotal = sumDrinks(yearDrinks());

  els.todayCount.textContent = todayTotal;
  els.nextMilestone.textContent = yearTotal;
  els.milestoneLeft.textContent = projectedYearTotal(yearTotal);
}

function renderMonthChart() {
  const { label, bars } = mainChartData(yearDrinks(), uiState.mainChartRange);
  els.mainChartLabel.textContent = label;
  els.monthChart.dataset.range = uiState.mainChartRange;
  els.monthChart.innerHTML = barChartMarkup(bars);
}

function renderStatsMonthChart(drinks) {
  els.statsMonthChart.innerHTML = barChartMarkup(monthChartBars(drinks));
}

function monthChartBars(drinks) {
  const totals = Array.from({ length: 12 }, () => 0);
  drinks.forEach((drink) => {
    totals[parseLocalDate(drink.date).getMonth()] += Number(drink.count);
  });

  return totals.map((total, index) => ({
    label: MONTHS[index],
    total,
    title: `${MONTHS[index]}: ${total}`,
  }));
}

function weekChartBars(drinks) {
  const weeks = Array.from({ length: 53 }, (_, index) => ({
    label: `S${index + 1}`,
    total: 0,
    title: `Semana ${index + 1}: 0`,
  }));
  drinks.forEach((drink) => {
    const weekIndex = Math.min(52, Math.floor(dayOfYear(drink.date) / 7));
    weeks[weekIndex].total += Number(drink.count);
  });
  return weeks.map((week, index) => ({
    ...week,
    title: `Semana ${index + 1}: ${week.total}`,
  }));
}

function dayChartBars(drinks) {
  const year = getYear();
  const daysInYear = Math.ceil((new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000);
  const totals = Array.from({ length: daysInYear }, (_, index) => {
    const date = new Date(year, 0, index + 1);
    const label = date.getDate() === 1 ? MONTHS[date.getMonth()] : date.getDay() === 1 ? String(date.getDate()) : "";
    return {
      label,
      total: 0,
      title: `${formatDate(localDateISO(date))}: 0`,
    };
  });

  drinks.forEach((drink) => {
    const index = dayOfYear(drink.date);
    if (!totals[index]) return;
    totals[index].total += Number(drink.count);
  });

  return totals.map((day, index) => {
    const date = new Date(year, 0, index + 1);
    return {
      ...day,
      title: `${formatDate(localDateISO(date))}: ${day.total}`,
    };
  });
}

function mainChartData(drinks, range) {
  if (range === "week") {
    return { label: "Distribución por semana", bars: weekChartBars(drinks) };
  }
  if (range === "day") {
    return { label: "Distribución diaria del año", bars: dayChartBars(drinks) };
  }
  return { label: "Distribución por mes", bars: monthChartBars(drinks) };
}

function barChartMarkup(bars) {
  const max = Math.max(1, ...bars.map((bar) => bar.total));
  return bars
    .map((bar) => {
      const height = Math.max(6, Math.round((bar.total / max) * 100));
      return `
        <div class="bar-wrap" title="${escapeHTML(bar.title)}">
          <div class="bar" style="height:${height}px"></div>
          <span class="bar-label">${escapeHTML(bar.label)}</span>
        </div>
      `;
    })
    .join("");
}

function renderStats() {
  const drinks = getStatsDrinks();
  const total = sumDrinks(drinks);
  const liters = totalLiters(drinks);
  const activeDays = getDayTotals(drinks).size;
  const entries = drinks.length;
  const topType = topBy(drinks, "type");
  const topBeer = topBy(drinks, "beerName");
  const topFormat = topBy(drinks, "format");
  const topPlan = topBy(drinks, "mood");
  const accompanied = drinks.filter((drink) => getCompanionIds(drink).length);
  const topCompanionId = topCompanionByDrinks(drinks);
  const topCompanion = getPerson(topCompanionId);
  const topFriend = totalsByPerson("year")[0];
  const selectedPerson = getPerson(uiState.statsPersonId);

  const stats = [
    ["Cerveza top", topBeer || "Sin datos"],
    ["Presentación top", topFormat || "Sin datos"],
    ["Con amigos", entries ? `${Math.round((accompanied.length / entries) * 100)}%` : "0%"],
    ["Partner top", topCompanion?.name || "Sin datos"],
    ["Tipo top", topType || "Sin datos"],
    ["Plan top", topPlan || "Sin datos"],
    [
      uiState.statsPersonId === "all" ? "MVP" : "Jugador",
      uiState.statsPersonId === "all"
        ? topFriend?.total ? topFriend.name : "Sin datos"
        : selectedPerson?.name || "Sin datos",
    ],
  ];

  els.statsGrid.innerHTML = stats
    .map(
      ([label, value]) => `
        <div class="stat-card">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(String(value))}</strong>
        </div>
      `,
    )
    .join("");

  els.litersTotal.textContent = `${liters.toFixed(1)} L`;
  els.sixPackEquivalent.textContent = `${(liters / (FORMAT_LITERS.Lata * 6)).toFixed(1)}`;
  els.dailyPace.textContent = `${(activeDays ? liters / activeDays : 0).toFixed(2)} L`;
  renderStatsMonthChart(drinks);
  renderBreakdownChart(els.formatChart, totalsByKey(drinks, "format"));
  renderBreakdownChart(els.typeChart, totalsByKey(drinks, "type"));
}

function getStatsDrinks() {
  const drinks = yearDrinks();
  if (uiState.statsPersonId === "all") return drinks;
  return drinks.filter((drink) => drink.personId === uiState.statsPersonId);
}

function totalsByKey(items, key) {
  return [...items.reduce((map, item) => {
    const value = item[key] || "Sin dato";
    map.set(value, (map.get(value) || 0) + Number(item.count));
    return map;
  }, new Map()).entries()].sort((a, b) => b[1] - a[1]);
}

function topCompanionByDrinks(drinks) {
  const counts = drinks.reduce((map, drink) => {
    getCompanionIds(drink).forEach((id) => {
      map.set(id, (map.get(id) || 0) + Number(drink.count));
    });
    return map;
  }, new Map());

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function renderBreakdownChart(container, rows) {
  const max = Math.max(1, ...rows.map((row) => row[1]));
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state compact-empty"><strong>Sin datos</strong><span>Las gráficas arrancan con la primera birra.</span></div>`;
    return;
  }

  container.innerHTML = rows
    .slice(0, 6)
    .map(([label, total]) => {
      const width = Math.max(4, (total / max) * 100);
      return `
        <div class="breakdown-row">
          <span>${escapeHTML(label)}</span>
          <div class="breakdown-meter"><span style="width:${width}%"></span></div>
          <strong>${total}</strong>
        </div>
      `;
    })
    .join("");
}

function renderCompanionBreakdown() {
  const selectedId = uiState.companionPersonId || state.people[0]?.id;
  const selectedPerson = getPerson(selectedId);
  const drinks = yearDrinks().filter((drink) => drink.personId === selectedId);
  const friends = state.people.filter((person) => person.id !== selectedId);
  const max = Math.max(
    1,
    ...friends.map((friend) =>
      sumDrinks(drinks.filter((drink) => getCompanionIds(drink).includes(friend.id))),
    ),
  );
  const soloTotal = sumDrinks(drinks.filter((drink) => !getCompanionIds(drink).length));

  if (!selectedPerson) {
    els.companionBreakdown.innerHTML = emptyCompanionState("Agregá amigos para ver este breakdown.");
    return;
  }

  if (!friends.length) {
    els.companionBreakdown.innerHTML = emptyCompanionState("Agregá otro jugador al equipo.");
    return;
  }

  const rows = friends
    .map((friend) => {
      const total = sumDrinks(drinks.filter((drink) => getCompanionIds(drink).includes(friend.id)));
      const width = Math.max(4, (total / max) * 100);
      return `
        <div class="companion-row">
          <div class="person-id">
            <span class="avatar" style="background:${friend.color}">${escapeHTML(initials(friend.name))}</span>
            <span>${escapeHTML(friend.name)}</span>
          </div>
          <div class="companion-meter" aria-label="${escapeHTML(friend.name)}: ${total}">
            <span style="width:${width}%"></span>
          </div>
          <strong>${total}</strong>
        </div>
      `;
    })
    .join("");

  els.companionBreakdown.innerHTML = `
    ${rows}
    <div class="companion-solo">
      <span>${escapeHTML(selectedPerson.name)} sin acompañante marcado</span>
      <strong>${soloTotal}</strong>
    </div>
  `;
}

function emptyCompanionState(message) {
  return `<div class="empty-state compact-empty"><strong>Sin breakdown</strong><span>${escapeHTML(message)}</span></div>`;
}

function topBy(items, key) {
  const counts = items.reduce((map, item) => {
    const value = item[key];
    if (!value) return map;
    map.set(value, (map.get(value) || 0) + Number(item.count));
    return map;
  }, new Map());

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function renderActivity() {
  els.activityList.innerHTML = "";
  const recent = [...state.drinks]
    .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))
    .slice(0, 8);

  if (!recent.length) {
    els.activityList.append(els.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  recent.forEach((drink) => {
    const person = getPerson(drink.personId);

    const row = document.createElement("div");
    row.className = "activity-row";
    const beerName = drink.beerName || drink.type || "Cerveza";
    const volume = `${formatLiters(drinkLiters(drink))} L`;
    const details = [drink.format, volume, drink.mood, companionNames(drink)]
      .filter(Boolean)
      .join(" · ");
    row.innerHTML = `
      <div>
        <strong>${escapeHTML(person?.name || "Jugador eliminado")} · ${escapeHTML(beerName)}</strong>
        <span>${formatDateTime(drink)}${details ? ` · ${escapeHTML(details)}` : ""}${drink.note ? ` · ${escapeHTML(drink.note)}` : ""}</span>
      </div>
      <div class="activity-actions">
        <span class="beer-badge">${drink.count}</span>
        <button class="danger-button" type="button" data-remove-drink="${drink.id}">Borrar</button>
      </div>
    `;
    els.activityList.append(row);
  });
}

function companionNames(drink) {
  const names = getCompanionIds(drink)
    .map((id) => getPerson(id)?.name)
    .filter(Boolean);
  if (!names.length) return "";
  return `con ${names.join(", ")}`;
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

async function addDrink(event) {
  event.preventDefault();
  if (!state.people.length) return;
  const button = els.drinkForm.querySelector(".primary-button");
  button.disabled = true;
  const now = new Date();
  const format = getSelectedFormat();
  const liters = getFormatLiters(format);
  const selectedPersonId = getSelectedDrinkerId();
  const companionPersonIds = getSelectedCompanionIds().filter((id) => id !== selectedPersonId);
  if (!selectedPersonId) {
    button.disabled = false;
    return;
  }

  try {
    await addDoc(drinksRef, {
      personId: selectedPersonId,
      count: 1,
      date: localDateISO(now),
      beerName: els.beerName.value.trim(),
      type: getSelectedChoice(els.beerType, "Lager"),
      format,
      liters,
      mood: getSelectedChoice(els.drinkMood, "Con amigos"),
      companionPersonId: companionPersonIds[0] || "",
      companionPersonIds,
      note: els.drinkNote.value.trim(),
      createdAt: now.toISOString(),
      serverCreatedAt: serverTimestamp(),
    });

    els.beerName.value = "";
    els.drinkNote.value = "";
    rewardUpload();
    setTimeout(() => closeModal(els.beerModal), 260);
  } catch (error) {
    showFirebaseError(error);
  } finally {
    button.disabled = false;
  }
}

function rewardUpload() {
  const button = els.drinkForm.querySelector(".primary-button");
  const mainScore = document.querySelector(".main-score");

  els.rewardToast.querySelector("span").textContent = "+1";
  els.rewardToast.querySelector("strong").textContent = "Birra sumada";
  els.rewardToast.classList.remove("show");
  button.classList.remove("just-added");
  mainScore.classList.remove("score-bump");
  void els.rewardToast.offsetWidth;
  els.rewardToast.classList.add("show");
  button.classList.add("just-added");
  mainScore.classList.add("score-bump");
  triggerCheers();
  setTimeout(() => button.classList.remove("just-added"), 520);

  const rect = button.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  for (let index = 0; index < 10; index += 1) {
    const pop = document.createElement("span");
    pop.className = "beer-pop";
    pop.style.left = `${originX}px`;
    pop.style.top = `${originY}px`;
    pop.style.setProperty("--pop-x", `${Math.random() * 180 - 90}px`);
    pop.style.setProperty("--pop-y", `${Math.random() * -120 - 40}px`);
    document.body.append(pop);
    pop.addEventListener("animationend", () => pop.remove(), { once: true });
  }
}

function triggerCheers() {
  els.cheersOverlay.classList.remove("show");
  void els.cheersOverlay.offsetWidth;
  els.cheersOverlay.classList.add("show");
}

async function addFriend(event) {
  event.preventDefault();
  const name = els.friendName.value.trim();
  if (!name) return;
  const id = createId();

  try {
    await setDoc(doc(peopleRef, id), {
      name,
      color: els.friendColor.value || COLORS[state.people.length % COLORS.length],
      createdAt: serverTimestamp(),
    });

    els.friendName.value = "";
    els.friendColor.value = COLORS[(state.people.length + 1) % COLORS.length];
  } catch (error) {
    showFirebaseError(error);
  }
}

async function removePerson(id) {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(peopleRef, id));
    state.drinks.forEach((drink) => {
      const drinkRef = doc(drinksRef, drink.id);
      if (drink.personId === id) {
        batch.delete(drinkRef);
      } else if (getCompanionIds(drink).includes(id)) {
        const companionPersonIds = getCompanionIds(drink).filter((companionId) => companionId !== id);
        batch.set(
          drinkRef,
          {
            companionPersonId: companionPersonIds[0] || "",
            companionPersonIds,
          },
          { merge: true },
        );
      }
    });
    await batch.commit();
  } catch (error) {
    showFirebaseError(error);
  }
}

async function removeDrink(id) {
  try {
    await deleteDoc(doc(drinksRef, id));
  } catch (error) {
    showFirebaseError(error);
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `beer-year-${getYear()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.people) || !Array.isArray(parsed.drinks)) return;
      const batch = writeBatch(db);
      normalizePeople(parsed.people).forEach((person) => {
        batch.set(doc(peopleRef, person.id), {
          name: person.name,
          color: person.color,
          importedAt: serverTimestamp(),
        });
      });
      normalizeDrinks(parsed.drinks).forEach((drink) => {
        batch.set(doc(drinksRef, drink.id), {
          personId: drink.personId,
          count: drink.count,
          date: drink.date,
          beerName: drink.beerName,
          type: drink.type,
          format: drink.format,
          liters: drink.liters,
          mood: drink.mood,
          companionPersonId: drink.companionPersonId,
          companionPersonIds: drink.companionPersonIds,
          note: drink.note,
          createdAt: drink.createdAt,
          serverCreatedAt: serverTimestamp(),
          importedAt: serverTimestamp(),
        });
      });
      batch.set(groupRef, { updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      event.target.value = "";
    } catch {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function setActiveView(view) {
  els.appViews.forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });
  els.navItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === view);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(modal) {
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal-backdrop.active")) {
    document.body.classList.remove("modal-open");
  }
}

document.addEventListener("click", (event) => {
  const personBtn = event.target.closest("[data-remove-person]");
  const drinkBtn = event.target.closest("[data-remove-drink]");
  const closeBtn = event.target.closest("[data-close-modal]");
  const leaderBtn = event.target.closest("[data-toggle-leader]");
  const drinkerBtn = event.target.closest("[data-person-id]");
  const companionBtn = event.target.closest("[data-companion-id]");
  const companionNoneBtn = event.target.closest("[data-companion-none]");
  const choiceBtn = event.target.closest("[data-choice-value]");
  const periodBtn = event.target.closest("[data-period]");
  const mainChartBtn = event.target.closest("[data-main-chart]");
  const statsPersonBtn = event.target.closest("[data-stats-person]");
  const companionFilterBtn = event.target.closest("[data-companion-filter]");
  const backdrop = event.target.classList.contains("modal-backdrop") ? event.target : null;

  if (personBtn) removePerson(personBtn.dataset.removePerson);
  if (drinkBtn) removeDrink(drinkBtn.dataset.removeDrink);
  if (closeBtn) closeModal(closeBtn.closest(".modal-backdrop"));
  if (leaderBtn) {
    uiState.expandedLeaderId = uiState.expandedLeaderId === leaderBtn.dataset.toggleLeader
      ? ""
      : leaderBtn.dataset.toggleLeader;
    renderLeaderboard();
  }
  if (drinkerBtn && els.personSelect.contains(drinkerBtn)) {
    els.personSelect.querySelectorAll("[data-person-id]").forEach((button) => {
      button.classList.toggle("active", button === drinkerBtn);
    });
    renderCompanionSelect();
  }
  if (choiceBtn && (els.beerType.contains(choiceBtn) || els.drinkMood.contains(choiceBtn))) {
    choiceBtn.parentElement.querySelectorAll("[data-choice-value]").forEach((button) => {
      button.classList.toggle("active", button === choiceBtn);
    });
  }
  if (companionNoneBtn && els.drinkCompanionPerson.contains(companionNoneBtn)) {
    els.drinkCompanionPerson.querySelectorAll("[data-companion-id]").forEach((button) => {
      button.classList.remove("active");
    });
    companionNoneBtn.classList.add("active");
  }
  if (companionBtn && els.drinkCompanionPerson.contains(companionBtn)) {
    companionBtn.classList.toggle("active");
    const hasCompanions = Boolean(els.drinkCompanionPerson.querySelector("[data-companion-id].active"));
    els.drinkCompanionPerson.querySelector("[data-companion-none]")?.classList.toggle("active", !hasCompanions);
  }
  if (periodBtn && els.periodSelect.contains(periodBtn)) {
    uiState.leaderboardPeriod = periodBtn.dataset.period;
    els.periodSelect.querySelectorAll("[data-period]").forEach((button) => {
      button.classList.toggle("active", button === periodBtn);
    });
    renderLeaderboard();
  }
  if (mainChartBtn && els.mainChartRange.contains(mainChartBtn)) {
    uiState.mainChartRange = mainChartBtn.dataset.mainChart;
    els.mainChartRange.querySelectorAll("[data-main-chart]").forEach((button) => {
      button.classList.toggle("active", button === mainChartBtn);
    });
    renderMonthChart();
  }
  if (statsPersonBtn && els.statsPersonFilter.contains(statsPersonBtn)) {
    uiState.statsPersonId = statsPersonBtn.dataset.statsPerson;
    if (uiState.statsPersonId !== "all") uiState.companionPersonId = uiState.statsPersonId;
    renderStatsPersonFilter();
    renderCompanionFilter();
    renderStats();
    renderCompanionBreakdown();
  }
  if (companionFilterBtn && els.companionPersonFilter.contains(companionFilterBtn)) {
    uiState.companionPersonId = companionFilterBtn.dataset.companionFilter;
    renderCompanionFilter();
    renderCompanionBreakdown();
  }
  if (backdrop) closeModal(backdrop);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".modal-backdrop.active").forEach((modal) => closeModal(modal));
});

els.drinkForm.addEventListener("submit", addDrink);
els.friendForm.addEventListener("submit", addFriend);
els.navItems.forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.nav));
});
els.openBeerModal.addEventListener("click", () => {
  updateNowStamp();
  renderCompanionSelect();
  openModal(els.beerModal);
  setTimeout(() => els.beerName.focus(), 80);
});
els.friendsMenuBtn.addEventListener("click", () => openModal(els.friendsPanel));
els.exportBtn.addEventListener("click", exportData);
els.refreshBtn.addEventListener("click", refreshApp);
els.connectionRefreshBtn.addEventListener("click", refreshApp);

updateNowStamp();
els.friendColor.value = COLORS[state.people.length % COLORS.length];
startFirebase();
