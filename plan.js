// Your Plan: read the form, check it, then show sports and a gear checklist.
// Uses SPORTS, PLACES and WEATHER_GEAR from data.js, Sky from sky.js and PlanStore from store.js.

const form     = document.getElementById("plan-form");
const nameEl   = document.getElementById("name");
const tempEl   = document.getElementById("temp");
const tempValueEl = document.getElementById("temp-value");
const resultEl = document.getElementById("plan-result");
const getWeatherButton = document.getElementById("get-weather");
const weatherStatus = document.getElementById("weather-status");
const weatherCity = document.getElementById("weather-city");
const introEl = document.getElementById("plan-intro");
const missingDialog = document.getElementById("missing-dialog");
const missingList = document.getElementById("missing-list");
const draftStatus = document.getElementById("draft-status");
const desktopLayout = window.matchMedia("(min-width: 60rem)");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let currentPlan = null;
let resultValues = null;
let restoredGear = new Set();

// Remember the last name used on this device
nameEl.value = PlanStore.lastName();
nameEl.addEventListener("input", () => {
  setError("name", "");
  saveDraft();
});

tempEl.addEventListener("input", () => {
  tempValueEl.textContent = `${tempEl.value}°C`;
  setError("temp", "");
  saveDraft();
});

function weatherFromCode(code, windSpeed) {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snowy";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return "rainy";
  if ([1, 2, 3, 45, 48].includes(code)) return "cloudy";
  if (windSpeed >= 40) return "windy";
  if (code === 0) return "sunny";
  throw new Error("The weather service returned an unsupported weather code.");
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    });
  });
}

function locationErrorMessage(error) {
  if (error instanceof Error && error.message === "Location is not available in this browser.") {
    return error.message;
  }
  if (error && typeof error.code === "number") {
    if (error.code === 1) return "Location permission was denied. Choose the weather manually instead.";
    if (error.code === 2) return "Your location could not be determined. Try again or choose the weather manually.";
    if (error.code === 3) return "Getting your location took too long. Try again or choose the weather manually.";
  }
  return error instanceof Error ? error.message : "Could not get your location. Choose the weather manually.";
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("The weather service is unavailable. Please try again.");
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

getWeatherButton.addEventListener("click", async () => {
  getWeatherButton.disabled = true;
  weatherCity.hidden = true;
  weatherStatus.textContent = "Getting your location and current weather…";

  try {
    if (!window.isSecureContext) {
      throw new Error("Location requires HTTPS or localhost. Choose the weather manually.");
    }
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,weather_code,wind_speed_10m",
      timezone: "auto"
    });
    const locationUrl = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    locationUrl.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "zh"
    });
    const [data, location] = await Promise.all([
      fetchJson(url),
      fetchJson(locationUrl).catch(() => null)
    ]);
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m) ||
        !Number.isInteger(current.weather_code) || !Number.isFinite(current.wind_speed_10m)) {
      throw new Error("The weather service returned incomplete data. Please try again.");
    }

    const weather = weatherFromCode(current.weather_code, current.wind_speed_10m);
    const minimum = Number(tempEl.min);
    const maximum = Number(tempEl.max);
    const temperature = Math.round(current.temperature_2m);
    tempEl.value = String(Math.max(minimum, Math.min(maximum, temperature)));
    tempValueEl.textContent = `${tempEl.value}°C`;
    setError("temp", "");

    const weatherRadio = form.querySelector(`input[name="weather"][value="${weather}"]`);
    if (!weatherRadio) throw new Error("Could not match the current weather to a plan option.");
    weatherRadio.checked = true;
    setError("weather", "");
    if (window.Sky) Sky.set(weather, { save: true, plan: true });

    const limitNote = temperature < minimum || temperature > maximum
      ? ` Temperature was outside the slider range and set to ${tempEl.value}°C.`
      : "";
    const city = location && (
      location.city || location.locality || location.principalSubdivision || location.countryName
    );
    weatherCity.textContent = city || "";
    weatherCity.hidden = !city;
    weatherStatus.textContent =
      `${city ? "" : "Nearby city unavailable · "}Current weather: ${weather}, ${tempEl.value}°C.${limitNote}`;
    saveDraft();
  } catch (error) {
    if (error && error.name === "AbortError") {
      weatherStatus.textContent = "The weather request timed out. Please try again or choose the weather manually.";
    } else if (error && typeof error.code === "number") {
      weatherStatus.textContent = locationErrorMessage(error);
    } else {
      weatherStatus.textContent = error instanceof Error
        ? `${error.message} You can choose the weather manually.`
        : "Could not get current weather. You can choose it manually.";
    }
  } finally {
    getWeatherButton.disabled = false;
  }
});

// Choosing a weather in the form also changes the sky behind the page
form.addEventListener("change", event => {
  if (event.target.name === "weather") {
    setError("weather", "");
    if (window.Sky) Sky.set(event.target.value, { save: true, plan: true });
  }
  if (event.target.name === "place") setError("place", "");
  saveDraft();
});

function saveDraft() {
  const place = form.querySelector('input[name="place"]:checked');
  const weather = form.querySelector('input[name="weather"]:checked');
  const checkedGear = currentPlan
    ? [...document.querySelectorAll("#gear-result input:checked")].map(input => input.value)
    : [];
  const saved = PlanStore.saveDraft({
    form: {
      name: nameEl.value,
      place: place ? place.value : "",
      weather: weather ? weather.value : "",
      temp: tempEl.value
    },
    result: resultValues,
    checkedGear
  });
  draftStatus.textContent = saved
    ? ""
    : "This browser could not save your in-progress plan. Check its storage settings.";
}

