// Gives every element with class "tilt" a 3D tilt that follows the mouse.

const reduceTilt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function enableTilt(element) {
  element.addEventListener("mousemove", event => {
    const box = element.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;   // -0.5 to 0.5
    const y = (event.clientY - box.top) / box.height - 0.5;
    element.style.transform =
      `perspective(700px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg)`;
  });

  element.addEventListener("mouseleave", () => {
    element.style.transform = "";
  });
}

if (!reduceTilt) {
  document.querySelectorAll(".tilt").forEach(enableTilt);
}