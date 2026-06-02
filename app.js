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
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
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
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const COUNTRY_STORAGE_KEY = "beer-year-last-country";
const DEFAULT_COUNTRY = "Guatemala";
const COUNTRIES = [
  { name: "Guatemala", flag: "🇬🇹", zones: ["America/Guatemala"] },
  { name: "México", flag: "🇲🇽", zones: ["America/Mexico_City", "America/Monterrey", "America/Tijuana", "America/Cancun", "America/Merida", "America/Chihuahua", "America/Hermosillo"] },
  { name: "El Salvador", flag: "🇸🇻", zones: ["America/El_Salvador"] },
  { name: "Honduras", flag: "🇭🇳", zones: ["America/Tegucigalpa"] },
  { name: "Nicaragua", flag: "🇳🇮", zones: ["America/Managua"] },
  { name: "Costa Rica", flag: "🇨🇷", zones: ["America/Costa_Rica"] },
  { name: "Panamá", flag: "🇵🇦", zones: ["America/Panama"] },
  { name: "Belice", flag: "🇧🇿", zones: ["America/Belize"] },
  { name: "Estados Unidos", flag: "🇺🇸", zones: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix"] },
  { name: "Canadá", flag: "🇨🇦", zones: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg"] },
  { name: "Colombia", flag: "🇨🇴", zones: ["America/Bogota"] },
  { name: "Venezuela", flag: "🇻🇪", zones: ["America/Caracas"] },
  { name: "Ecuador", flag: "🇪🇨", zones: ["America/Guayaquil"] },
  { name: "Perú", flag: "🇵🇪", zones: ["America/Lima"] },
  { name: "Bolivia", flag: "🇧🇴", zones: ["America/La_Paz"] },
  { name: "Chile", flag: "🇨🇱", zones: ["America/Santiago"] },
  { name: "Argentina", flag: "🇦🇷", zones: ["America/Argentina/Buenos_Aires", "America/Argentina/Cordoba"] },
  { name: "Uruguay", flag: "🇺🇾", zones: ["America/Montevideo"] },
  { name: "Paraguay", flag: "🇵🇾", zones: ["America/Asuncion"] },
  { name: "Brasil", flag: "🇧🇷", zones: ["America/Sao_Paulo", "America/Bahia", "America/Fortaleza"] },
  { name: "España", flag: "🇪🇸", zones: ["Europe/Madrid", "Atlantic/Canary"] },
  { name: "Italia", flag: "🇮🇹", zones: ["Europe/Rome"] },
  { name: "Alemania", flag: "🇩🇪", zones: ["Europe/Berlin"] },
  { name: "Bélgica", flag: "🇧🇪", zones: ["Europe/Brussels"] },
  { name: "Reino Unido", flag: "🇬🇧", zones: ["Europe/London"] },
  { name: "Irlanda", flag: "🇮🇪", zones: ["Europe/Dublin"] },
  { name: "República Dominicana", flag: "🇩🇴", zones: ["America/Santo_Domingo"] },
  { name: "Cuba", flag: "🇨🇺", zones: ["America/Havana"] },
  { name: "Puerto Rico", flag: "🇵🇷", zones: ["America/Puerto_Rico"] },
  { name: "Otro (Europa)", flag: "🇪🇺", zones: [] },
  { name: "Otro", flag: "🍺", zones: [] },
];
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
const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
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
  statsPersonIds: [],
  companionPersonId: "",
  mainChartRange: "month",
  mainChartAnchorDate: todayISO(),
  editingDrinkId: "",
  editingFriendId: "",
};
let undoTimer = null;
let pendingUndo = null;
let connectionFallbackTimer = null;
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
  mainChartDate: document.querySelector("#mainChartDate"),
  mainChartDateLabel: document.querySelector("#mainChartDateLabel"),
  drinkForm: document.querySelector("#drinkForm"),
  personSelect: document.querySelector("#personSelect"),
  nowStamp: document.querySelector("#nowStamp"),
  drinkWhen: document.querySelector("#drinkWhen"),
  drinkWhenNow: document.querySelector("#drinkWhenNow"),
  drinkCount: document.querySelector("#drinkCount"),
  qtyMinus: document.querySelector("#qtyMinus"),
  qtyPlus: document.querySelector("#qtyPlus"),
  trackerTitle: document.querySelector("#trackerTitle"),
  trackerEyebrow: document.querySelector("#trackerEyebrow"),
  drinkSubmitLabel: document.querySelector("#drinkSubmitLabel"),
  beerName: document.querySelector("#beerName"),
  beerType: document.querySelector("#beerType"),
  customMlField: document.querySelector("#customMlField"),
  customMl: document.querySelector("#customMl"),
  drinkMood: document.querySelector("#drinkMood"),
  drinkCompanionPerson: document.querySelector("#drinkCompanionPerson"),
  drinkCountry: document.querySelector("#drinkCountry"),
  countryHint: document.querySelector("#countryHint"),
  drinkNote: document.querySelector("#drinkNote"),
  todayCount: document.querySelector("#todayCount"),
  nextMilestone: document.querySelector("#nextMilestone"),
  milestoneLeft: document.querySelector("#milestoneLeft"),
  friendForm: document.querySelector("#friendForm"),
  friendName: document.querySelector("#friendName"),
  friendColor: document.querySelector("#friendColor"),
  friendSubmitLabel: document.querySelector("#friendSubmitLabel"),
  friendCancelBtn: document.querySelector("#friendCancelBtn"),
  friendList: document.querySelector("#friendList"),
  leaderboard: document.querySelector("#leaderboard"),
  periodSelect: document.querySelector("#periodSelect"),
  statsGrid: document.querySelector("#statsGrid"),
  litersTotal: document.querySelector("#litersTotal"),
  sixPackEquivalent: document.querySelector("#sixPackEquivalent"),
  dailyPace: document.querySelector("#dailyPace"),
  statsMonthChart: document.querySelector("#statsMonthChart"),
  weekdayChart: document.querySelector("#weekdayChart"),
  formatChart: document.querySelector("#formatChart"),
  typeChart: document.querySelector("#typeChart"),
  countryChart: document.querySelector("#countryChart"),
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
  undoToast: document.querySelector("#undoToast"),
  undoToastText: document.querySelector("#undoToastText"),
  undoBtn: document.querySelector("#undoBtn"),
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
        country: drink.country ? String(drink.country) : "",
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
  revealApp();
}

