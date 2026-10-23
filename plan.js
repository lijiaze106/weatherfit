// Your Plan: read the form, check it, then show sports and a gear checklist.
// Uses SPORTS, PLACES and WEATHER_GEAR from data.js, and Sky from sky.js.

const form     = document.getElementById("plan-form");
const tempEl   = document.getElementById("temp");
const tempValueEl = document.getElementById("temp-value");
const emptyEl  = document.getElementById("plan-empty");
const resultEl = document.getElementById("plan-result");
const getWeatherButton = document.getElementById("get-weather");
const weatherStatus = document.getElementById("weather-status");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

tempEl.addEventListener("input", () => {
  tempValueEl.textContent = `${tempEl.value}°C`;
  setError("temp", "");
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
    if (window.Sky) Sky.set(weather, { save: true });

    const limitNote = temperature < minimum || temperature > maximum
      ? ` Temperature was outside the slider range and set to ${tempEl.value}°C.`
      : "";
    const city = location && (
      location.city || location.locality || location.principalSubdivision || location.countryName
    );
    weatherStatus.textContent =
      `${city || "Nearby city unavailable"} · Current weather: ${weather}, ${tempEl.value}°C. Choose an exercise location and get your plan.${limitNote}`;
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
  if (event.target.name === "weather" && window.Sky) {
    Sky.set(event.target.value, { save: true });
  }
});

// ---------- 1. Validation ----------
function setError(id, message) {
  document.getElementById(id + "-error").textContent = message;
  const field = document.getElementById(id);
  if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
}

function readForm() {
  const place   = form.elements.place.value;     // value of the chosen radio button, or ""
  const weather = form.elements.weather.value;
  const temp    = Number(tempEl.value);
  let ok = true;

  setError("place", place ? "" : "Choose where you will exercise.");
  if (!place) ok = false;

  setError("weather", weather ? "" : "Choose the weather.");
  if (!weather) ok = false;

  let tempMessage = "";
  if (!Number.isFinite(temp) || temp < -50 || temp > 60) {
    tempMessage = "Choose a temperature between -50 and 60 °C.";
  }
  setError("temp", tempMessage);
  if (tempMessage) ok = false;

  return ok ? { place, weather, temp } : null;
}

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
let currentPlan = null;

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

function showPlan(values) {
  const plan = buildPlan(values.place, values.weather, values.temp);
  currentPlan = plan;
  const weatherName = plan.weather.charAt(0).toUpperCase() + plan.weather.slice(1);

  document.getElementById("result-summary").replaceChildren(
    makePill(PLACES[plan.place]), makePill(weatherName), makePill(`${plan.temp}°C`)
  );
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
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = item;
    li.append(box, label);
    return li;
  });

  document.getElementById("action-status").textContent = "";
  emptyEl.hidden = true;
  resultEl.hidden = false;
  resultEl.style.animation = "none";
  void resultEl.offsetWidth;
  resultEl.style.animation = "";

  if (window.innerWidth < 960) {
    resultEl.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
}

// ---------- 4. Report: save as PDF, copy, start over ----------
function summaryText(plan) {
  const weatherName = plan.weather.charAt(0).toUpperCase() + plan.weather.slice(1);
  const lines = [
    "WeatherFit report",
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

document.getElementById("save-pdf").addEventListener("click", () => {
  const status = document.getElementById("action-status");
  status.textContent = "In the print window, choose “Save as PDF” as the destination.";
  window.print();
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

document.getElementById("start-over").addEventListener("click", () => {
  form.reset();
  tempValueEl.textContent = `${tempEl.value}°C`;
  ["place", "weather", "temp"].forEach(id => setError(id, ""));
  currentPlan = null;
  resultEl.hidden = true;
  emptyEl.hidden = false;
  form.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

form.addEventListener("submit", event => {
  event.preventDefault();
  const values = readForm();
  if (values) showPlan(values);
});