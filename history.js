// History page: choose a name, then see the plans saved under it.
// Uses PlanStore from store.js and PLACES from data.js.

const whoEl      = document.getElementById("who");
const listEl     = document.getElementById("history-list");
const contentEl  = document.getElementById("history-content");
const emptyBox   = document.getElementById("history-empty");
const statusEl   = document.getElementById("history-status");
const deleteBtn  = document.getElementById("delete-shown");

let shown = [];   // the records currently on the screen

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function makeTag(text) {
  const span = document.createElement("span");
  span.className = "tag";
  span.textContent = text;
  return span;
}

// Fill the name list. keepKey keeps the current choice when it still exists.
function fillPeople(keepKey) {
  const people = PlanStore.people();
  whoEl.replaceChildren();

  const everyone = document.createElement("option");
  everyone.value = "";
  const total = people.reduce((sum, p) => sum + p.count, 0);
  everyone.textContent = `Everyone (${total} ${total === 1 ? "plan" : "plans"})`;
  whoEl.appendChild(everyone);

  people.forEach(person => {
    const option = document.createElement("option");
    option.value = person.key;
    option.textContent = `${person.label} (${person.count})`;
    whoEl.appendChild(option);
  });

  const wanted = keepKey !== undefined ? keepKey : PlanStore.keyOf(PlanStore.lastName());
  whoEl.value = people.some(p => p.key === wanted) ? wanted : "";
  return people.length;
}

function makeRecord(record, showName) {
  const li = document.createElement("li");
  li.className = "record panel";
  li.dataset.level = record.level || "ok";

  const head = document.createElement("div");
  head.className = "record-head";
  const sport = document.createElement("strong");
  sport.textContent = record.sport;
  const verdict = document.createElement("span");
  verdict.className = "record-verdict";
  verdict.textContent = record.verdict || "";
  head.append(sport, verdict);

  const meta = document.createElement("p");
  meta.className = "record-meta";
  meta.textContent = (showName ? record.name + " · " : "") + formatDate(record.savedAt);

  const tags = document.createElement("div");
  tags.className = "tags";
  tags.append(
    makeTag(PLACES[record.place] || record.place),
    makeTag(cap(record.weather)),
    makeTag(`${record.temp}°C`)
  );
  if (typeof record.score === "number") tags.append(makeTag(`Score ${record.score}`));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn ghost small";
  remove.textContent = "Delete";
  remove.setAttribute("aria-label", `Delete ${record.sport} record from ${formatDate(record.savedAt)}`);
  remove.addEventListener("click", () => {
    if (PlanStore.remove(record.id)) {
      statusEl.textContent = "Record deleted.";
      render(whoEl.value);
    } else {
      statusEl.textContent = "Could not delete the record because the browser blocks storage.";
    }
  });

  li.append(head, meta, tags, remove);
  return li;
}

function render(keepKey) {
  const peopleCount = fillPeople(keepKey);
  const hasAny = peopleCount > 0;
  emptyBox.hidden = hasAny;
  contentEl.hidden = !hasAny;
  if (!hasAny) { shown = []; return; }

  const key = whoEl.value;
  shown = PlanStore.all()
    .filter(item => !key || PlanStore.keyOf(item.name) === key)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));   // newest first

  // Summary
  const counts = {};
  shown.forEach(item => { counts[item.sport] = (counts[item.sport] || 0) + 1; });
  let topSport = "–", topCount = 0;
  shown.forEach(item => {                                    // newest first, so ties go to the newest
    if (counts[item.sport] > topCount) { topSport = item.sport; topCount = counts[item.sport]; }
  });
  document.getElementById("stat-count").textContent = String(shown.length);
  document.getElementById("stat-sport").textContent = topCount > 1 ? `${topSport} (${topCount}×)` : topSport;
  document.getElementById("stat-last").textContent = shown.length ? formatDate(shown[0].savedAt) : "–";

  // Records
  listEl.replaceChildren(...shown.map(item => makeRecord(item, !key)));

  const label = key ? whoEl.options[whoEl.selectedIndex].textContent.replace(/ \(\d+\)$/, "") : "";
  deleteBtn.textContent = key ? `Delete ${label}'s records` : "Delete all records";
}

whoEl.addEventListener("change", () => {
  statusEl.textContent = "";
  render(whoEl.value);
});

deleteBtn.addEventListener("click", () => {
  const key = whoEl.value;
  const question = key ? "Delete all records of this person? This cannot be undone." : "Delete ALL records? This cannot be undone.";
  if (!window.confirm(question)) return;
  const ok = key ? PlanStore.removeByName(key) : PlanStore.clear();
  statusEl.textContent = ok ? "Records deleted." : "Could not delete the records because the browser blocks storage.";
  render(key ? "" : undefined);
});

// Download the records on the screen as a CSV file (opens in Excel)
function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

document.getElementById("export-csv").addEventListener("click", () => {
  if (!shown.length) return;
  const rows = [["Name", "Date", "Place", "Weather", "Temperature (C)", "Verdict", "Sport", "Score"]];
  shown.forEach(item => rows.push([
    item.name, item.savedAt, PLACES[item.place] || item.place, item.weather,
    item.temp, item.verdict || "", item.sport, item.score === null ? "" : item.score
  ]));
  const text = "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "weatherfit-history.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  statusEl.textContent = "CSV file downloaded.";
});

render();