function revealApp({ degraded = false } = {}) {
  if (connectionFallbackTimer) {
    clearTimeout(connectionFallbackTimer);
    connectionFallbackTimer = null;
  }
  connectionState.connected = true;
  document.body.classList.remove("is-connecting", "connection-error");
  document.body.classList.toggle("is-degraded", degraded);
  document.body.classList.add("is-connected");
  render();
}

function scheduleConnectionFallback() {
  if (connectionFallbackTimer) clearTimeout(connectionFallbackTimer);
  connectionFallbackTimer = setTimeout(() => {
    if (connectionState.connected) return;
    setConnectionStatus("Entrando con datos guardados...");
    revealApp({ degraded: true });
  }, 8000);
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

function isSameLocalDay(dateA, dateB) {
  return localDateISO(dateA) === localDateISO(dateB);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfWeek(date) {
  const dayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -dayOffset);
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

function formatLiters(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function getFormatLiters(format) {
  return FORMAT_LITERS[format] || FORMAT_LITERS.Otra;
}

function getSelectedFormat() {
  return document.querySelector('input[name="beerFormat"]:checked')?.value || "Lata";
}

function getCustomMl() {
  const ml = Number(els.customMl.value);
  if (!Number.isFinite(ml) || ml <= 0) return Math.round(FORMAT_LITERS.Otra * 1000);
  return Math.min(3000, Math.max(10, Math.round(ml)));
}

function getDrinkLitersForFormat(format) {
  return format === "Otra" ? getCustomMl() / 1000 : getFormatLiters(format);
}

function syncCustomMlField() {
  const isOther = getSelectedFormat() === "Otra";
  els.customMlField.hidden = !isOther;
  // Deshabilitar el campo oculto lo excluye de la validacion y del envio del form,
  // asi un valor invalido escondido no bloquea el boton de sumar birra.
  els.customMl.disabled = !isOther;
}

function localDateTimeValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getWhenDate() {
  const value = els.drinkWhen.value;
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function setWhenToNow() {
  els.drinkWhen.value = localDateTimeValue(new Date());
  updateWhenHint();
}

function updateWhenHint() {
  const when = getWhenDate();
  els.nowStamp.textContent = isSameLocalDay(when, new Date()) ? "· hoy" : `· ${formatDate(localDateISO(when))}`;
}

function getDrinkCount() {
  const value = Math.round(Number(els.drinkCount.value));
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(99, value);
}

function setDrinkCount(value) {
  els.drinkCount.value = String(Math.min(99, Math.max(1, Math.round(value) || 1)));
}

function setSelectedFormat(format) {
  const radio = els.drinkForm.querySelector(`input[name="beerFormat"][value="${format}"]`)
    || els.drinkForm.querySelector('input[name="beerFormat"][value="Lata"]');
  if (radio) radio.checked = true;
}

function setSelectedChoice(container, value) {
  const buttons = container.querySelectorAll("[data-choice-value]");
  let matched = false;
  buttons.forEach((button) => {
    const active = button.dataset.choiceValue === value;
    button.classList.toggle("active", active);
    if (active) matched = true;
  });
  if (!matched && buttons[0]) buttons[0].classList.add("active");
}

function countryFlag(name) {
  return COUNTRIES.find((country) => country.name === name)?.flag || "";
}

function countryLabel(name) {
  if (!name) return "";
  const flag = countryFlag(name);
  return flag ? `${flag} ${name}` : name;
}

function detectCountry() {
  try {
    const stored = localStorage.getItem(COUNTRY_STORAGE_KEY);
    if (stored && COUNTRIES.some((country) => country.name === stored)) return stored;
  } catch {
    // localStorage may be blocked; fall back to timezone detection.
  }
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = COUNTRIES.find((country) => country.zones.includes(zone));
    if (match) return match.name;
    if (zone && zone.startsWith("Europe/")) return "Otro (Europa)";
  } catch {
    // Intl can be unavailable in rare environments.
  }
  return DEFAULT_COUNTRY;
}

function rememberCountry(name) {
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, name);
  } catch {
    // Ignore storage failures; selection still applies to the saved drink.
  }
}

function populateCountrySelect() {
  const detected = detectCountry();
  const current = els.drinkCountry.value || detected;
  els.drinkCountry.innerHTML = COUNTRIES.map(
    (country) =>
      `<option value="${escapeHTML(country.name)}" ${country.name === current ? "selected" : ""}>${country.flag} ${escapeHTML(country.name)}</option>`,
  ).join("");
  updateCountryHint();
}

function updateCountryHint() {
  const detected = detectCountry();
  els.countryHint.textContent = els.drinkCountry.value === detected ? `· auto: ${detected}` : "";
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
      country: drink.country,
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
  scheduleConnectionFallback();
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
  els.paceStat.textContent = `Proyección del año: ${projectedYearTotal(yearTotal)} birras`;
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

function renderPersonSelect(presetId = null) {
  const currentValue = presetId ?? getSelectedDrinkerId();
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

function renderCompanionSelect(presetIds = null) {
  const selectedIds = presetIds ?? getSelectedCompanionIds();
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
  const currentValue = uiState.companionPersonId || uiState.statsPersonIds[0];
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
  uiState.statsPersonIds = uiState.statsPersonIds.filter((id) => state.people.some((person) => person.id === id));
  const allActive = uiState.statsPersonIds.length === 0;
  els.statsPersonFilter.innerHTML = [
    `<button class="${allActive ? "active" : ""}" type="button" data-stats-person="all">Todos</button>`,
    ...state.people.map(
      (person) => `
        <button class="${uiState.statsPersonIds.includes(person.id) ? "active" : ""}" type="button" data-stats-person="${person.id}">
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
      <div class="friend-actions">
        <button class="ghost-button" type="button" data-edit-person="${person.id}">Editar</button>
        <button class="danger-button" type="button" data-remove-person="${person.id}">Quitar</button>
      </div>
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
    const isChampion = index === 0 && person.total > 0;
    const row = document.createElement("div");
    row.className = `leader-card${isChampion ? " champion" : ""}`;
    row.style.setProperty("--leader-width", `${Math.max(5, (person.total / max) * 100)}%`);
    const expanded = uiState.expandedLeaderId === person.id;
    const personDrinks = state.drinks
      .filter((drink) => drink.personId === person.id && filter(drink))
      .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`));
    const visibleDrinks = personDrinks.slice(0, 12);
    row.innerHTML = `
      <button class="leader-row" type="button" data-toggle-leader="${person.id}" aria-expanded="${expanded}">
        <div class="rank">${isChampion ? `<span class="crown" aria-label="Líder" title="Líder">👑</span>` : `#${index + 1}`}</div>
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
  const details = [formatDateTime(drink), drink.format, `${formatLiters(drinkLiters(drink))} L`, countryLabel(drink.country), companions]
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
  updateMainChartDateControl();
  const { label, bars } = mainChartData(state.drinks, uiState.mainChartRange);
  els.mainChartLabel.textContent = label;
  els.monthChart.dataset.range = uiState.mainChartRange;
  els.monthChart.innerHTML = barChartMarkup(bars);
}

function renderStatsMonthChart(drinks) {
  els.statsMonthChart.innerHTML = barChartMarkup(yearMonthChartBars(drinks));
}

function updateMainChartDateControl() {
  const labels = {
    year: "Año",
    month: "Mes",
    week: "Semana",
    day: "Día",
  };
  els.mainChartDateLabel.textContent = labels[uiState.mainChartRange];
  els.mainChartDate.value = uiState.mainChartAnchorDate;
}

function yearMonthChartBars(drinks) {
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

function selectedMonthDayBars(drinks) {
  const anchor = parseLocalDate(uiState.mainChartAnchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totals = Array.from({ length: daysInMonth }, () => 0);
  drinks.forEach((drink) => {
    const drinkDate = parseLocalDate(drink.date);
    if (drinkDate.getFullYear() !== year || drinkDate.getMonth() !== month) return;
    totals[drinkDate.getDate() - 1] += Number(drink.count);
  });

  return totals.map((total, index) => {
    const date = new Date(year, month, index + 1);
    return {
      label: String(index + 1),
      total,
      title: `${formatDate(localDateISO(date))}: ${total}`,
    };
  });
}

function selectedWeekDayBars(drinks) {
  const start = startOfWeek(parseLocalDate(uiState.mainChartAnchorDate));
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const totals = Array.from({ length: 7 }, () => 0);

  drinks.forEach((drink) => {
    const drinkDate = parseLocalDate(drink.date);
    const index = days.findIndex((day) => isSameLocalDay(day, drinkDate));
    if (index === -1) return;
    totals[index] += Number(drink.count);
  });

  return totals.map((total, index) => ({
    label: labels[index],
    total,
    title: `${labels[index]} ${formatDate(localDateISO(days[index]))}: ${total}`,
  }));
}

function selectedDayHourBars(drinks) {
  const selectedDate = uiState.mainChartAnchorDate;
  const totals = Array.from({ length: 24 }, () => 0);

  drinks.forEach((drink) => {
    if (drink.date !== selectedDate) return;
    const createdAt = drink.createdAt ? new Date(drink.createdAt) : parseLocalDate(drink.date);
    const hour = Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getHours();
    totals[hour] += Number(drink.count);
  });

  return totals.map((total, hour) => ({
    label: `${hour}`,
    total,
    title: `${hour}:00: ${total}`,
  }));
}

function mainChartData(drinks, range) {
  const anchor = parseLocalDate(uiState.mainChartAnchorDate);
  if (range === "year") {
    const year = anchor.getFullYear();
    return {
      label: `Meses de ${year}`,
      bars: yearMonthChartBars(drinks.filter((drink) => parseLocalDate(drink.date).getFullYear() === year)),
    };
  }
  if (range === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    return {
      label: `Días de la semana · ${formatDate(localDateISO(start))} - ${formatDate(localDateISO(end))}`,
      bars: selectedWeekDayBars(drinks),
    };
  }
  if (range === "day") {
    return {
      label: `Horas del día · ${formatDate(uiState.mainChartAnchorDate)}`,
      bars: selectedDayHourBars(drinks),
    };
  }
  return {
    label: `Días de ${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`,
    bars: selectedMonthDayBars(drinks),
  };
}

function barChartMarkup(bars) {
  const max = Math.max(1, ...bars.map((bar) => bar.total));
  return bars
    .map((bar) => {
      const height = Math.max(6, Math.round((bar.total / max) * 100));
      return `
        <div class="bar-wrap" title="${escapeHTML(bar.title)}">
          <span class="bar-value">${bar.total > 0 ? bar.total : ""}</span>
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
  const selectedIds = uiState.statsPersonIds;
  const selectedNames = selectedIds.map((id) => getPerson(id)?.name).filter(Boolean);

  const stats = [
    ["Cerveza top", topBeer || "Sin datos"],
    ["Presentación top", topFormat || "Sin datos"],
    ["Con amigos", entries ? `${Math.round((accompanied.length / entries) * 100)}%` : "0%"],
    ["Partner top", topCompanion?.name || "Sin datos"],
    ["Tipo top", topType || "Sin datos"],
    ["Plan top", topPlan || "Sin datos"],
    [
      selectedIds.length === 0 ? "MVP" : selectedIds.length === 1 ? "Jugador" : "Selección",
      selectedIds.length === 0
        ? topFriend?.total ? topFriend.name : "Sin datos"
        : selectedNames.join(" + ") || "Sin datos",
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
  renderWeekdayChart(drinks);
  renderBreakdownChart(els.formatChart, totalsByKey(drinks, "format"));
  renderBreakdownChart(els.typeChart, totalsByKey(drinks, "type"));
  renderBreakdownChart(els.countryChart, countryTotals(drinks));
}

function weekdayBars(drinks) {
  const totals = Array.from({ length: 7 }, () => 0);
  drinks.forEach((drink) => {
    const index = (parseLocalDate(drink.date).getDay() + 6) % 7;
    totals[index] += Number(drink.count);
  });

  const peak = Math.max(...totals);
  return totals.map((total, index) => ({
    label: WEEKDAYS[index],
    total,
    title: `${WEEKDAYS[index]}: ${total}${total && total === peak ? " · día pico" : ""}`,
  }));
}

function renderWeekdayChart(drinks) {
  els.weekdayChart.innerHTML = barChartMarkup(weekdayBars(drinks));
}

function countryTotals(drinks) {
  const rows = totalsByKey(
    drinks.map((drink) => ({ ...drink, country: drink.country || "Sin país" })),
    "country",
  );
  return rows.map(([name, total]) => [name === "Sin país" ? name : countryLabel(name), total]);
}

function getStatsDrinks() {
  const drinks = yearDrinks();
  if (!uiState.statsPersonIds.length) return drinks;
  const selected = new Set(uiState.statsPersonIds);
  return drinks.filter((drink) => selected.has(drink.personId));
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
    .map((friend) => ({
      friend,
      total: sumDrinks(drinks.filter((drink) => getCompanionIds(drink).includes(friend.id))),
    }))
    .sort((a, b) => b.total - a.total || a.friend.name.localeCompare(b.friend.name))
    .map(({ friend, total }) => {
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
    const details = [drink.format, volume, countryLabel(drink.country), drink.mood, companionNames(drink)]
      .filter(Boolean)
      .join(" · ");
    row.innerHTML = `
      <div>
        <strong>${escapeHTML(person?.name || "Jugador eliminado")} · ${escapeHTML(beerName)}</strong>
        <span>${formatDateTime(drink)}${details ? ` · ${escapeHTML(details)}` : ""}${drink.note ? ` · ${escapeHTML(drink.note)}` : ""}</span>
      </div>
      <div class="activity-actions">
        <span class="beer-badge">${drink.count}</span>
        <button class="ghost-button" type="button" data-edit-drink="${drink.id}">Editar</button>
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

function openAddDrink() {
  uiState.editingDrinkId = "";
  els.trackerEyebrow.textContent = "Registro";
  els.trackerTitle.textContent = "Subir birra";
  els.drinkSubmitLabel.textContent = "Sumar birra";
  els.beerName.value = "";
  els.drinkNote.value = "";
  setSelectedChoice(els.beerType, "Lager");
  setSelectedChoice(els.drinkMood, "Con amigos");
  setSelectedFormat("Lata");
  els.customMl.value = "333";
  setDrinkCount(1);
  setWhenToNow();
  renderPersonSelect();
  renderCompanionSelect([]);
  populateCountrySelect();
  syncCustomMlField();
  openModal(els.beerModal);
  setTimeout(() => els.beerName.focus(), 80);
}

function openEditDrink(drink) {
  uiState.editingDrinkId = drink.id;
  els.trackerEyebrow.textContent = "Editar";
  els.trackerTitle.textContent = "Editar birra";
  els.drinkSubmitLabel.textContent = "Guardar cambios";
  els.beerName.value = drink.beerName || "";
  els.drinkNote.value = drink.note || "";
  setSelectedChoice(els.beerType, drink.type || "Lager");
  setSelectedChoice(els.drinkMood, drink.mood || "Con amigos");
  const format = drink.format || "Lata";
  setSelectedFormat(format);
  const perUnitMl = Math.round((Number(drink.liters) / (Number(drink.count) || 1)) * 1000);
  els.customMl.value = format === "Otra" && perUnitMl > 0 ? String(perUnitMl) : "333";
  setDrinkCount(Number(drink.count) || 1);
  const when = drink.createdAt ? new Date(drink.createdAt) : parseLocalDate(drink.date);
  els.drinkWhen.value = localDateTimeValue(Number.isNaN(when.getTime()) ? new Date() : when);
  updateWhenHint();
  renderPersonSelect(drink.personId);
  renderCompanionSelect(getCompanionIds(drink));
  populateCountrySelect();
  if (drink.country && COUNTRIES.some((country) => country.name === drink.country)) {
    els.drinkCountry.value = drink.country;
  }
  updateCountryHint();
  syncCustomMlField();
  openModal(els.beerModal);
}

function showToast(message, badge = "✓") {
  els.rewardToast.classList.remove("show");
  void els.rewardToast.offsetWidth;
  els.rewardToast.querySelector("span").textContent = badge;
  els.rewardToast.querySelector("strong").textContent = message;
  els.rewardToast.classList.add("show");
}

async function addDrink(event) {
  event.preventDefault();
  if (!state.people.length) return;
  const button = els.drinkForm.querySelector(".primary-button");
  button.disabled = true;
  const when = getWhenDate();
  const count = getDrinkCount();
  const format = getSelectedFormat();
  const liters = getDrinkLitersForFormat(format) * count;
  const country = els.drinkCountry.value || "";
  const selectedPersonId = getSelectedDrinkerId();
  const companionPersonIds = getSelectedCompanionIds().filter((id) => id !== selectedPersonId);
  if (!selectedPersonId) {
    button.disabled = false;
    return;
  }
  const editingId = uiState.editingDrinkId;
  const payload = {
    personId: selectedPersonId,
    count,
    date: localDateISO(when),
    beerName: els.beerName.value.trim(),
    type: getSelectedChoice(els.beerType, "Lager"),
    format,
    liters,
    country,
    mood: getSelectedChoice(els.drinkMood, "Con amigos"),
    companionPersonId: companionPersonIds[0] || "",
    companionPersonIds,
    note: els.drinkNote.value.trim(),
    createdAt: when.toISOString(),
  };

  try {
    if (editingId) {
      await setDoc(doc(drinksRef, editingId), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      await addDoc(drinksRef, { ...payload, serverCreatedAt: serverTimestamp() });
    }

    if (country) rememberCountry(country);
    if (editingId) {
      uiState.editingDrinkId = "";
      showToast("Cambios guardados");
      closeModal(els.beerModal);
    } else {
      els.beerName.value = "";
      els.drinkNote.value = "";
      rewardUpload();
      setTimeout(() => closeModal(els.beerModal), 260);
    }
  } catch (error) {
    showFirebaseError(error);
  } finally {
    button.disabled = false;
  }
}

function rewardUpload() {
  const button = els.drinkForm.querySelector(".primary-button");
  const mainScore = document.querySelector(".main-score");
  const count = getDrinkCount();

  els.rewardToast.querySelector("span").textContent = `+${count}`;
  els.rewardToast.querySelector("strong").textContent = count > 1 ? `${count} birras sumadas` : "Birra sumada";
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
  const color = els.friendColor.value || COLORS[state.people.length % COLORS.length];
  const editingId = uiState.editingFriendId;

  try {
    if (editingId) {
      await setDoc(doc(peopleRef, editingId), { name, color }, { merge: true });
    } else {
      await setDoc(doc(peopleRef, createId()), { name, color, createdAt: serverTimestamp() });
    }
    resetFriendForm();
  } catch (error) {
    showFirebaseError(error);
  }
}

function openEditFriend(person) {
  uiState.editingFriendId = person.id;
  els.friendName.value = person.name;
  els.friendColor.value = person.color || COLORS[0];
  els.friendSubmitLabel.textContent = "Guardar";
  els.friendCancelBtn.hidden = false;
  els.friendName.focus();
}

function resetFriendForm() {
  uiState.editingFriendId = "";
  els.friendName.value = "";
  els.friendColor.value = COLORS[state.people.length % COLORS.length];
  els.friendSubmitLabel.textContent = "Agregar";
  els.friendCancelBtn.hidden = true;
}

function armRemoveButton(button) {
  const original = button.textContent;
  button.dataset.armed = "1";
  button.textContent = "¿Seguro?";
  button.classList.add("armed");
  setTimeout(() => {
    if (button.dataset.armed !== "1") return;
    button.dataset.armed = "";
    button.textContent = original;
    button.classList.remove("armed");
  }, 3500);
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
  const drink = state.drinks.find((item) => item.id === id);
  try {
    await deleteDoc(doc(drinksRef, id));
    if (drink) showUndoToast(drink);
  } catch (error) {
    showFirebaseError(error);
  }
}

function showUndoToast(drink) {
  pendingUndo = drink;
  const plural = (Number(drink.count) || 1) > 1;
  els.undoToastText.textContent = plural ? `${drink.count} birras borradas` : "Birra borrada";
  els.undoToast.classList.add("show");
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndoToast, 6000);
}

function hideUndoToast() {
  els.undoToast.classList.remove("show");
  pendingUndo = null;
  if (undoTimer) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }
}

async function undoDelete() {
  if (!pendingUndo) return;
  const drink = pendingUndo;
  hideUndoToast();
  try {
    await setDoc(doc(drinksRef, drink.id), {
      personId: drink.personId,
      count: Number(drink.count) || 1,
      date: drink.date,
      beerName: drink.beerName || "",
      type: drink.type || "Lager",
      format: drink.format || "Lata",
      liters: Number(drink.liters) || getFormatLiters(drink.format || "Lata"),
      country: drink.country || "",
      mood: drink.mood || "Con amigos",
      companionPersonId: drink.companionPersonId || "",
      companionPersonIds: getCompanionIds(drink),
      note: drink.note || "",
      createdAt: drink.createdAt || new Date().toISOString(),
      serverCreatedAt: serverTimestamp(),
    });
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
          country: drink.country,
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
  const editDrinkBtn = event.target.closest("[data-edit-drink]");
  const editPersonBtn = event.target.closest("[data-edit-person]");
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

  if (personBtn) {
    if (personBtn.dataset.armed === "1") removePerson(personBtn.dataset.removePerson);
    else armRemoveButton(personBtn);
  }
  if (drinkBtn) removeDrink(drinkBtn.dataset.removeDrink);
  if (editDrinkBtn) {
    const drink = state.drinks.find((item) => item.id === editDrinkBtn.dataset.editDrink);
    if (drink) openEditDrink(drink);
  }
  if (editPersonBtn) {
    const person = getPerson(editPersonBtn.dataset.editPerson);
    if (person) openEditFriend(person);
  }
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
    const value = statsPersonBtn.dataset.statsPerson;
    if (value === "all") {
      uiState.statsPersonIds = [];
    } else {
      const selected = new Set(uiState.statsPersonIds);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      uiState.statsPersonIds = [...selected];
    }
    if (uiState.statsPersonIds.length === 1) uiState.companionPersonId = uiState.statsPersonIds[0];
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
els.openBeerModal.addEventListener("click", openAddDrink);
els.drinkForm.querySelectorAll('input[name="beerFormat"]').forEach((radio) => {
  radio.addEventListener("change", syncCustomMlField);
});
els.drinkCountry.addEventListener("change", updateCountryHint);
els.drinkWhen.addEventListener("change", updateWhenHint);
els.drinkWhenNow.addEventListener("click", setWhenToNow);
els.qtyMinus.addEventListener("click", () => setDrinkCount(getDrinkCount() - 1));
els.qtyPlus.addEventListener("click", () => setDrinkCount(getDrinkCount() + 1));
els.drinkCount.addEventListener("change", () => setDrinkCount(getDrinkCount()));
els.drinkForm.querySelectorAll("[data-qty]").forEach((button) => {
  button.addEventListener("click", () => setDrinkCount(Number(button.dataset.qty)));
});
els.undoBtn.addEventListener("click", undoDelete);
els.friendCancelBtn.addEventListener("click", resetFriendForm);
els.friendsMenuBtn.addEventListener("click", () => {
  resetFriendForm();
  openModal(els.friendsPanel);
});
els.exportBtn.addEventListener("click", exportData);
els.refreshBtn.addEventListener("click", refreshApp);
els.connectionRefreshBtn.addEventListener("click", refreshApp);
els.mainChartDate.addEventListener("change", () => {
  uiState.mainChartAnchorDate = els.mainChartDate.value || todayISO();
  renderMonthChart();
});

populateCountrySelect();
syncCustomMlField();
setWhenToNow();
els.friendColor.value = COLORS[state.people.length % COLORS.length];
startFirebase();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // El service worker es opcional; la app funciona sin el.
    });
  });
}
