const deck = document.getElementById("deck");
const navList = document.getElementById("navList");
const progressBar = document.getElementById("progressBar");
const companyBadge = document.getElementById("companyBadge");

const state = { slides: [], activeIndex: 0 };

async function loadContent() {
  // Später kann diese Funktion durch eine Supabase-Abfrage ersetzt werden.
  // Beispiel:
  // const { data, error } = await supabase.from("presentation_sections").select("*");
  const response = await fetch("content.json");
  if (!response.ok) throw new Error("content.json konnte nicht geladen werden.");
  return response.json();
}

function initials(name = "?") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function statusColor(value) {
  if (value < 40) return ["niedrig", "#22c55e"];
  if (value < 75) return ["normal", "#22d3ee"];
  if (value < 90) return ["hoch", "#f59e0b"];
  return ["kritisch", "#ef4444"];
}

function createHero(meta) {
  const section = document.createElement("section");
  section.className = "slide hero active";
  section.id = "hero";
  section.innerHTML = `
    <p class="eyebrow">Future Meeting Deck</p>
    <h1>${meta.title}</h1>
    <p>${meta.subtitle}</p>
    <div class="hero-meta">
      <span>${meta.company}</span>
      <span>${new Date(meta.date).toLocaleDateString("de-CH")}</span>
    </div>
    <button class="start-btn" data-action="start">Präsentation starten</button>
    <div class="stat-grid">
      ${meta.heroStats.map((s) => `<article class="card"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></article>`).join("")}
    </div>`;
  return section;
}

function createParticipants(section) {
  return `<div class="card-grid">${section.items.map((p) => `
      <article class="card">
        <div class="avatar">${p.image ? `<img src="${p.image}" alt="${p.name}" />` : initials(p.name)}</div>
        <h3>${p.name}</h3>
        <p>${p.role}</p>
        <small>${p.department}</small>
      </article>`).join("")}
    </div>`;
}

function createWorkload(section) {
  return section.items.map((w) => {
    const [label, color] = statusColor(w.value);
    return `<article class="work-card card" data-value="${w.value}">
      <h3>${w.label} <span class="badge" style="border-color:${color};color:${color}">${label}</span></h3>
      <div class="meter"><div class="meter-fill" style="background:${color}"></div></div>
      <p><strong>${w.value}%</strong> · ${w.note}</p>
    </article>`;
  }).join("");
}

function createProjects(section) {
  return `<div class="project-grid">${section.items.map((p) => `
    <article class="project-card">
      <p class="eyebrow">${p.status}</p>
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      ${(p.todos || []).map((t) => `<div class="todo"><span>${t.text}</span><span class="priority">${t.priority}</span></div>`).join("")}
    </article>`).join("")}</div>`;
}

function createText(section) {
  return `<div class="text-layout">
    <article class="card"><p>${section.content}</p>
    ${section.bullets?.length ? `<ul class="bullets">${section.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
    </article>
    <aside class="visual-card">${section.image ? `<img src="${section.image}" alt="${section.title}" />` : ""}</aside>
  </div>`;
}

function createSection(section) {
  const el = document.createElement("section");
  el.className = "slide";
  el.id = section.id;
  el.dataset.section = section.type;
  el.innerHTML = `<p class="eyebrow">${section.eyebrow}</p><h2>${section.title}</h2><p>${section.description}</p>`;
  if (section.type === "participants") el.innerHTML += createParticipants(section);
  if (section.type === "workload") el.innerHTML += createWorkload(section);
  if (section.type === "projects") el.innerHTML += createProjects(section);
  if (section.type === "text") el.innerHTML += createText(section);
  return el;
}

function updateActive(index) {
  state.activeIndex = Math.max(0, Math.min(index, state.slides.length - 1));
  state.slides.forEach((slide, i) => slide.classList.toggle("active", i === state.activeIndex));
  document.querySelectorAll(".nav-list button").forEach((b, i) => b.classList.toggle("active", i === state.activeIndex));
  progressBar.style.width = `${((state.activeIndex + 1) / state.slides.length) * 100}%`;

  const active = state.slides[state.activeIndex];
  active.querySelectorAll(".work-card").forEach((card) => {
    const fill = card.querySelector(".meter-fill");
    fill.style.width = `${card.dataset.value}%`;
  });
}

function goTo(index) {
  updateActive(index);
  state.slides[state.activeIndex].scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupControls() {
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

  deck.addEventListener("click", (e) => {
    if (e.target?.dataset.action === "start") goTo(1);
  });
}

function renderNav(slides) {
  navList.innerHTML = slides.map((s, i) => `<li><button aria-label="Zu ${s.id} springen" data-index="${i}">${s.querySelector("h1,h2")?.textContent || s.id}</button></li>`).join("");
  navList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-index]");
    if (!btn) return;
    goTo(Number(btn.dataset.index));
  });
}

async function init() {
  try {
    const content = await loadContent();
    document.documentElement.style.setProperty("--accent", content.meta.theme?.accent || "#7c3aed");
    companyBadge.textContent = content.meta.company;

    const hero = createHero(content.meta);
    deck.append(hero, ...content.sections.map(createSection));

    state.slides = [...deck.querySelectorAll(".slide")];
    renderNav(state.slides);
    setupControls();
    updateActive(0);
  } catch (err) {
    deck.innerHTML = "";
    deck.append(document.getElementById("errorTemplate").content.cloneNode(true));
    console.error(err);
  }
}

init();
