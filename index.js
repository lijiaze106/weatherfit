// Home page: move the mouse over a weather and the whole page turns into that weather.
// On a phone there is no hover, so tapping does the same thing.
// Uses Sky from sky.js.

const buttons = document.querySelectorAll(".wx");
let cycleTimer;
let isCycling = false;

function showWeather(name, save = true) {
  Sky.set(name, { save });
  buttons.forEach(button => {
    const on = button.dataset.weather === name;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-pressed", String(on));
  });
}

function stopCycling() {
  isCycling = false;
  window.clearInterval(cycleTimer);
  cycleTimer = null;
}

buttons.forEach(button => {
  const name = button.dataset.weather;
  button.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") {
      stopCycling();
      Sky.clearPlanWeather();
      showWeather(name);
    }
  });
  button.addEventListener("focus", () => {
    stopCycling();
    Sky.clearPlanWeather();
    showWeather(name);
  });
  button.addEventListener("click", () => {
    stopCycling();
    Sky.clearPlanWeather();
    showWeather(name);
  });
});

const planWeather = Sky.getPlanWeather();
const initialWeather = planWeather || Sky.get();
showWeather(initialWeather, !planWeather);

if (!planWeather) {
  let weatherIndex = Sky.names.indexOf(initialWeather);
  isCycling = true;
  cycleTimer = window.setInterval(() => {
    if (!isCycling) return;
    weatherIndex = (weatherIndex + 1) % Sky.names.length;
    showWeather(Sky.names[weatherIndex], false);
  }, 3000);
}