const STORAGE_KEY = "weatherly:v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatTemp(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${Math.round(v)}°`;
}

function formatPct(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

function formatWind(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${Math.round(v)} km/h`;
}

function formatMm(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${Math.round(v)} mm`;
}

function weekdayPt(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(
    d,
  );
}

function nowLabel(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

function weatherCodeLabel(code) {
  const c = Number(code);
  if (c === 0) return "Céu limpo";
  if (c === 1 || c === 2) return "Poucas nuvens";
  if (c === 3) return "Nublado";
  if (c === 45 || c === 48) return "Neblina";
  if (c === 51 || c === 53 || c === 55) return "Garoa";
  if (c === 56 || c === 57) return "Garoa congelante";
  if (c === 61 || c === 63 || c === 65) return "Chuva";
  if (c === 66 || c === 67) return "Chuva congelante";
  if (c === 71 || c === 73 || c === 75) return "Neve";
  if (c === 77) return "Neve granulada";
  if (c === 80 || c === 81 || c === 82) return "Pancadas de chuva";
  if (c === 85 || c === 86) return "Pancadas de neve";
  if (c === 95) return "Trovoadas";
  if (c === 96 || c === 99) return "Trovoadas com granizo";
  return "Condição desconhecida";
}

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeJsonParse(raw, null) : null;
  if (!parsed || typeof parsed !== "object") return { recent: [], cache: {} };
  const recent = Array.isArray(parsed.recent) ? parsed.recent : [];
  const cache = parsed.cache && typeof parsed.cache === "object" ? parsed.cache : {};
  return { recent, cache };
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function cacheGet(store, key) {
  const entry = store.cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data ?? null;
}

function cacheSet(store, key, data) {
  store.cache[key] = { ts: Date.now(), data };
  const keys = Object.keys(store.cache);
  if (keys.length > 50) {
    keys
      .sort((a, b) => (store.cache[a].ts || 0) - (store.cache[b].ts || 0))
      .slice(0, keys.length - 50)
      .forEach((k) => delete store.cache[k]);
  }
}

const $ = (sel, root = document) => root.querySelector(sel);

const form = $("[data-search-form]");
const qEl = $("[data-q]");
const suggestionsEl = $("[data-suggestions]");
const useLocationBtn = $("[data-use-location]");

const nowPlaceEl = $("[data-now-place]");
const nowTempEl = $("[data-now-temp]");
const nowDescEl = $("[data-now-desc]");
const nowStatsEl = $("[data-now-stats]");
const nowHintEl = $("[data-now-hint]");
const updatedEl = $("[data-updated]");
const forecastEl = $("[data-forecast]");

const recentEl = $("[data-recent]");
const clearRecentBtn = $("[data-clear-recent]");
const toastEl = $("[data-toast]");
let toastTimer = null;

let store = loadStore();
let currentPlace = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2400);
}

function setSuggestionsOpen(open) {
  suggestionsEl.hidden = !open;
}

function renderSuggestions(items) {
  suggestionsEl.replaceChildren();
  if (!items.length) {
    setSuggestionsOpen(false);
    return;
  }

  for (const it of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion";
    const left = document.createElement("div");
    left.textContent = it.label;
    const right = document.createElement("div");
    right.className = "muted small";
    right.textContent = `${it.lat.toFixed(2)}, ${it.lon.toFixed(2)}`;
    btn.appendChild(left);
    btn.appendChild(right);
    btn.addEventListener("click", () => {
      qEl.value = it.label;
      setSuggestionsOpen(false);
      fetchAndRender(it);
    });
    suggestionsEl.appendChild(btn);
  }

  setSuggestionsOpen(true);
}

function addRecent(place) {
  const key = `${place.id}`;
  store.recent = store.recent.filter((p) => `${p.id}` !== key);
  store.recent.unshift(place);
  store.recent = store.recent.slice(0, 8);
  saveStore(store);
  renderRecent();
}

function renderRecent() {
  recentEl.replaceChildren();
  if (!store.recent.length) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "Nenhuma busca recente ainda.";
    recentEl.appendChild(empty);
    return;
  }

  for (const p of store.recent) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "recent-btn";
    btn.textContent = p.label;
    btn.addEventListener("click", () => fetchAndRender(p));
    recentEl.appendChild(btn);
  }
}

function renderLoading(placeLabel) {
  nowPlaceEl.textContent = placeLabel || "Carregando…";
  nowTempEl.textContent = "—";
  nowDescEl.textContent = "Buscando dados…";
  nowStatsEl.replaceChildren();
  nowHintEl.textContent = "";
  updatedEl.textContent = "—";
  forecastEl.replaceChildren();
  const sk = document.createElement("div");
  sk.className = "muted small";
  sk.textContent = "Carregando previsão…";
  forecastEl.appendChild(sk);
}

function renderError(message) {
  nowDescEl.textContent = "Não foi possível carregar.";
  nowHintEl.textContent = message;
  showToast("Falha ao buscar clima.");
}

