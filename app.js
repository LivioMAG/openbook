const deck = document.getElementById("deck");
const navList = document.getElementById("navList");
const progressBar = document.getElementById("progressBar");
const companyBadge = document.getElementById("companyBadge");

const state = { slides: [], pages: [], activeIndex: 0, settings: {} };
const STORAGE_KEY = "future-webdeck-state-v1";

async function loadContent() {
  // Kann später 1:1 gegen Supabase-Datenabfrage ersetzt werden.
  // z.B. const { data } = await supabase.from("webdeck_pages").select("*");
  const response = await fetch("content.json");
  if (!response.ok) throw new Error("content.json konnte nicht geladen werden.");
  return response.json();
}

function getPersisted() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function persistData(data) {
  if (!state.settings.persistEditsLocally) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Hier könnte später Supabase-Sync ergänzt werden (upsert pro Seiten-ID).
}

function chunkPages(pages, maxDefault) {
  const splitTypes = new Set(["itemList", "editableItemList", "todoItemList"]);
  return pages.flatMap((page) => {
    if (!splitTypes.has(page.type)) return [page];
    const items = page.items || [];
    const max = Number(page.maxItemsPerPage || maxDefault || 8);
    if (items.length <= max) return [page];
    const chunks = [];
    for (let i = 0; i < items.length; i += max) {
      const num = Math.floor(i / max) + 1;
      chunks.push({
        ...page,
        id: `${page.id}-${num}`,
        sourceId: page.id,
        title: num === 1 ? page.title : `${page.title} ${num}`,
        items: items.slice(i, i + max)
      });
    }
    return chunks;
  });
}

