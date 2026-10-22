// Sports Guide: builds one card per sport from the SPORTS list in data.js.

const listEl = document.getElementById("sports-guide");

function addLine(parent, label, text) {
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = label + " ";
  p.append(strong, text);
  parent.appendChild(p);
}

SPORTS.forEach(sport => {
  const card = document.createElement("article");
  card.className = "tilt";   // tilt.js adds the 3D effect to this

  const title = document.createElement("h2");
  title.textContent = sport.name;
  card.appendChild(title);

  const about = document.createElement("p");
  about.textContent = sport.about;
  card.appendChild(about);

  const weatherText = sport.weather.length === ALL_WEATHER.length
    ? "Any weather"
    : sport.weather.join(", ");
  const tempText = sport.place === "indoor"
    ? "Any temperature"
    : `${sport.minTemp}°C to ${sport.maxTemp}°C`;
  const whereText = sport.place === "indoor"
    ? "Indoor"
    : "Outdoor: " + sport.spots.map(key => PLACES[key]).join(", ");

  addLine(card, "Where:", whereText);
  addLine(card, "Best weather:", weatherText);
  addLine(card, "Temperature:", tempText);
  addLine(card, "Bring:", sport.gear.join(", "));
  addLine(card, "Careful:", sport.note);

  listEl.appendChild(card);
});