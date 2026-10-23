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
function recommendSports(place, weather, temp) {
  const indoorSports = SPORTS.filter(sport => sport.place === "indoor");

  // Indoor: weather and temperature do not matter
  if (place === "indoor") {
    return indoorSports.slice(0, 4).map(sport => ({
      sport,
      reason: "Indoors, so the weather does not matter."
    }));
  }

  // Outdoor places: the sport must suit the place, the weather and the temperature
  const list = SPORTS
    .filter(sport =>
      sport.place === "outdoor" &&
      sport.spots.includes(place) &&
      sport.weather.includes(weather) &&
      temp >= sport.minTemp && temp <= sport.maxTemp)
    .slice(0, 4)
    .map(sport => ({
      sport,
      reason: `Works at this place and suits ${weather} weather at ${temp}°C.`
    }));

  // Always show at least 3 ideas: fill up with indoor sports
  for (const sport of indoorSports) {
    if (list.length >= 3) break;
    list.push({ sport, reason: "Backup idea: it is indoors, so the weather does not matter." });
  }
  return list;
}

function gearFor(place, weather, temp, picks) {
  const gear = [];
  picks.forEach(pick => gear.push(...pick.sport.gear));

  // Weather and temperature gear only matters outdoors
  if (place !== "indoor") {
    gear.push(...WEATHER_GEAR[weather]);
    if (temp < 5)  gear.push("Warm base layer", "Gloves");
    if (temp > 27) gear.push("Extra water", "Light, loose clothes");
  }
  return [...new Set(gear)]; // remove duplicates
}

function warningFor(place, temp) {
  if (place === "indoor") return "";
  if (temp >= 35) return "It is very hot. Avoid hard exercise outdoors and drink often.";
  if (temp <= -10) return "It is very cold. Keep outdoor sessions short and cover exposed skin.";
  return "";
}

// ---------- 3. Showing the result ----------
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

function showPlan({ place, weather, temp }) {
  const picks = recommendSports(place, weather, temp);
  const gear  = gearFor(place, weather, temp, picks);
  const warning = warningFor(place, temp);

  document.getElementById("result-title").textContent = "Your plan";
  document.getElementById("result-summary").replaceChildren(
    makePill(PLACES[place]),
    makePill(weather.charAt(0).toUpperCase() + weather.slice(1)),
    makePill(`${temp}°C`)
  );

  fillList("sports-result", picks, pick => {
    const li = document.createElement("li");

    const head = document.createElement("div");
    head.className = "sport-head";
    const name = document.createElement("strong");
    name.textContent = pick.sport.name;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = pick.sport.place;
    head.append(name, badge);

    const reason = document.createElement("p");
    reason.textContent = pick.reason;

    li.append(head, reason);
    return li;
  });

  fillList("gear-result", gear, (item, index) => {
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

  const warningEl = document.getElementById("result-warning");
  warningEl.textContent = warning;
  warningEl.hidden = !warning;

  emptyEl.hidden = true;
  resultEl.hidden = false;
  // restart the pop-in animation each time
  resultEl.style.animation = "none";
  void resultEl.offsetWidth;
  resultEl.style.animation = "";

  // On a phone the result is below the form: scroll down to it
  if (window.innerWidth < 960) {
    resultEl.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const values = readForm();
  if (values) showPlan(values);
});