function esc(value = "") { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function renderMediaText(page) {
  return `<div class="panel media-grid">
    <article>
      ${page.text ? `<p>${esc(page.text)}</p>` : `<div class="empty-state">Kein Zusatztext vorhanden.</div>`}
    </article>
    <aside>
      ${page.image ? `<img class="media-image" src="${esc(page.image)}" alt="${esc(page.title)}" />` : `<div class="empty-state">Kein Bild hinterlegt.</div>`}
    </aside>
  </div>`;
}

function renderItemCards(items = []) {
  if (!items.length) return `<div class="empty-state">Keine Einträge vorhanden.</div>`;
  return `<div class="items-grid">${items.map((item) => `<article class="item-card"><h3 class="item-label">${esc(item.label)}</h3>${item.description ? `<p class="item-desc">${esc(item.description)}</p>` : ""}</article>`).join("")}</div>`;
}

function renderEditableList(page, pageIndex, persisted) {
  const rows = page.items || [];
  if (!rows.length) return `<div class="empty-state">Noch keine Themen vorhanden.</div>`;
  return `<div class="items-grid">${rows.map((item, i) => {
    const note = persisted?.editableNotes?.[page.id]?.[i] ?? item.note ?? "";
    return `<article class="item-card" data-page="${pageIndex}" data-item="${i}">
      <h3 class="item-label">${esc(item.label)}</h3>${item.description ? `<p class="item-desc">${esc(item.description)}</p>` : ""}
      <div class="todo-row"><strong>Notiz:</strong> <span>${note ? esc(note) : "—"}</span>
      <button class="edit-btn" data-action="toggle-edit">Edit</button></div>
      <div class="edit-area" hidden><textarea class="edit-text" placeholder="Notiz ergänzen ...">${esc(note)}</textarea><button class="save-btn" data-action="save-note">Speichern</button></div>
    </article>`;
  }).join("")}</div>`;
}

function renderTodoItemList(page, pageIndex, persisted) {
  const rows = page.items || [];
  if (!rows.length) return `<div class="empty-state">Keine Projekte vorhanden.</div>`;
  return `<div class="items-grid">${rows.map((item, i) => {
    const todos = persisted?.itemTodos?.[page.id]?.[i] ?? item.todos ?? [];
    return `<article class="item-card" data-page="${pageIndex}" data-item="${i}"><h3 class="item-label">${esc(item.label)}</h3>${item.description ? `<p class="item-desc">${esc(item.description)}</p>` : ""}
      <div>${todos.length ? todos.map((t, tIndex) => `<label class="todo-row"><input class="todo-check" type="checkbox" data-action="toggle-todo" data-todo="${tIndex}" ${t.done ? "checked" : ""} /><span>${esc(t.text)}</span>${t.priority ? `<span class="priority">${esc(t.priority)}</span>` : ""}</label>`).join("") : `<div class="empty-state">Noch keine To-dos.</div>`}</div>
      <button class="plus-btn" data-action="add-todo">+ To-do</button></article>`;
  }).join("")}</div>`;
}

function renderBulletTodo(page, pageIndex, persisted) {
  const bullets = persisted?.bullets?.[page.id] ?? page.bullets ?? [];
  return `<div class="panel media-grid"><article>
    ${bullets.length ? bullets.map((b, i) => `<label class="bullet-row" data-page="${pageIndex}" data-bullet="${i}"><input class="bullet-check" data-action="toggle-bullet" type="checkbox" ${b.done ? "checked" : ""}/><span>${esc(b.text)}</span></label>`).join("") : `<div class="empty-state">Noch keine Punkte vorhanden.</div>`}
    <button class="plus-btn" data-action="add-bullet">+ Punkt</button>
  </article><aside>${page.image ? `<img class="media-image" src="${esc(page.image)}" alt="${esc(page.title)}" />` : `<div class="empty-state">Kein Bild hinterlegt.</div>`}</aside></div>`;
}

function renderSlide(page, pageIndex, persisted) {
  const el = document.createElement("section");
  el.className = "slide";
  el.id = page.id;
  let body = "";
  if (page.type === "mediaText") body = renderMediaText(page);
  if (page.type === "itemList") body = `<div class="panel">${renderItemCards(page.items)}</div>`;
  if (page.type === "editableItemList") body = `<div class="panel">${renderEditableList(page, pageIndex, persisted)}</div>`;
  if (page.type === "todoItemList") body = `<div class="panel">${renderTodoItemList(page, pageIndex, persisted)}</div>`;
  if (page.type === "bulletTodoPage") body = renderBulletTodo(page, pageIndex, persisted);
  el.innerHTML = `<p class="eyebrow">${esc(page.type)}</p><h2>${esc(page.title)}</h2>${page.description ? `<p>${esc(page.description)}</p>` : ""}${body}`;
  return el;
}

function updateActive(index) {
  state.activeIndex = Math.max(0, Math.min(index, state.slides.length - 1));
  state.slides.forEach((slide, i) => slide.classList.toggle("active", i === state.activeIndex));
  document.querySelectorAll(".nav-list button").forEach((b, i) => b.classList.toggle("active", i === state.activeIndex));
  progressBar.style.width = `${((state.activeIndex + 1) / state.slides.length) * 100}%`;
}
function goTo(index) { updateActive(index); state.slides[state.activeIndex].scrollIntoView({ behavior: "smooth", block: "start" }); }

function renderNav() {
  navList.innerHTML = state.slides.map((s, i) => `<li><button data-index="${i}">${esc(s.querySelector("h2")?.textContent || s.id)}</button></li>`).join("");
  navList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-index]");
    if (!btn) return;
    goTo(Number(btn.dataset.index));
  });
}