// ---------- 1. Validation ----------
function setError(id, message) {
  document.getElementById(id + "-error").textContent = message;
  const field = document.getElementById(id);
  if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
  const group = document.getElementById(id + "-group");
  if (group) group.classList.toggle("missing", Boolean(message));
}

function readForm() {
  const name    = nameEl.value.trim().replace(/\s+/g, " ");
  const place   = form.elements.place.value;     // value of the chosen radio button, or ""
  const weather = form.elements.weather.value;
  const temp    = Number(tempEl.value);
  const missing = [];

  setError("name", name ? "" : "Enter your name so your plan can be saved.");
  if (!name) missing.push({ id: "name", text: "Your name" });

  setError("place", place ? "" : "Choose where you will exercise.");
  if (!place) missing.push({ id: "place-group", text: "Where you will exercise" });

  setError("weather", weather ? "" : "Choose the weather.");
  if (!weather) missing.push({ id: "weather-group", text: "The weather (choose one, or press “Get current weather”)" });

  let tempMessage = "";
  if (!Number.isFinite(temp) || temp < -50 || temp > 60) {
    tempMessage = "Choose a temperature between -50 and 60 °C.";
  }
  setError("temp", tempMessage);
  if (tempMessage) missing.push({ id: "temp", text: "A temperature between -50 and 60 °C" });

  if (missing.length) {
    showMissing(missing);
    return null;
  }
  return { name, place, weather, temp };
}

// A clear pop-up that says exactly what is still empty
function showMissing(missing) {
  missingList.replaceChildren();
  missing.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.text;
    missingList.appendChild(li);
  });
  missingDialog.dataset.focus = missing[0].id;
  if (typeof missingDialog.showModal === "function") {
    if (!missingDialog.open) missingDialog.showModal();
  } else {
    window.alert("Please fill in:\n- " + missing.map(item => item.text).join("\n- "));
  }
}

function closeMissing() {
  if (missingDialog.open) missingDialog.close();
}
document.getElementById("missing-ok").addEventListener("click", closeMissing);
// clicking the dark area outside the box also closes it
missingDialog.addEventListener("click", event => {
  if (event.target === missingDialog) closeMissing();
});
// afterwards, move to the first empty field
missingDialog.addEventListener("close", () => {
  const target = document.getElementById(missingDialog.dataset.focus || "");
  if (!target) return;
  const focusable = target.matches("input, button") ? target : target.querySelector("input, button");
  if (focusable) focusable.focus();
});

// ---------- 2. Recommendation rules ----------
// Every outdoor sport that suits the place, weather and temperature gets a fit score (0-100).
// The higher the score, the closer the temperature is to the middle of the sport's comfortable range.
function scoreSport(sport, temp) {
  const middle = (sport.minTemp + sport.maxTemp) / 2;
  const half   = (sport.maxTemp - sport.minTemp) / 2;
  const closeness = 1 - Math.abs(temp - middle) / half;   // 1 = perfect, 0 = edge of range
  return Math.round(40 + 60 * Math.max(0, closeness));
}

// Which indoor sport first? Pick one that matches the day instead of always the same one.
function indoorFirst(weather, temp) {
  let name = "Gym workout";
  if (temp >= 28) name = "Swimming (indoor pool)";
  else if (weather === "windy") name = "Badminton (indoor)";
  else if (weather === "rainy") name = "Table tennis";
  else if (temp <= 0) name = "Yoga";
  return name;
}

function recommend(place, weather, temp) {
  const indoorSports = SPORTS.filter(sport => sport.place === "indoor");
  const first = indoorSports.find(sport => sport.name === indoorFirst(weather, temp));
  const indoorList = [first, ...indoorSports.filter(sport => sport !== first)];

  if (place === "indoor") {
    return { outdoor: [], indoor: indoorList, indoorOnly: true };
  }

  const outdoor = SPORTS
    .filter(sport =>
      sport.place === "outdoor" &&
      sport.spots.includes(place) &&
      sport.weather.includes(weather) &&
      temp >= sport.minTemp && temp <= sport.maxTemp)
    .map(sport => ({ sport, score: scoreSport(sport, temp) }))
    .sort((a, b) => b.score - a.score);

  return { outdoor, indoor: indoorList, indoorOnly: false };
}

function warningFor(place, temp) {
  if (place === "indoor") return "";
  if (temp >= 35) return "It is very hot. Avoid hard exercise outdoors and drink often.";
  if (temp <= -10) return "It is very cold. Keep outdoor sessions short and cover exposed skin.";
  return "";
}

