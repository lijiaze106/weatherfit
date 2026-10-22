// Home page: spin the cube, and tilt it up and down with the mouse.

const cube = document.getElementById("cube");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let rotX = -20;
let rotY = 30;
let targetX = -20;

// Mouse height on the screen decides how much the cube tilts
document.addEventListener("mousemove", event => {
  targetX = (event.clientY / window.innerHeight - 0.5) * -80;
});

function frame() {
  rotY += 0.5;                       // keep spinning
  rotX += (targetX - rotX) * 0.05;   // ease towards the tilt
  cube.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  requestAnimationFrame(frame);
}

// People who asked their system for less motion get a still cube
if (!reduceMotion) frame();