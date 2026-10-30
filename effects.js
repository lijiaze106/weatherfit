// effects.js - two small effects shared by the pages:
//  1. Elements with class "tilt" lean towards the mouse in 3D, with a moving glare.
//  2. Elements with class "reveal" fade in when you scroll to them.

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- 1. Tilt ----------
  let active = null;

  function reset(element) {
    element.style.transform = "";
    element.classList.remove("is-tilting");
  }

  if (!reduced) {
    // One listener on the document, so cards added later by JavaScript work too
    document.addEventListener("pointermove", event => {
      if (event.pointerType === "touch") return;
      const element = event.target.closest ? event.target.closest(".tilt") : null;

      if (active && active !== element) reset(active);
      active = element;
      if (!element) return;

      const box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;    // 0 to 1
      const y = (event.clientY - box.top) / box.height;
      const inNavigation = element.closest(".site-nav");
      const tilt = inNavigation ? 6 : 12;
      element.style.transform =
        `perspective(800px) rotateX(${(0.5 - y) * tilt}deg) rotateY(${(x - 0.5) * tilt * 1.17}deg) translateY(${inNavigation ? 1 : 0}px) scale(${inNavigation ? 0.98 : 1.02})`;
      element.style.setProperty("--mx", (x * 100) + "%");
      element.style.setProperty("--my", (y * 100) + "%");
      element.classList.add("is-tilting");
    });

    document.documentElement.addEventListener("mouseleave", () => {
      if (active) reset(active);
      active = null;
    });
  }

  // ---------- 2. Reveal on scroll ----------
  const items = document.querySelectorAll(".reveal");
  if (!reduced && "IntersectionObserver" in window && items.length) {
    document.documentElement.classList.add("js-reveal");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const item = entry.target;
          item.classList.add("in");
          observer.unobserve(item);
          // once it has faded in, drop the reveal styles so they do not slow down the tilt
          setTimeout(() => {
            item.classList.remove("reveal", "in");
            item.style.transitionDelay = "";
          }, 1000);
        }
      });
    }, { threshold: 0.12 });
    items.forEach((item, index) => {
      item.style.transitionDelay = (index % 4) * 70 + "ms";
      observer.observe(item);
    });
  }
})();