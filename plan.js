// Your Plan: read the form, check it, then show sports and a gear checklist.
// Uses SPORTS, PLACES and WEATHER_GEAR from data.js.

const form      = document.getElementById("plan-form");
const placeEl   = document.getElementById("place");
const weatherEl = document.getElementById("weather");
const tempEl    = document.getElementById("temp");
const emptyEl   = document.getElementById("plan-empty");
const resultEl  = document.getElementById("plan-result");

// ---------- 1. Validation ----------
function showError(input, message) {
  document.getElementById(input.id + "-error").textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function readForm() {
  const place   = placeEl.value;
  const weather = weatherEl.value;
  const tempText = tempEl.value.trim();
  const temp    = Number(tempText);
  let ok = true;

  showError(placeEl, place ? "" : "Choose a place.");
  if (!place) ok = false;

  showError(weatherEl, weather ? "" : "Choose the weather.");
  if (!weather) ok = false;

  let tempMessage = "";
  if (tempText === "" || Number.isNaN(temp)) {
    tempMessage = "Enter the temperature as a number, for example 22.";
  } else if (temp < -50 || temp > 60) {
    tempMessage = "Enter a temperature between -50 and 60 °C.";
  }
  showError(tempEl, tempMessage);
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

function showPlan({ place, weather, temp }) {
  const picks = recommendSports(place, weather, temp);
  const gear  = gearFor(place, weather, temp, picks);
  const warning = warningFor(place, temp);

  document.getElementById("result-title").textContent = `Plan: ${PLACES[place]}`;
  document.getElementById("result-summary").textContent = `Weather: ${weather}, ${temp}°C`;

  fillList("sports-result", picks, pick => {
    const li = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = pick.sport.name;
    li.append(name, ` (${pick.sport.place}): ${pick.reason}`);
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
    li.append(box, " ", label);
    return li;
  });

  const warningEl = document.getElementById("result-warning");
  warningEl.textContent = warning;
  warningEl.hidden = !warning;

  emptyEl.hidden = true;
  resultEl.hidden = false;
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const values = readForm();
  if (values) showPlan(values);
});