// One definite result: a verdict, one best pick, and the other options.
function buildPlan(place, weather, temp) {
  const found = recommend(place, weather, temp);
  const warning = warningFor(place, temp);
  const weatherName = weather.charAt(0).toUpperCase() + weather.slice(1);
  let level, label, text, best, why, alternatives;

  if (found.indoorOnly) {
    best = { sport: found.indoor[0], score: null };
    level = "ok";
    label = `Indoor plan: ${best.sport.name}`;
    text = "You chose to exercise indoors, so the weather does not change the plan.";
    why = ["You chose an indoor place, so weather and temperature do not matter.",
           `${best.sport.name} fits ${temp >= 28 ? "a hot day" : temp <= 0 ? "a cold day" : "any day"}.`];
    alternatives = found.indoor.slice(1, 4).map(sport => ({ sport, reason: "Another indoor idea." }));
  } else if (found.outdoor.length === 0) {
    best = { sport: found.indoor[0], score: null };
    level = "stay";
    label = `Better indoors today: ${best.sport.name}`;
    text = `No outdoor sport at ${PLACES[place]} fits ${weather} weather at ${temp}°C, so the safest choice is to move indoors.`;
    why = [`Nothing outdoors at ${PLACES[place]} suits ${weather} weather at ${temp}°C.`,
           `${best.sport.name} works in any weather.`];
    alternatives = found.indoor.slice(1, 4).map(sport => ({ sport, reason: "Indoor backup: weather does not matter." }));
  } else {
    best = found.outdoor[0];
    const goodWeather = weather === "sunny" || weather === "cloudy";
    if (!warning && goodWeather && best.score >= 65) {
      level = "go";
      label = `Great day outside: ${best.sport.name}`;
      text = `${weatherName} and ${temp}°C at ${PLACES[place]} is a good match. Go and enjoy it.`;
    } else {
      level = "ok";
      label = `Go outside with the right gear: ${best.sport.name}`;
      text = warning
        ? "It is possible, but take the warning below seriously and keep the session short."
        : `${weatherName} weather at ${temp}°C is workable, but bring the gear on the checklist.`;
    }
    const lo = best.sport.minTemp, hi = best.sport.maxTemp;
    why = [`It suits ${PLACES[place]}.`,
           `It works in ${weather} weather.`,
           `${temp}°C is inside its comfortable range (${lo} to ${hi}°C).`];
    alternatives = found.outdoor.slice(1, 3).map(item => ({
      sport: item.sport,
      reason: `Also fits (score ${item.score}/100), but ${item.score < best.score ? "less ideal at this temperature" : "equally good"}.`
    }));
    // keep at least two options: add one indoor backup
    alternatives.push({ sport: found.indoor[0], reason: "Indoor backup if you change your mind." });
  }

  // Gear is only for the best pick plus the weather: a short, specific list
  const gear = [...best.sport.gear];
  if (place !== "indoor" && level !== "stay") {
    gear.push(...WEATHER_GEAR[weather]);
    if (temp < 5)  gear.push("Warm base layer", "Gloves");
    if (temp > 27) gear.push("Extra water", "Light, loose clothes");
  }

  return {
    place, weather, temp, level, label, text, warning, best, why, alternatives,
    gear: [...new Set(gear)]
  };
}

// ---------- 3. Showing the result ----------
// Every plan is added to the history of the person who typed the name
function saveToHistory(plan) {
  const saved = PlanStore.add({
    name: plan.name,
    savedAt: new Date().toISOString(),
    place: plan.place,
    weather: plan.weather,
    temp: plan.temp,
    level: plan.level,
    verdict: plan.label.split(":")[0],
    sport: plan.best.sport.name,
    score: plan.best.score
  });

  const status = document.getElementById("save-status");
  status.replaceChildren();
  if (saved) {
    const strong = document.createElement("strong");
    strong.textContent = plan.name;
    const link = document.createElement("a");
    link.href = "history.html";
    link.textContent = "View history";
    status.append("Saved to the history of ", strong, ". ", link);
  } else {
    status.textContent = "This plan could not be saved because the browser blocks storage. You can still save it as a PDF.";
  }
}

function fillList(listId, items, makeItem) {
  const list = document.getElementById(listId);
  list.replaceChildren();
  items.forEach((item, index) => list.appendChild(makeItem(item, index)));
}

function makePill(text) {
  const span = document.createElement("span");
  span.className = "pill";
  span.textContent = text;
  return span;
}

function showPlan(values, options = {}) {
  const plan = buildPlan(values.place, values.weather, values.temp);
  plan.name = values.name;
  currentPlan = plan;
  const weatherName = plan.weather.charAt(0).toUpperCase() + plan.weather.slice(1);

  document.getElementById("result-summary").replaceChildren(
    makePill(PLACES[plan.place]), makePill(weatherName), makePill(`${plan.temp}°C`)
  );
  document.getElementById("result-title").textContent = `Plan for ${plan.name}`;
  document.getElementById("report-name").textContent = plan.name;
  document.getElementById("report-date").textContent = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });

  // Verdict
  document.getElementById("verdict").dataset.level = plan.level;
  document.getElementById("verdict-label").textContent = plan.label;
  document.getElementById("verdict-text").textContent = plan.text;

  const warningEl = document.getElementById("result-warning");
  warningEl.textContent = plan.warning;
  warningEl.hidden = !plan.warning;

  // Best pick
  document.getElementById("best-name").textContent = plan.best.sport.name;
  document.getElementById("best-badge").textContent = plan.best.sport.place;
  const hasScore = plan.best.score !== null;
  document.getElementById("best-score-text").textContent = hasScore ? `Fit score: ${plan.best.score} / 100` : "Fit score: not needed indoors";
  document.getElementById("best-meter").style.width = hasScore ? plan.best.score + "%" : "100%";
  fillList("best-why", plan.why, text => {
    const li = document.createElement("li");
    li.textContent = text;
    return li;
  });
  document.getElementById("best-note").textContent = "Tip: " + plan.best.sport.note;

  // Other options
  fillList("sports-result", plan.alternatives, alt => {
    const li = document.createElement("li");
    const head = document.createElement("div");
    head.className = "sport-head";
    const name = document.createElement("strong");
    name.textContent = alt.sport.name;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = alt.sport.place;
    head.append(name, badge);
    const reason = document.createElement("p");
    reason.textContent = alt.reason;
    li.append(head, reason);
    return li;
  });

  // Gear checklist
  fillList("gear-result", plan.gear, (item, index) => {
    const li = document.createElement("li");
    const id = "gear-" + index;
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = id;
    box.value = item;
    box.checked = restoredGear.has(item);
    box.addEventListener("change", saveDraft);
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = item;
    li.append(box, label);
    return li;
  });

  if (options.saveHistory !== false) saveToHistory(plan);

  document.getElementById("action-status").textContent = "";
  introEl.hidden = true;           // the "Your plan appears here" note is no longer needed
  resultEl.hidden = false;
  resultEl.style.animation = "none";
  void resultEl.offsetWidth;
  resultEl.style.animation = "";

  if (options.scroll !== false && !desktopLayout.matches) {
    resultEl.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
}

