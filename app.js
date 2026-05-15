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

const els = {
  currentYear: document.querySelector("#currentYear"),
  yearTotal: document.querySelector("#yearTotal"),
  paceStat: document.querySelector("#paceStat"),
  leaderName: document.querySelector("#leaderName"),
  leaderStat: document.querySelector("#leaderStat"),
  biggestDay: document.querySelector("#biggestDay"),
  biggestDayStat: document.querySelector("#biggestDayStat"),
  monthChart: document.querySelector("#monthChart"),
  drinkForm: document.querySelector("#drinkForm"),
  personSelect: document.querySelector("#personSelect"),
  nowStamp: document.querySelector("#nowStamp"),
  beerName: document.querySelector("#beerName"),
  beerType: document.querySelector("#beerType"),
  beerFormat: document.querySelector("#beerFormat"),
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
  importFile: document.querySelector("#importFile"),
  rewardToast: document.querySelector("#rewardToast"),
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
    .map((drink) => ({
      id: String(drink.id || createId()),
      personId: String(drink.personId),
      count: Number(drink.count) || 1,
      date: String(drink.date),
      beerName: drink.beerName ? String(drink.beerName) : "",
      type: drink.type ? String(drink.type) : "Lager",
      format: drink.format ? String(drink.format) : "Lata",
      liters: Number(drink.liters) || getFormatLiters(drink.format || "Lata"),
      mood: drink.mood ? String(drink.mood) : "Con amigos",
      companionPersonId: drink.companionPersonId ? String(drink.companionPersonId) : "",
      note: drink.note ? String(drink.note) : "",
      createdAt: drink.createdAt ? String(drink.createdAt) : new Date().toISOString(),
    }));
}

function showFirebaseError(error) {
  console.error(error);
  els.rewardToast.classList.remove("show");
  void els.rewardToast.offsetWidth;
  els.rewardToast.querySelector("span").textContent = "!";
  els.rewardToast.querySelector("strong").textContent = error?.code || "Firebase no conectó";
  els.rewardToast.classList.add("show");
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
    (snapshot) => {
      state.people = snapshot.docs
        .map((personDoc) => ({
          id: personDoc.id,
          name: personDoc.data().name,
          color: personDoc.data().color,
        }))
        .filter((person) => person.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      render();
    },
    showFirebaseError,
  );

  onSnapshot(
    drinksRef,
    (snapshot) => {
      state.drinks = snapshot.docs
        .map((drinkDoc) => ({
          id: drinkDoc.id,
          ...drinkDoc.data(),
        }))
        .filter((drink) => drink.personId && drink.date);
      render();
    },
    showFirebaseError,
  );
}

