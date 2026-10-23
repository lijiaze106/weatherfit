// Sports Guide: builds one card per sport from the SPORTS list in data.js,
// and filters them by place or weather. Uses Sky from sky.js.

const gridEl   = document.getElementById("sports-guide");
const countEl  = document.getElementById("sports-count");
const filterEls = document.querySelectorAll(".filter");

function addRow(list, label, content) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  if (typeof content === "string") dd.textContent = content;
  else dd.appendChild(content);
  list.append(dt, dd);
}

// small weather tags with an icon, like "[sun] sunny"
function weatherTags(weatherList) {
  const wrap = document.createElement("div");
  wrap.className = "dots";
  weatherList.forEach(weather => {
    const tag = document.createElement("span");
    tag.className = "dot";
    const icon = document.createElement("i");
    icon.className = "wx-icon";
    icon.innerHTML = Sky.icon(weather);
    tag.append(icon, weather);
    wrap.appendChild(tag);
  });
  return wrap;
}

function makeCard(sport) {
  const card = document.createElement("article");
  card.className = "sport panel tilt reveal";
  card.dataset.place = sport.place;
  card.dataset.weather = sport.weather.join(" ");

  const top = document.createElement("div");
  top.className = "sport-top";
  const title = document.createElement("h2");
  title.textContent = sport.name;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = sport.place;
  top.append(title, badge);

  const about = document.createElement("p");
  about.className = "about";
  about.textContent = sport.about;

  const list = document.createElement("dl");
  const whereText = sport.place === "indoor"
    ? "Indoor"
    : sport.spots.map(key => PLACES[key]).join(", ");
  const weatherContent = sport.weather.length === ALL_WEATHER.length
    ? "Any weather"
    : weatherTags(sport.weather);
  const tempText = sport.place === "indoor"
    ? "Any temperature"
    : `${sport.minTemp}°C to ${sport.maxTemp}°C`;

  addRow(list, "Where", whereText);
  addRow(list, "Weather", weatherContent);
  addRow(list, "Temperature", tempText);
  addRow(list, "Bring", sport.gear.join(", "));
  addRow(list, "Careful", sport.note);

  card.append(top, about, list);
  return card;
}

SPORTS.forEach(sport => gridEl.appendChild(makeCard(sport)));

// ---------- Filters ----------
function matches(card, filter) {
  if (filter === "all") return true;
  if (filter === "outdoor" || filter === "indoor") return card.dataset.place === filter;
  return card.dataset.weather.split(" ").includes(filter);   // a weather name
}

function applyFilter(filter) {
  let shown = 0;
  gridEl.querySelectorAll(".sport").forEach(card => {
    const ok = matches(card, filter);
    card.hidden = !ok;
    if (ok) shown++;
  });

  filterEls.forEach(button => {
    const on = button.dataset.filter === filter;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-pressed", String(on));
  });

  let text = `Showing ${shown} of ${SPORTS.length} sports`;
  if (Sky.names.includes(filter)) {
    const outdoorShown = [...gridEl.querySelectorAll(".sport")]
      .filter(card => !card.hidden && card.dataset.place === "outdoor").length;
    if (outdoorShown === 0) text += `. No outdoor sport fits ${filter} weather, so indoor sports are the way to go.`;
  }
  countEl.textContent = text;
}

filterEls.forEach(button => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    if (Sky.names.includes(filter)) Sky.set(filter, { save: true });   // the sky follows the filter
    applyFilter(filter);
  });
});

applyFilter("all");