// ---------- 4. Report: save as PDF, copy, start over ----------
function summaryText(plan) {
  const weatherName = plan.weather.charAt(0).toUpperCase() + plan.weather.slice(1);
  const lines = [
    "WeatherFit report",
    `Name: ${plan.name}`,
    `Place: ${PLACES[plan.place]} | Weather: ${weatherName} | Temperature: ${plan.temp}°C`,
    "",
    `Verdict: ${plan.label}`,
    plan.text
  ];
  if (plan.warning) lines.push(`Warning: ${plan.warning}`);
  lines.push("", `Best pick: ${plan.best.sport.name}`);
  if (plan.best.score !== null) lines.push(`Fit score: ${plan.best.score}/100`);
  plan.why.forEach(item => lines.push(`- ${item}`));
  lines.push(`Tip: ${plan.best.sport.note}`, "", "Other options:");
  plan.alternatives.forEach(alt => lines.push(`- ${alt.sport.name}: ${alt.reason}`));
  lines.push("", "Gear checklist:");
  plan.gear.forEach(item => lines.push(`[ ] ${item}`));
  return lines.join("\n");
}

// ---- Save as PDF: draw a designed A4 report and download it as a real .pdf file ----
// No outside library is needed: the report is drawn on a canvas and wrapped in a small PDF file.