async function startFirebase() {
  try {
    await signInAnonymously(auth);
    await seedInitialDataIfEmpty();
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
  const currentValue = els.personSelect.value;
  els.personSelect.innerHTML = state.people
    .map((person) => `<option value="${person.id}">${escapeHTML(person.name)}</option>`)
    .join("");
  if (state.people.some((person) => person.id === currentValue)) {
    els.personSelect.value = currentValue;
  }
}

function renderCompanionSelect() {
  const currentValue = els.drinkCompanionPerson.value;
  const drinkerId = els.personSelect.value || state.people[0]?.id;
  const companions = state.people.filter((person) => person.id !== drinkerId);
  els.drinkCompanionPerson.innerHTML = [
    `<option value="">Nadie</option>`,
    ...companions.map((person) => `<option value="${person.id}">${escapeHTML(person.name)}</option>`),
  ].join("");

  if (companions.some((person) => person.id === currentValue)) {
    els.drinkCompanionPerson.value = currentValue;
  }
}

function renderCompanionFilter() {
  const currentValue = els.companionPersonFilter.value;
  els.companionPersonFilter.innerHTML = state.people
    .map((person) => `<option value="${person.id}">${escapeHTML(person.name)}</option>`)
    .join("");

  if (state.people.some((person) => person.id === currentValue)) {
    els.companionPersonFilter.value = currentValue;
  }
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
  const totals = totalsByPerson(els.periodSelect.value);
  const max = Math.max(1, ...totals.map((person) => person.total));
  els.leaderboard.innerHTML = "";

  totals.forEach((person, index) => {
    const row = document.createElement("div");
    row.className = "leader-row";
    row.style.setProperty("--leader-width", `${Math.max(5, (person.total / max) * 100)}%`);
    row.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div class="leader-info">
        <strong>${escapeHTML(person.name)}</strong>
        <span>${person.sessions} subidas registradas</span>
      </div>
      <div class="leader-total">
        <strong>${person.total}</strong>
        <span>cervezas</span>
      </div>
    `;
    els.leaderboard.append(row);
  });
}

function renderRewardStats() {
  const today = todayISO();
  const todayTotal = sumDrinks(state.drinks.filter((drink) => drink.date === today));
  const yearTotal = sumDrinks(yearDrinks());
  const nextMilestone = Math.max(10, Math.ceil((yearTotal + 1) / 10) * 10);

  els.todayCount.textContent = todayTotal;
  els.nextMilestone.textContent = nextMilestone;
  els.milestoneLeft.textContent = Math.max(0, nextMilestone - yearTotal);
}

function renderMonthChart() {
  const totals = Array.from({ length: 12 }, () => 0);
  yearDrinks().forEach((drink) => {
    totals[parseLocalDate(drink.date).getMonth()] += Number(drink.count);
  });

  const max = Math.max(1, ...totals);
  const markup = totals
    .map((total, index) => {
      const height = Math.max(6, Math.round((total / max) * 100));
      return `
        <div class="bar-wrap" title="${MONTHS[index]}: ${total}">
          <div class="bar" style="height:${height}px"></div>
          <span class="bar-label">${MONTHS[index]}</span>
        </div>
      `;
    })
    .join("");

  els.monthChart.innerHTML = markup;
  els.statsMonthChart.innerHTML = markup;
}

function renderStats() {
  const drinks = yearDrinks();
  const total = sumDrinks(drinks);
  const liters = totalLiters(drinks);
  const activeDays = getDayTotals(drinks).size;
  const entries = drinks.length;
  const topType = topBy(drinks, "type");
  const topBeer = topBy(drinks, "beerName");
  const topFormat = topBy(drinks, "format");
  const topPlan = topBy(drinks, "mood");
  const accompanied = drinks.filter((drink) => drink.companionPersonId);
  const topCompanionId = topBy(drinks, "companionPersonId");
  const topCompanion = getPerson(topCompanionId);
  const topFriend = totalsByPerson("year")[0];

  const stats = [
    ["Cerveza top", topBeer || "Sin datos"],
    ["Presentación top", topFormat || "Sin datos"],
    ["Con amigos", entries ? `${Math.round((accompanied.length / entries) * 100)}%` : "0%"],
    ["Partner top", topCompanion?.name || "Sin datos"],
    ["Tipo top", topType || "Sin datos"],
    ["Plan top", topPlan || "Sin datos"],
    ["MVP", topFriend?.total ? topFriend.name : "Sin datos"],
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
  renderBreakdownChart(els.formatChart, totalsByKey(drinks, "format"));
  renderBreakdownChart(els.typeChart, totalsByKey(drinks, "type"));
}

function totalsByKey(items, key) {
  return [...items.reduce((map, item) => {
    const value = item[key] || "Sin dato";
    map.set(value, (map.get(value) || 0) + Number(item.count));
    return map;
  }, new Map()).entries()].sort((a, b) => b[1] - a[1]);
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
  const selectedId = els.companionPersonFilter.value || state.people[0]?.id;
  const selectedPerson = getPerson(selectedId);
  const drinks = yearDrinks().filter((drink) => drink.personId === selectedId);
  const friends = state.people.filter((person) => person.id !== selectedId);
  const max = Math.max(
    1,
    ...friends.map((friend) =>
      sumDrinks(drinks.filter((drink) => drink.companionPersonId === friend.id)),
    ),
  );
  const soloTotal = sumDrinks(drinks.filter((drink) => !drink.companionPersonId));

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
      const total = sumDrinks(drinks.filter((drink) => drink.companionPersonId === friend.id));
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
    const companion = getPerson(drink.companionPersonId);
    const volume = `${formatLiters(drinkLiters(drink))} L`;
    const details = [drink.format, volume, drink.mood, companion ? `con ${companion.name}` : ""]
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
  const format = els.beerFormat.value;
  const liters = getFormatLiters(format);
  const selectedPersonId = els.personSelect.value || state.people[0]?.id;
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
      type: els.beerType.value,
      format,
      liters,
      mood: els.drinkMood.value,
      companionPersonId: els.drinkCompanionPerson.value,
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
      } else if (drink.companionPersonId === id) {
        batch.set(drinkRef, { companionPersonId: "" }, { merge: true });
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
  const backdrop = event.target.classList.contains("modal-backdrop") ? event.target : null;

  if (personBtn) removePerson(personBtn.dataset.removePerson);
  if (drinkBtn) removeDrink(drinkBtn.dataset.removeDrink);
  if (closeBtn) closeModal(closeBtn.closest(".modal-backdrop"));
  if (backdrop) closeModal(backdrop);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".modal-backdrop.active").forEach((modal) => closeModal(modal));
});

els.drinkForm.addEventListener("submit", addDrink);
els.friendForm.addEventListener("submit", addFriend);
els.personSelect.addEventListener("change", renderCompanionSelect);
els.companionPersonFilter.addEventListener("change", renderCompanionBreakdown);
els.periodSelect.addEventListener("change", renderLeaderboard);
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
els.importFile.addEventListener("change", importData);

updateNowStamp();
els.friendColor.value = COLORS[state.people.length % COLORS.length];
render();
startFirebase();
