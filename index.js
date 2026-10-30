// Home page: move the mouse over a weather and the whole page turns into that weather.
// On a phone there is no hover, so tapping does the same thing.
// Uses Sky from sky.js.

const buttons = document.querySelectorAll(".wx");

function syncWeather(name) {
  buttons.forEach(button => {
    const on = button.dataset.weather === name;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-pressed", String(on));
  });
}

function showWeather(name) {
  Sky.set(name, { save: true });
  syncWeather(Sky.get());
}

buttons.forEach(button => {
  const name = button.dataset.weather;
  button.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") showWeather(name);
  });
  button.addEventListener("focus", () => showWeather(name));
  button.addEventListener("click", () => showWeather(name));
});

document.addEventListener("weatherchange", event => syncWeather(event.detail));
syncWeather(Sky.get());