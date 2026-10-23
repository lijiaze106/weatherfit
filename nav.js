// Loads nav.html and footer.html into every page.
// If the browser blocks fetch (for example when you double-click the file),
// the built-in copies below are used instead, so the page still has navigation.
// (Keep the copies below the same as nav.html and footer.html.)

const NAV_FALLBACK = `
<nav class="site-nav" aria-label="Main">
  <a class="logo" href="index.html">
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" fill="currentColor"/>
      <path d="M10 27h14a5.2 5.2 0 0 0 .6-10.4A7.2 7.2 0 0 0 11 17.8 4.6 4.6 0 0 0 10 27z" fill="var(--accent)" stroke="var(--panel-line)" stroke-width="1.5"/>
    </svg>
    <span>WeatherFit</span>
  </a>
  <ul class="links">
    <li><a href="index.html">Home</a></li>
    <li><a href="plan.html">Your Plan</a></li>
    <li><a href="sports.html">Sports Guide</a></li>
    <li><a href="about.html">About</a></li>
  </ul>
</nav>`;

const FOOTER_FALLBACK = `
<p>WeatherFit gives general suggestions only. Use your own judgement about local conditions and what your body can handle.</p>`;

function markCurrentPage(header) {
  let current = window.location.pathname.split("/").pop() || "index.html";
  if (!current.includes(".")) current += ".html";

  header.querySelectorAll(".links a").forEach(link => {
    if (link.getAttribute("href") === current) {
      link.setAttribute("aria-current", "page");
    }
  });
}

function loadFragment(file, targetId, fallbackHtml, afterLoad) {
  const target = document.getElementById(targetId);
  if (!target) return;

  fetch(file)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Unable to load ${file}: ${response.status}`);
      }
      return response.text();
    })
    .catch(() => fallbackHtml)   // fetch failed: use the built-in copy
    .then(html => {
      target.innerHTML = html;
      if (afterLoad) afterLoad(target);
    });
}

loadFragment("nav.html", "site-header", NAV_FALLBACK, markCurrentPage);
loadFragment("footer.html", "site-footer", FOOTER_FALLBACK);