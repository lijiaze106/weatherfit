// Saves and reads the plan history in this browser (localStorage).
// Used by plan.js (to save a plan) and history.js (to show the history).
// Nothing is sent to a server: the records stay on this device.

const PlanStore = (() => {
  const HISTORY_KEY = "weatherfit-history";
  const NAME_KEY = "weatherfit-name";
  const MAX_RECORDS = 500;

  // Names are grouped without caring about upper/lower case: "Ann" and "ann" are the same person
  function keyOf(name) {
    return String(name).trim().toLowerCase();
  }

  function all() {
    try {
      const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(list)
        ? list.filter(item => item && typeof item.name === "string" && typeof item.savedAt === "string")
        : [];
    } catch (error) {
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-MAX_RECORDS)));
      return true;
    } catch (error) {
      return false;   // storage is blocked or full
    }
  }

  // Returns true when the record was saved
  function add(record) {
    const list = all();
    record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    list.push(record);
    const ok = saveAll(list);
    if (ok) setLastName(record.name);
    return ok;
  }

  function remove(id) {
    return saveAll(all().filter(item => item.id !== id));
  }

  function removeByName(name) {
    const key = keyOf(name);
    return saveAll(all().filter(item => keyOf(item.name) !== key));
  }

  function clear() {
    return saveAll([]);
  }

  // [{ key, label, count }] for every person who has records (label = most recent spelling)
  function people() {
    const map = new Map();
    all().sort((a, b) => a.savedAt.localeCompare(b.savedAt)).forEach(item => {
      const key = keyOf(item.name);
      const entry = map.get(key) || { key, label: item.name, count: 0 };
      entry.label = item.name;
      entry.count += 1;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  function lastName() {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch (error) { return ""; }
  }

  function setLastName(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch (error) { /* ignore */ }
  }

  return { keyOf, all, add, remove, removeByName, clear, people, lastName, setLastName };
})();