// The WeatherFit logo (same picture as favicon-32.png), drawn as a sharp vector
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 32 32">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f9bea"/><stop offset="1" stop-color="#8fd3ff"/></linearGradient>
<linearGradient id="sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff8a1f"/></linearGradient>
</defs>
<rect width="32" height="32" rx="8" fill="url(#sky)"/>
<circle cx="20.5" cy="12.5" r="7" fill="url(#sun)"/>
<path d="M8.5 25.5h13a4.6 4.6 0 0 0 .5-9.2 6.2 6.2 0 0 0-11.9 1.6A3.8 3.8 0 0 0 8.5 25.5z" fill="#fff"/>
</svg>`;

// The colours of the report follow the weather of the plan
const PDF_THEMES = {
  sunny:  { accent: "#e8650a", from: "#1b7fd1", to: "#6cc0f5" },
  cloudy: { accent: "#2f5478", from: "#4f6c88", to: "#9db1c4" },
  rainy:  { accent: "#2b7fc4", from: "#10243a", to: "#3b5b78" },
  snowy:  { accent: "#2b6cb0", from: "#3f77ae", to: "#9dbad6" },
  windy:  { accent: "#0b6b57", from: "#0a6552", to: "#4fa794" }
};
const PDF_LEVELS = {
  go:   { color: "#1e7a3c", tint: "#eaf6ee", badge: "Great day" },
  ok:   { color: "#b26a00", tint: "#fdf3e1", badge: "Go with the right gear" },
  stay: { color: "#b3261e", tint: "#fceceb", badge: "Better indoors" }
};
const PDF_HEAD = "'Bricolage Grotesque','Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif";
const PDF_BODY = "'DM Sans','Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif";
const PDF_INK = "#14212d", PDF_MUTED = "#5b6b7b", PDF_SOFT = "#8493a2", PDF_LINE = "#e4eaf0", PDF_PANEL = "#f5f8fb";

function svgUri(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded"));
    image.src = src;
  });
}

async function loadPdfFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load("800 40px 'Bricolage Grotesque'"),
      document.fonts.load("700 20px 'Bricolage Grotesque'"),
      document.fonts.load("400 14px 'DM Sans'"),
      document.fonts.load("500 14px 'DM Sans'"),
      document.fonts.load("700 14px 'DM Sans'")
    ]);
  } catch (error) { /* the fallback fonts are fine */ }
}

// ----- small drawing helpers -----
function pdfRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pdfFont(size, weight, family, italic) {
  return `${italic ? "italic " : ""}${weight} ${size}px ${family}`;
}

function pdfSetSpacing(ctx, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px";
}

// Draws one line of text and returns its width
function pdfText(ctx, text, x, y, o) {
  ctx.font = pdfFont(o.size, o.weight || 400, o.family || PDF_BODY, o.italic);
  ctx.fillStyle = o.color || PDF_INK;
  ctx.textAlign = o.align || "left";
  ctx.textBaseline = "alphabetic";
  pdfSetSpacing(ctx, o.spacing || 0);
  ctx.fillText(text, x, y);
  const width = ctx.measureText(text).width;
  pdfSetSpacing(ctx, 0);
  return width;
}

function pdfMeasure(ctx, text, o) {
  ctx.font = pdfFont(o.size, o.weight || 400, o.family || PDF_BODY, o.italic);
  pdfSetSpacing(ctx, o.spacing || 0);
  const width = ctx.measureText(text).width;
  pdfSetSpacing(ctx, 0);
  return width;
}

// Splits text into lines that fit maxWidth (also works for Chinese, which has no spaces)
function pdfWrap(ctx, text, maxWidth, o) {
  ctx.font = pdfFont(o.size, o.weight || 400, o.family || PDF_BODY, o.italic);
  const lines = [];
  let line = "";
  const pushWord = word => {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width <= maxWidth) { line = test; return; }
    if (line) { lines.push(line); line = ""; }
    if (ctx.measureText(word).width <= maxWidth) { line = word; return; }
    for (const ch of word) {                       // a very long word: break it by characters
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ""; }
      line += ch;
    }
  };
  String(text).split(/\s+/).filter(Boolean).forEach(pushWord);
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function pdfCloud(ctx, x, y, s, fill) {
  ctx.fillStyle = fill;
  [[32, 40, 18], [56, 28, 25], [79, 42, 16]].forEach(([cx, cy, r]) => {
    ctx.beginPath(); ctx.arc(x + cx * s, y + cy * s, r * s, 0, Math.PI * 2); ctx.fill();
  });
  pdfRoundRect(ctx, x + 12 * s, y + 40 * s, 80 * s, 20 * s, 10 * s); ctx.fill();
}

function pdfSun(ctx, cx, cy, r, rays) {
  if (rays) {
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = r * .13; ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
      ctx.lineTo(cx + Math.cos(a) * r * 1.75, cy + Math.sin(a) * r * 1.75);
      ctx.stroke();
    }
  }
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, "#ffe27a"); g.addColorStop(1, "#ff8f2a");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

// A simple picture of the weather for the top card
function pdfWeatherIcon(ctx, weather, cx, cy) {
  ctx.save();
  ctx.lineCap = "round";
  if (weather === "sunny") {
    pdfSun(ctx, cx, cy, 36, true);
  } else if (weather === "cloudy") {
    pdfSun(ctx, cx + 34, cy - 26, 26, false);
    pdfCloud(ctx, cx - 78, cy - 36, 1.55, "#ffffff");
  } else if (weather === "rainy") {
    pdfCloud(ctx, cx - 78, cy - 54, 1.55, "#ffffff");
    ctx.strokeStyle = "#bfe3ff"; ctx.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(cx - 40 + i * 29, cy + 48); ctx.lineTo(cx - 49 + i * 29, cy + 68); ctx.stroke();
    }
  } else if (weather === "snowy") {
    pdfCloud(ctx, cx - 78, cy - 54, 1.55, "#ffffff");
    ctx.fillStyle = "#ffffff";
    [[-46, 54], [-16, 68], [14, 54], [44, 68]].forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 6, 0, Math.PI * 2); ctx.fill();
    });
  } else {   // windy
    ctx.strokeStyle = "rgba(255,255,255,.92)"; ctx.lineWidth = 6;
    [[-64, -30, 42, 16], [-64, 0, 62, 20], [-64, 30, 30, 14]].forEach(([x0, dy, len, curl]) => {
      const x1 = cx + x0 + len + 60;
      ctx.beginPath();
      ctx.moveTo(cx + x0, cy + dy);
      ctx.lineTo(x1, cy + dy);
      ctx.arc(x1, cy + dy - curl, curl, Math.PI / 2, -Math.PI * 0.85, true);
      ctx.stroke();
    });
  }
  ctx.restore();
}

function pdfPill(ctx, text, x, y, h, o) {
  const textSize = o.size || 11;
  const w = pdfMeasure(ctx, text, { size: textSize, weight: o.weight || 700, spacing: o.spacing || 0 }) + (o.padX || 14) * 2;
  pdfRoundRect(ctx, x, y, w, h, h / 2);
  if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineWidth || 1; ctx.stroke(); }
  pdfText(ctx, text, x + (o.padX || 14), y + h / 2 + textSize * 0.36, {
    size: textSize, weight: o.weight || 700, color: o.color, spacing: o.spacing || 0
  });
  return w;
}

// ----- the report page -----
async function renderReportCanvas(plan, checkedGear) {
  await loadPdfFonts();
  const logo = await loadImage(svgUri(LOGO_SVG));

  const S = 2.5, W = 794, H = 1123, M = 48, CW = W - M * 2;
  const theme = PDF_THEMES[plan.weather] || PDF_THEMES.sunny;
  const level = PDF_LEVELS[plan.level] || PDF_LEVELS.ok;
  const hasScore = plan.best.score !== null;
  const weatherName = plan.weather.charAt(0).toUpperCase() + plan.weather.slice(1);
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const badgeText = hasScore || plan.level === "stay" ? level.badge : "Indoor plan";

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * S);
  canvas.height = Math.round(H * S);
  const ctx = canvas.getContext("2d");
  ctx.scale(S, S);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const eyebrow = (text, x, y, color) =>
    pdfText(ctx, text.toUpperCase(), x, y, { size: 10.5, weight: 700, color: color || theme.accent, spacing: 1.6 });

  // ---------- top bar: logo, name, date ----------
  ctx.save();
  ctx.shadowColor = "rgba(20,38,59,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  ctx.drawImage(logo, M, 38, 46, 46);
  ctx.restore();
  pdfText(ctx, "WeatherFit", M + 60, 60, { size: 23, weight: 800, family: PDF_HEAD });
  pdfText(ctx, "Weather meets sports", M + 60, 77, { size: 12, color: PDF_MUTED });
  pdfText(ctx, "EXERCISE PLAN", W - M, 55, { size: 10.5, weight: 700, color: theme.accent, spacing: 1.8, align: "right" });
  pdfText(ctx, date, W - M, 74, { size: 13, weight: 700, align: "right" });

  // ---------- blocks (measured first, then drawn) ----------
  const blocks = [];

  // 1. hero card
  blocks.push({ gap: 0, h: 168, draw(y) {
    const x = M, w = CW, h = 168;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, theme.from); g.addColorStop(1, theme.to);
    ctx.save();
    ctx.shadowColor = "rgba(20,38,59,.22)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    pdfRoundRect(ctx, x, y, w, h, 26); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.save();
    pdfRoundRect(ctx, x, y, w, h, 26); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.beginPath(); ctx.arc(x + w - 30, y - 20, 150, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.arc(x + w - 200, y + h + 40, 100, 0, Math.PI * 2); ctx.fill();
    pdfWeatherIcon(ctx, plan.weather, x + w - 118, y + h / 2 + 2);
    ctx.restore();

    pdfText(ctx, "TODAY'S PLAN FOR", x + 30, y + 40, { size: 10.5, weight: 700, color: "rgba(255,255,255,.85)", spacing: 1.8 });
    let size = 40;
    const maxTitle = w - 60 - 200;
    while (size > 24 && pdfMeasure(ctx, plan.name, { size, weight: 800, family: PDF_HEAD }) > maxTitle) size -= 2;
    let title = plan.name;
    while (title.length > 1 && pdfMeasure(ctx, title, { size, weight: 800, family: PDF_HEAD }) > maxTitle) title = title.slice(0, -1);
    if (title !== plan.name) title += "…";
    pdfText(ctx, title, x + 30, y + 88, { size, weight: 800, family: PDF_HEAD, color: "#fff" });

    let cx = x + 30;
    [PLACES[plan.place], weatherName, plan.temp + "°C"].forEach(text => {
      cx += pdfPill(ctx, text, cx, y + h - 52, 28, {
        size: 13, weight: 700, color: "#fff", fill: "rgba(255,255,255,.2)", stroke: "rgba(255,255,255,.55)", padX: 14
      }) + 8;
    });
  }});

  // 2. verdict
  {
    const wTitle = CW - 24 - 24;
    const titleLines = pdfWrap(ctx, plan.label, wTitle, { size: 21, weight: 800, family: PDF_HEAD });
    const textLines = pdfWrap(ctx, plan.text, wTitle, { size: 13.5 });
    const h = 18 + 22 + 12 + titleLines.length * 26 + 4 + textLines.length * 20 + 22;
    blocks.push({ gap: 18, h, draw(y) {
      pdfRoundRect(ctx, M, y, CW, h, 16); ctx.fillStyle = level.tint; ctx.fill();
      ctx.save(); pdfRoundRect(ctx, M, y, CW, h, 16); ctx.clip();
      ctx.fillStyle = level.color; ctx.fillRect(M, y, 7, h);
      ctx.restore();
      const x = M + 26;
      pdfPill(ctx, badgeText.toUpperCase(), x, y + 18, 22, { size: 10, weight: 800, color: "#fff", fill: level.color, spacing: 1.2, padX: 12 });
      let ty = y + 18 + 22 + 12 + 19;
      titleLines.forEach(line => { pdfText(ctx, line, x, ty, { size: 21, weight: 800, family: PDF_HEAD }); ty += 26; });
      ty -= 4;
      textLines.forEach(line => { pdfText(ctx, line, x, ty + 12, { size: 13.5, color: "#3c4b5a" }); ty += 20; });
    }});
  }

  // 3. warning (only when there is one)
  if (plan.warning) {
    const lines = pdfWrap(ctx, plan.warning, CW - 40, { size: 13.5, weight: 700 });
    const h = 26 + lines.length * 20;
    blocks.push({ gap: 10, h, draw(y) {
      pdfRoundRect(ctx, M, y, CW, h, 14); ctx.fillStyle = "#b3261e"; ctx.fill();
      lines.forEach((line, i) => pdfText(ctx, line, M + 20, y + 25 + i * 20, { size: 13.5, weight: 700, color: "#fff" }));
    }});
  }

  // 4. best pick
  {
    const padX = 28, padY = 24, leftW = CW - padX * 2 - 164;
    const whyLines = plan.why.map(item => pdfWrap(ctx, item, leftW - 20, { size: 13.5 }));
    const tipLines = pdfWrap(ctx, "Tip: " + plan.best.sport.note, leftW - 28, { size: 12.5, italic: true });
    let left = padY + 10 + 36 + 22;
    whyLines.forEach(lines => { left += lines.length * 20 + 6; });
    left += 8 + tipLines.length * 18 + 20 + padY;
    const h = Math.max(left, 196);
    blocks.push({ gap: 18, h, draw(y) {
      ctx.save();
      ctx.shadowColor = "rgba(20,38,59,.10)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
      pdfRoundRect(ctx, M, y, CW, h, 20); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.restore();
      pdfRoundRect(ctx, M, y, CW, h, 20); ctx.strokeStyle = PDF_LINE; ctx.lineWidth = 1.5; ctx.stroke();

      const x = M + padX;
      let ty = y + padY + 9;
      eyebrow("Your best pick", x, ty);
      ty += 36;
      const nameW = pdfText(ctx, plan.best.sport.name, x, ty, { size: 30, weight: 800, family: PDF_HEAD });
      pdfPill(ctx, plan.best.sport.place.toUpperCase(), x + nameW + 14, ty - 22, 22, {
        size: 10, weight: 800, color: theme.accent, stroke: theme.accent, lineWidth: 1.5, spacing: 1, padX: 11
      });
      ty += 32;
      whyLines.forEach(lines => {
        ctx.fillStyle = theme.accent;
        ctx.beginPath(); ctx.arc(x + 4, ty - 4, 3.2, 0, Math.PI * 2); ctx.fill();
        lines.forEach((line, i) => pdfText(ctx, line, x + 18, ty + i * 20, { size: 13.5 }));
        ty += lines.length * 20 + 6;
      });
      ty += 2;
      const tipH = tipLines.length * 18 + 20;
      pdfRoundRect(ctx, x, ty, leftW, tipH, 11); ctx.fillStyle = PDF_PANEL; ctx.fill();
      tipLines.forEach((line, i) => pdfText(ctx, line, x + 14, ty + 23 + i * 18, { size: 12.5, italic: true, color: "#3c4b5a" }));

      // score ring (or a tick when the score is not needed)
      const gx = M + CW - padX - 82, gy = y + h / 2 - 10, r = 54;
      ctx.lineCap = "round"; ctx.lineWidth = 12;
      ctx.strokeStyle = PDF_LINE;
      ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(gx, gy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (hasScore ? plan.best.score / 100 : 1));
      ctx.stroke();
      if (hasScore) {
        pdfText(ctx, String(plan.best.score), gx, gy + 12, { size: 38, weight: 800, family: PDF_HEAD, align: "center" });
        pdfText(ctx, "out of 100", gx, gy + 32, { size: 11, color: PDF_SOFT, align: "center" });
      } else {
        ctx.lineWidth = 10; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(gx - 20, gy + 2); ctx.lineTo(gx - 6, gy + 16); ctx.lineTo(gx + 22, gy - 14); ctx.stroke();
      }
      pdfText(ctx, hasScore ? "FIT SCORE" : "ANY WEATHER", gx, gy + r + 30, { size: 10.5, weight: 700, color: PDF_MUTED, spacing: 1.6, align: "center" });
    }});
  }

  // 5. other options (three cards)
  {
    const gapX = 14, cw = (CW - gapX * 2) / 3;
    const cards = plan.alternatives.map(alt => ({
      alt,
      nameLines: pdfWrap(ctx, alt.sport.name, cw - 32, { size: 15.5, weight: 800, family: PDF_HEAD }).slice(0, 2),
      reasonLines: pdfWrap(ctx, alt.reason, cw - 32, { size: 12 }).slice(0, 4)
    }));
    const cardH = Math.max(...cards.map(c => 16 + c.nameLines.length * 19 + 8 + 20 + 9 + c.reasonLines.length * 17 + 14));
    const h = 22 + cardH;
    blocks.push({ gap: 24, h, draw(y) {
      eyebrow("Other options", M, y + 10);
      cards.forEach((c, i) => {
        const x = M + i * (cw + gapX), top = y + 22;
        pdfRoundRect(ctx, x, top, cw, cardH, 16); ctx.fillStyle = PDF_PANEL; ctx.fill();
        ctx.strokeStyle = PDF_LINE; ctx.lineWidth = 1; ctx.stroke();
        let ty = top + 16 + 14;
        c.nameLines.forEach(line => { pdfText(ctx, line, x + 16, ty, { size: 15.5, weight: 800, family: PDF_HEAD }); ty += 19; });
        ty += 1;
        pdfPill(ctx, c.alt.sport.place.toUpperCase(), x + 16, ty - 4, 20, {
          size: 9.5, weight: 800, color: PDF_MUTED, stroke: "#b6c3cf", lineWidth: 1.2, spacing: 1, padX: 10
        });
        ty += 36;
        c.reasonLines.forEach(line => { pdfText(ctx, line, x + 16, ty, { size: 12, color: "#3c4b5a" }); ty += 17; });
      });
    }});
  }

  // 6. gear checklist
  {
    const rows = Math.ceil(plan.gear.length / 3);
    const boxH = 18 + rows * 32 + 2;
    const h = 22 + boxH;
    blocks.push({ gap: 24, h, draw(y) {
      eyebrow("Gear checklist", M, y + 10);
      const noun = plan.gear.length === 1 ? "item" : "items";
      let label = `${plan.gear.length} ${noun} for ${plan.best.sport.name.toLowerCase()}`;
      pdfText(ctx, label, M + CW, y + 10, { size: 12, color: PDF_SOFT, align: "right" });
      const top = y + 22;
      pdfRoundRect(ctx, M, top, CW, boxH, 16); ctx.fillStyle = PDF_PANEL; ctx.fill();
      ctx.strokeStyle = PDF_LINE; ctx.lineWidth = 1; ctx.stroke();
      const colW = (CW - 40) / 3;
      plan.gear.forEach((item, i) => {
        const x = M + 22 + (i % 3) * colW, cy = top + 18 + Math.floor(i / 3) * 32 + 8;
        const done = checkedGear.has(item);
        pdfRoundRect(ctx, x, cy - 9, 18, 18, 6);
        if (done) {
          ctx.fillStyle = theme.accent; ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(x + 4.5, cy + 0.5); ctx.lineTo(x + 8, cy + 4); ctx.lineTo(x + 14, cy - 3.5); ctx.stroke();
        } else {
          ctx.fillStyle = "#fff"; ctx.fill();
          ctx.strokeStyle = "#9fb0bf"; ctx.lineWidth = 1.8; ctx.stroke();
        }
        pdfText(ctx, item, x + 28, cy + 5, { size: 13.5 });
      });
    }});
  }

  // ---------- lay the blocks out; shrink a little if a long plan would not fit ----------
  const top = 112, bottom = H - 96;
  const total = blocks.reduce((sum, b) => sum + b.gap + b.h, 0);
  const k = Math.min(1, (bottom - top) / total);
  const spare = Math.max(0, Math.min((bottom - top) - total, 16 * (blocks.length - 1)));
  const extraGap = spare / (blocks.length - 1);
  ctx.save();
  ctx.translate(W / 2, top);
  ctx.scale(k, k);
  ctx.translate(-W / 2, 0);
  let y = 0;
  blocks.forEach((b, i) => { y += b.gap + (i ? extraGap : 0); b.draw(y); y += b.h; });
  ctx.restore();

  // ---------- footer ----------
  ctx.strokeStyle = PDF_LINE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(M, H - 84); ctx.lineTo(M + CW, H - 84); ctx.stroke();
  ctx.drawImage(logo, M, H - 70, 24, 24);
  const brandW = pdfText(ctx, "WeatherFit", M + 33, H - 53, { size: 14, weight: 800, family: PDF_HEAD });
  pdfText(ctx, "· Weather meets sports", M + 33 + brandW + 8, H - 53, { size: 12, color: PDF_MUTED });
  pdfText(ctx, `Report for ${plan.name} · ${date}`, M + CW, H - 53, { size: 12, color: PDF_MUTED, align: "right" });
  const note = pdfWrap(ctx, "WeatherFit gives general suggestions only. Use your own judgement about local conditions and what your body can handle.", CW, { size: 10 });
  note.forEach((line, i) => pdfText(ctx, line, M, H - 30 + i * 13, { size: 10, color: PDF_SOFT }));

  return canvas;
}

// ----- a tiny PDF writer: one A4 page that holds the picture -----
function canvasToJpegBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error("The page could not be turned into an image")); return; }
      blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
    }, "image/jpeg", 0.94);
  });
}

function pdfHexString(text) {          // PDF text strings: UTF-16BE in hex, so any name works
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0");
  return `<${hex}>`;
}

function buildPdfFile(jpeg, pixelWidth, pixelHeight, title) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const add = data => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (number, body) => { offsets[number] = length; add(`${number} 0 obj\n${body}\nendobj\n`); };

  const pageW = 595.28, pageH = 841.89;               // A4 in PDF points
  add("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
            `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg);
  add("\nendstream\nendobj\n");
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title ${pdfHexString(title)} /Author (WeatherFit) /Creator (WeatherFit) >>`);

  const xrefAt = length;
  let xref = "xref\n0 7\n0000000000 65535 f \n";
  for (let i = 1; i <= 6; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  add(xref + `trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