function renderWeather(place, data) {
  currentPlace = place;
  nowPlaceEl.textContent = place.label;

  const current = data.current;
  const daily = data.daily;

  nowTempEl.textContent = formatTemp(current.temperature_2m);
  nowDescEl.textContent = weatherCodeLabel(current.weather_code);

  nowStatsEl.replaceChildren();
  const stats = [
    { label: "Sensação", value: formatTemp(current.apparent_temperature) },
    { label: "Umidade", value: formatPct(current.relative_humidity_2m) },
    { label: "Vento", value: formatWind(current.wind_speed_10m) },
    { label: "Chuva", value: formatMm(current.precipitation) },
  ];
  for (const s of stats) {
    const el = document.createElement("div");
    el.className = "stat";
    const l = document.createElement("div");
    l.className = "stat__label";
    l.textContent = s.label;
    const v = document.createElement("div");
    v.className = "stat__value";
    v.textContent = s.value;
    el.appendChild(l);
    el.appendChild(v);
    nowStatsEl.appendChild(el);
  }

  updatedEl.textContent = `Atualizado: ${nowLabel(new Date())}`;

  forecastEl.replaceChildren();
  for (let i = 0; i < (daily.time?.length || 0); i++) {
    const item = document.createElement("div");
    item.className = "day";

    const left = document.createElement("div");
    left.className = "day__left";

    const date = document.createElement("div");
    date.className = "day__date";
    date.textContent = weekdayPt(daily.time[i]);

    const desc = document.createElement("div");
    desc.className = "day__desc";
    desc.textContent = weatherCodeLabel(daily.weather_code?.[i]);

    left.appendChild(date);
    left.appendChild(desc);

    const right = document.createElement("div");
    right.className = "day__right";

    const temp = document.createElement("div");
    const tmax = daily.temperature_2m_max?.[i];
    const tmin = daily.temperature_2m_min?.[i];
    temp.innerHTML = `<strong>${formatTemp(tmax)}</strong> <span class="muted">/ ${formatTemp(
      tmin,
    )}</span>`;

    const pop = document.createElement("div");
    pop.className = "muted small";
    const pp = daily.precipitation_probability_max?.[i];
    pop.textContent = `Chuva: ${formatPct(pp)}`;

    right.appendChild(temp);
    right.appendChild(pop);

    item.appendChild(left);
    item.appendChild(right);

    forecastEl.appendChild(item);
  }

  nowHintEl.textContent =
    "Dica: se a busca falhar ao abrir via arquivo, rode com um servidor local (python -m http.server).";
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function geocode(query) {
  const q = encodeURIComponent(query.trim());
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=6&language=pt&format=json`;
  const key = `geo:${q}`;
  const cached = cacheGet(store, key);
  if (cached) return cached;
  const data = await fetchJson(url);
  cacheSet(store, key, data);
  saveStore(store);
  return data;
}

async function forecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
    lat,
  )}&longitude=${encodeURIComponent(
    lon,
  )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
  const key = `fx:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = cacheGet(store, key);
  if (cached) return cached;
  const data = await fetchJson(url);
  cacheSet(store, key, data);
  saveStore(store);
  return data;
}

async function fetchAndRender(place) {
  renderLoading(place?.label);
  try {
    const data = await forecast(place.lat, place.lon);
    addRecent(place);
    renderWeather(place, data);
    showToast("Clima atualizado.");
  } catch (err) {
    renderError(`Detalhes: ${String(err?.message || err)}`);
  }
}

let suggestTimer = null;
qEl.addEventListener("input", () => {
  const q = qEl.value.trim();
  clearTimeout(suggestTimer);
  if (q.length < 3) {
    setSuggestionsOpen(false);
    return;
  }
  suggestTimer = setTimeout(async () => {
    try {
      const data = await geocode(q);
      const results = Array.isArray(data?.results) ? data.results : [];
      const mapped = results.map((r) => {
        const parts = [r.name, r.admin1, r.country].filter(Boolean);
        return {
          id: r.id,
          label: parts.join(", "),
          lat: r.latitude,
          lon: r.longitude,
        };
      });
      renderSuggestions(mapped);
    } catch {
      setSuggestionsOpen(false);
    }
  }, 260);
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const q = qEl.value.trim();
  if (!q) return;
  setSuggestionsOpen(false);
  renderLoading(q);
  try {
    const data = await geocode(q);
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    if (!first) {
      renderError("Nenhuma cidade encontrada.");
      return;
    }
    const place = {
      id: first.id,
      label: [first.name, first.admin1, first.country].filter(Boolean).join(", "),
      lat: first.latitude,
      lon: first.longitude,
    };
    qEl.value = place.label;
    await fetchAndRender(place);
  } catch (err) {
    renderError(`Detalhes: ${String(err?.message || err)}`);
  }
});

useLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showToast("Geolocalização não disponível.");
    return;
  }
  renderLoading("Minha localização");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const place = {
        id: `geo:${lat.toFixed(3)}:${lon.toFixed(3)}`,
        label: "Minha localização",
        lat,
        lon,
      };
      await fetchAndRender(place);
    },
    (err) => {
      renderError(`Permissão negada ou erro de localização: ${err.message}`);
    },
    { enableHighAccuracy: false, timeout: 8000 },
  );
});

clearRecentBtn.addEventListener("click", () => {
  store.recent = [];
  saveStore(store);
  renderRecent();
  showToast("Recentes limpos.");
});

document.addEventListener("click", (ev) => {
  if (!suggestionsEl.hidden) {
    const inside =
      suggestionsEl.contains(ev.target) || qEl.contains(ev.target) || form.contains(ev.target);
    if (!inside) setSuggestionsOpen(false);
  }
});

renderRecent();

if (store.recent[0]) fetchAndRender(store.recent[0]);
else {
  nowHintEl.textContent =
    "Busque uma cidade para ver o clima. Se a busca falhar ao abrir via arquivo, rode com um servidor local (python -m http.server).";
}