function bindInteractions(content) {
  const persisted = getPersisted();
  deck.addEventListener("click", (e) => {
    const action = e.target?.dataset?.action;
    if (!action) return;
    e.stopPropagation();
    const card = e.target.closest("[data-page][data-item]");

    if (action === "toggle-edit") card.querySelector(".edit-area").hidden = !card.querySelector(".edit-area").hidden;
    if (action === "save-note" && card) {
      const page = state.pages[Number(card.dataset.page)];
      const itemIndex = Number(card.dataset.item);
      const value = card.querySelector(".edit-text").value.trim();
      persisted.editableNotes ??= {}; persisted.editableNotes[page.id] ??= {}; persisted.editableNotes[page.id][itemIndex] = value;
      persistData(persisted); init(true, content);
    }
    if (action === "add-todo" && card) {
      const text = prompt("Neues To-do:");
      if (!text) return;
      const page = state.pages[Number(card.dataset.page)];
      const itemIndex = Number(card.dataset.item);
      persisted.itemTodos ??= {}; persisted.itemTodos[page.id] ??= {}; persisted.itemTodos[page.id][itemIndex] ??= [...(page.items[itemIndex].todos || [])];
      persisted.itemTodos[page.id][itemIndex].push({ text, done: false, priority: "mittel" });
      persistData(persisted); init(true, content);
    }
    if (action === "add-bullet") {
      const slide = e.target.closest(".slide");
      const page = state.pages.find((p) => p.id === slide.id);
      const text = prompt("Neuer Punkt:");
      if (!text) return;
      persisted.bullets ??= {}; persisted.bullets[page.id] ??= [...(page.bullets || [])];
      persisted.bullets[page.id].push({ text, done: false });
      persistData(persisted); init(true, content);
    }
  });

  deck.addEventListener("change", (e) => {
    const persistedState = getPersisted();
    if (e.target.dataset.action === "toggle-todo") {
      const card = e.target.closest("[data-page][data-item]");
      const page = state.pages[Number(card.dataset.page)];
      const itemIndex = Number(card.dataset.item);
      const todoIndex = Number(e.target.dataset.todo);
      persistedState.itemTodos ??= {}; persistedState.itemTodos[page.id] ??= {}; persistedState.itemTodos[page.id][itemIndex] ??= [...(page.items[itemIndex].todos || [])];
      persistedState.itemTodos[page.id][itemIndex][todoIndex].done = e.target.checked;
      persistData(persistedState);
    }
    if (e.target.dataset.action === "toggle-bullet") {
      const slide = e.target.closest(".slide");
      const page = state.pages.find((p) => p.id === slide.id);
      const idx = Number(e.target.closest("[data-bullet]").dataset.bullet);
      persistedState.bullets ??= {}; persistedState.bullets[page.id] ??= [...(page.bullets || [])];
      persistedState.bullets[page.id][idx].done = e.target.checked;
      persistData(persistedState);
    }
  });

  deck.addEventListener("scroll", () => {
    const idx = state.slides.reduce((best, slide, i) => {
      const top = Math.abs(slide.getBoundingClientRect().top);
      return top < best.top ? { i, top } : best;
    }, { i: 0, top: Infinity }).i;
    updateActive(idx);
  });

  document.addEventListener("keydown", (e) => {
    if (["ArrowRight", "ArrowDown", " "].includes(e.key)) { e.preventDefault(); goTo(state.activeIndex + 1); }
    if (["ArrowLeft", "ArrowUp"].includes(e.key)) { e.preventDefault(); goTo(state.activeIndex - 1); }
  });
}

async function init(rerender = false, cachedContent = null) {
  try {
    const content = cachedContent || await loadContent();
    state.settings = content.settings || {};
    document.documentElement.style.setProperty("--accent", content.meta?.theme?.accent || "#7c3aed");
    companyBadge.textContent = content.meta?.company || "Webdeck";

    state.pages = chunkPages(content.pages || [], state.settings.maxItemsPerPage || 8);
    const persisted = getPersisted();
    deck.innerHTML = "";
    deck.append(...state.pages.map((p, i) => renderSlide(p, i, persisted)));
    state.slides = [...deck.querySelectorAll(".slide")];
    renderNav();
    if (!rerender) bindInteractions(content);
    updateActive(Math.min(state.activeIndex, state.slides.length - 1));
  } catch (err) {
    deck.innerHTML = "";
    deck.append(document.getElementById("errorTemplate").content.cloneNode(true));
    console.error(err);
  }
}

init();