document.getElementById("save-pdf").addEventListener("click", async () => {
  if (!currentPlan) return;
  const button = document.getElementById("save-pdf");
  const status = document.getElementById("action-status");
  const plan = currentPlan;
  // the items ticked on the page are ticked in the PDF too
  const checkedGear = new Set(
    [...document.querySelectorAll("#gear-result input:checked")].map(box => box.value)
  );

  button.disabled = true;
  status.textContent = "Creating your PDF…";
  try {
    const canvas = await renderReportCanvas(plan, checkedGear);
    const jpeg = await canvasToJpegBytes(canvas);
    const pdf = buildPdfFile(jpeg, canvas.width, canvas.height, `WeatherFit plan for ${plan.name}`);
    const safeName = plan.name.replace(/[\\/:*?"<>|\s]+/g, "-");
    const day = new Date().toISOString().slice(0, 10);
    downloadBlob(pdf, `WeatherFit-${safeName}-${day}.pdf`);
    status.textContent = "PDF downloaded. Check your Downloads folder.";
  } catch (error) {
    status.textContent = "The PDF file could not be created here, so the print window opened. Choose “Save as PDF” there.";
    window.print();
  } finally {
    button.disabled = false;
  }
});

document.getElementById("copy-plan").addEventListener("click", async () => {
  const status = document.getElementById("action-status");
  if (!currentPlan) return;
  try {
    await navigator.clipboard.writeText(summaryText(currentPlan));
    status.textContent = "Summary copied. You can paste it into a message or a note.";
  } catch (error) {
    status.textContent = "Copying is not available here. Use “Save as PDF” instead.";
  }
});

function resetPlan() {
  const cleared = PlanStore.clearDraft();
  form.reset();
  nameEl.value = PlanStore.lastName();
  tempValueEl.textContent = `${tempEl.value}°C`;
  ["name", "place", "weather", "temp"].forEach(id => setError(id, ""));
  currentPlan = null;
  resultValues = null;
  restoredGear.clear();
  resultEl.hidden = true;
  introEl.hidden = false;
  weatherCity.hidden = true;
  weatherStatus.textContent = "";
  document.getElementById("save-status").replaceChildren();
  document.getElementById("action-status").textContent = "";
  draftStatus.textContent = cleared
    ? ""
    : "The in-progress plan could not be removed because the browser blocks storage.";
  if (!desktopLayout.matches) {
    form.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
}

document.getElementById("reset-plan").addEventListener("click", resetPlan);
document.getElementById("start-over").addEventListener("click", resetPlan);

form.addEventListener("submit", event => {
  event.preventDefault();
  const values = readForm();
  if (values) {
    resultValues = { ...values };
    restoredGear.clear();
    showPlan(values);
    saveDraft();
  }
});

function isValidPlanValues(values) {
  const placeExists = values && typeof values.place === "string" &&
    [...form.querySelectorAll('input[name="place"]')].some(option => option.value === values.place);
  return values && typeof values.name === "string" && values.name.trim() &&
    placeExists &&
    typeof values.weather === "string" && Sky.names.includes(values.weather) &&
    (typeof values.temp === "string" || typeof values.temp === "number") &&
    String(values.temp).trim() !== "" &&
    Number.isFinite(Number(values.temp)) &&
    Number(values.temp) >= Number(tempEl.min) && Number(values.temp) <= Number(tempEl.max);
}

function restoreDraft() {
  const draft = PlanStore.getDraft();
  if (!draft || !draft.form || typeof draft.form !== "object") return;

  const values = draft.form;
  if (typeof values.name === "string") nameEl.value = values.name.slice(0, 30);
  if (typeof values.place === "string") {
    const place = [...form.querySelectorAll('input[name="place"]')].find(option => option.value === values.place);
    if (place) place.checked = true;
  }
  if (typeof values.weather === "string" && Sky.names.includes(values.weather)) {
    const weather = form.querySelector(`input[name="weather"][value="${values.weather}"]`);
    if (weather) {
      weather.checked = true;
      Sky.set(values.weather, { save: true, plan: true });
    }
  }
  const temp = Number(values.temp);
  if (Number.isFinite(temp) && temp >= Number(tempEl.min) && temp <= Number(tempEl.max)) {
    tempEl.value = String(temp);
  }
  tempValueEl.textContent = `${tempEl.value}°C`;

  if (isValidPlanValues(draft.result)) {
    resultValues = {
      name: draft.result.name.slice(0, 30),
      place: draft.result.place,
      weather: draft.result.weather,
      temp: Number(draft.result.temp)
    };
    if (Array.isArray(draft.checkedGear)) restoredGear = new Set(draft.checkedGear.filter(item => typeof item === "string"));
    showPlan(resultValues, { saveHistory: false, scroll: false });
  }
}

restoreDraft();