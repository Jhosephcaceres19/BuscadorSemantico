// script.js - Buscador Semántico Turismo Cochabamba
// VERSIÓN COMPLETA - SOLO ESPAÑOL/INGLÉS

const BASE_URL    = "http://localhost:3000/api/search";
const PREFIX_URL  = "http://localhost:3000/api/search-prefix";
const SUGGEST_URL = "http://localhost:3000/api/suggest";

const i18n = {
  es: {
    search:"Buscar",placeholder:"Ej: museos, parques, hospedaje, lugares gratuitos…",
    free:"Gratuito",notFree:"Con costo",accessible:"Accesible",discount:"Con descuento",
    reservation:"Requiere reserva",heritage:"Patrimonio Nacional",available:"Disponible",
    noResults:"Sin resultados para",try:"Intenta con otro término.",loading:"Buscando en la ontología…",
    price_night:"Noche",price_day:"Día",entry:"Entrada",approx_cost:"Costo aprox.",
    activities:"Actividades",ingredients:"Ingredientes",route:"Ruta",capacity:"Capacidad",
    frequency:"Frecuencia",dates:"Fechas",origin:"Cultura",conservation:"Conservación",
    includes:"Incluye",services:"Servicios",concurrency:"Concurrencia",schedule:"Horario",
  },
  en: {
    search:"Search",placeholder:"E.g.: museums, parks, hotels, free places…",
    free:"Free",notFree:"Paid",accessible:"Accessible",discount:"With discount",
    reservation:"Reservation required",heritage:"National Heritage",available:"Available",
    noResults:"No results for",try:"Try another term.",loading:"Searching ontology…",
    price_night:"Night",price_day:"Day",entry:"Entry",approx_cost:"Approx. cost",
    activities:"Activities",ingredients:"Ingredients",route:"Route",capacity:"Capacity",
    frequency:"Frequency",dates:"Dates",origin:"Culture",conservation:"Conservation",
    includes:"Includes",services:"Services",concurrency:"Attendance",schedule:"Schedule",
  }
};

const CLASE_CONFIG = {
  "Atractivo Natural":             { color: "#2d6a4f", icon: "🌿" },
  "Atractivo Cultural Histórico":  { color: "#7b3f00", icon: "🏛️" },
  "Atractivo Recreativo":          { color: "#1a4e8c", icon: "🎡" },
  "Atractivo Arqueológico":        { color: "#5a3e1b", icon: "🏺" },
  "Producto Alimenticio":          { color: "#a8440a", icon: "🍲" },
  "Hospedaje":                     { color: "#4a1942", icon: "🛏️" },
  "Evento Turístico":              { color: "#7d0c3c", icon: "🎉" },
  "Establecimiento Gastronomico":  { color: "#1a5c3a", icon: "🍽️" },
  "Transporte":                    { color: "#1c3a5e", icon: "🚌" },
};

function getClaseConfig(clase) {
  const norm = (s) => (s || "").toLowerCase().replace(/[_áéíóú]/g, c =>
    ({ á:"a",é:"e",í:"i",ó:"o",ú:"u",_:" " }[c] || c));
  const nc = norm(clase);
  for (const [key, val] of Object.entries(CLASE_CONFIG)) {
    if (nc.includes(norm(key)) || norm(key).includes(nc)) return val;
  }
  return { color: "#555", icon: "📍" };
}

let currentLang    = "es";
let suggestTimeout = null;
let realtimeTimeout = null;
let currentSugIdx  = -1;

const input      = document.getElementById("searchInput");
const btn        = document.getElementById("searchBtn");
const resultsEl  = document.getElementById("resultados");
const emptyState = document.getElementById("emptyState");
const suggestBox = document.getElementById("suggestBox");

function parseOWL(owlText) {
  const results = [];
  try {
    const parser  = new DOMParser();
    const xmlDoc  = parser.parseFromString(owlText, "text/xml");
    if (xmlDoc.querySelector("parsererror")) return results;
    const items = xmlDoc.querySelectorAll("owl\\:NamedIndividual, NamedIndividual");
    for (const item of items) {
      const about = item.getAttribute("rdf:about") || "";
      if (!about.includes("Resultado_")) continue;
      const txt  = (tag) => { const el = item.querySelector(tag); return el ? (el.textContent || "").trim() : ""; };
      const bool = (tag) => { const el = item.querySelector(tag); if (!el) return null; return el.textContent.trim() === "true"; };
      const num  = (tag) => { const el = item.querySelector(tag); if (!el || !el.textContent.trim()) return null; const n = parseFloat(el.textContent); return isNaN(n) ? null : n; };
      const e = {
        nombre:txt("nombre"),clase:txt("clase"),tipo:txt("tipo"),descripcion:txt("descripcion"),
        ubicacion:txt("ubicacion"),horario:txt("horario"),gratuito:bool("gratuito"),
        accesibilidad:bool("accesibilidad"),tieneDescuento:bool("tieneDescuento"),
        requiereReserva:bool("requiereReserva"),patrimonioNacional:bool("patrimonioNacional"),
        disponible:bool("disponible"),precioNoche:num("precioNoche"),precioDia:num("precioDia"),
        costoEntrada:num("costoEntrada"),costoAprox:num("costoAprox"),actividades:txt("actividades"),
        ingredientes:txt("ingredientes"),ruta:txt("ruta"),epoch:txt("epoch"),frecuencia:txt("frecuencia"),
        fechaInicio:txt("fechaInicio"),fechaFin:txt("fechaFin"),culturaOrigen:txt("culturaOrigen"),
        estadoConservacion:txt("estadoConservacion"),incluye:txt("incluye"),servicios:txt("servicios"),
        capacidad:num("capacidad"),nivelConcurrencia:txt("nivelConcurrencia"),
      };
      if (e.nombre && e.nombre !== "No se encontraron resultados") results.push(e);
    }
  } catch (err) { console.error("Error parseando OWL:", err); }
  return results;
}

function esc(str) {
  if (!str && str !== false && str !== 0) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderCard(e, t) {
  const cfg = getClaseConfig(e.clase);
  const color = cfg.color;
  const icon  = cfg.icon;
  const claseLabel = (e.clase || "").replace(/_/g, " ");
  const badges = [];
  if (e.gratuito === true)           badges.push(`<span class="badge badge--free">🆓 ${t.free}</span>`);
  else if (e.gratuito === false)     badges.push(`<span class="badge badge--paid">💰 ${t.notFree}</span>`);
  if (e.accesibilidad === true)      badges.push(`<span class="badge badge--access">♿ ${t.accessible}</span>`);
  if (e.tieneDescuento === true)     badges.push(`<span class="badge badge--discount">🏷️ ${t.discount}</span>`);
  if (e.requiereReserva === true)    badges.push(`<span class="badge badge--reserve">📅 ${t.reservation}</span>`);
  if (e.patrimonioNacional === true) badges.push(`<span class="badge badge--heritage">🏛️ ${t.heritage}</span>`);
  if (e.disponible === true)         badges.push(`<span class="badge badge--avail">✅ ${t.available}</span>`);
  if (e.horario)                     badges.push(`<span class="badge badge--time">⏰ ${esc(e.horario)}</span>`);
  const extras = [];
  if (e.precioNoche)      extras.push(`<p class="card-extra">💤 ${t.price_night}: <strong>Bs. ${e.precioNoche}</strong></p>`);
  if (e.precioDia)        extras.push(`<p class="card-extra">☀️ ${t.price_day}: <strong>Bs. ${e.precioDia}</strong></p>`);
  if (e.costoEntrada !== null && e.costoEntrada !== undefined) extras.push(`<p class="card-extra">🎫 ${t.entry}: <strong>Bs. ${e.costoEntrada}</strong></p>`);
  if (e.costoAprox)       extras.push(`<p class="card-extra">💵 ${t.approx_cost}: <strong>Bs. ${e.costoAprox}</strong></p>`);
  if (e.actividades)      extras.push(`<p class="card-extra">🎯 ${t.activities}: ${esc(e.actividades)}</p>`);
  if (e.ingredientes)     extras.push(`<p class="card-extra">🍳 ${t.ingredients}: ${esc(e.ingredientes)}</p>`);
  if (e.ruta)             extras.push(`<p class="card-extra">🗺️ ${t.route}: ${esc(e.ruta)}</p>`);
  if (e.capacidad)        extras.push(`<p class="card-extra">👥 ${t.capacity}: ${e.capacidad} pers.</p>`);
  if (e.frecuencia)       extras.push(`<p class="card-extra">🔁 ${t.frequency}: ${esc(e.frecuencia)}</p>`);
  if (e.fechaInicio || e.fechaFin) extras.push(`<p class="card-extra">📅 ${t.dates}: ${esc(e.fechaInicio || "")}${e.fechaFin ? " → " + esc(e.fechaFin) : ""}</p>`);
  if (e.culturaOrigen)    extras.push(`<p class="card-extra">🏺 ${t.origin}: ${esc(e.culturaOrigen)}</p>`);
  if (e.estadoConservacion) extras.push(`<p class="card-extra">🔍 ${t.conservation}: ${esc(e.estadoConservacion)}</p>`);
  if (e.incluye)          extras.push(`<p class="card-extra">✨ ${t.includes}: ${esc(e.incluye)}</p>`);
  if (e.servicios)        extras.push(`<p class="card-extra">🛎️ ${t.services}: ${esc(e.servicios)}</p>`);
  if (e.nivelConcurrencia) extras.push(`<p class="card-extra">👁️ ${t.concurrency}: ${esc(e.nivelConcurrencia)}</p>`);
  if (e.epoch)            extras.push(`<p class="card-extra">🕰️ Época: ${esc(e.epoch)}</p>`);
  return `
    <article class="result-card" style="--accent:${color}">
      <div class="card-header">
        <span class="card-icon">${icon}</span>
        <div class="card-clase">${esc(claseLabel)}</div>
      </div>
      <h3 class="card-nombre">${esc(e.nombre || "Sin nombre")}</h3>
      ${e.tipo ? `<p class="card-tipo">${esc(e.tipo)}</p>` : ""}
      ${e.ubicacion ? `<p class="card-ubicacion">📍 ${esc(e.ubicacion)}</p>` : ""}
      ${e.descripcion ? `<p class="card-descripcion">${esc(e.descripcion)}</p>` : ""}
      ${badges.length ? `<div class="card-badges">${badges.join("")}</div>` : ""}
      ${extras.length ? `<div class="card-extras">${extras.join("")}</div>` : ""}
    </article>`;
}

async function doSearch(q) {
  const query = (typeof q === "string" && q.trim() !== "") ? q.trim() : input.value.trim();
  const t = i18n[currentLang];
  if (!query) { resultsEl.innerHTML = ""; emptyState.style.display = "flex"; return; }

  hideSuggestions();
  emptyState.style.display = "none";
  resultsEl.innerHTML = `<div class="loading"><div class="loading-spinner"></div><span>${t.loading}</span></div>`;

  try {
    const resp = await fetch(`${BASE_URL}?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/rdf+xml" }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const owlText    = await resp.text();
    const resultados = parseOWL(owlText);
    if (resultados.length === 0) {
      resultsEl.innerHTML = `<div class="no-results"><span class="no-results-icon">🔭</span><p>${t.noResults} <strong>"${esc(query)}"</strong></p><p class="no-results-sub">${t.try}</p></div>`;
      return;
    }
    resultsEl.innerHTML = resultados.map((e) => renderCard(e, t)).join("");
    resultsEl.querySelectorAll(".result-card").forEach((card, i) => {
      card.style.animationDelay = `${i * 50}ms`;
      card.classList.add("card-enter");
    });
    document.querySelector(".results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error("Error:", err);
    resultsEl.innerHTML = `<div class="no-results"><span class="no-results-icon">❌</span><p>Error de conexión. ¿El servidor está corriendo en localhost:3000?</p></div>`;
  }
}

async function doRealtimeSearch(prefijo) {
  const query = prefijo.trim();
  const t = i18n[currentLang];
  
  if (!query || query.length < 2) { 
    if (query.length === 0) {
      emptyState.style.display = "flex";
      resultsEl.innerHTML = "";
    }
    return; 
  }

  try {
    const resp = await fetch(`${PREFIX_URL}?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/rdf+xml" }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const owlText    = await resp.text();
    const resultados = parseOWL(owlText);
    
    if (resultados.length === 0) {
      if (query.length >= 2) {
        resultsEl.innerHTML = `<div class="no-results"><span class="no-results-icon">🔭</span><p>${t.noResults} <strong>"${esc(query)}"</strong></p><p class="no-results-sub">${t.try}</p></div>`;
        emptyState.style.display = "none";
      }
      return;
    }
    
    emptyState.style.display = "none";
    resultsEl.innerHTML = resultados.map((e) => renderCard(e, t)).join("");
    resultsEl.querySelectorAll(".result-card").forEach((card, i) => {
      card.style.animationDelay = `${i * 50}ms`;
      card.classList.add("card-enter");
    });
  } catch (err) {
    console.error("Error en búsqueda en tiempo real:", err);
  }
}

async function fetchSuggestions(prefijo) {
  try {
    const resp = await fetch(`${SUGGEST_URL}?q=${encodeURIComponent(prefijo)}`);
    if (!resp.ok) return [];
    return await resp.json();
  } catch { return getLocalSuggestions(prefijo); }
}

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").trim();
}

function getLocalSuggestions(prefijo) {
  const np = norm(prefijo);
  const sugerenciasLocal = [
    "museos", "museums", "hospedaje", "hotels", "parques", "parks",
    "naturales", "nature", "ferias", "fairs", "transporte", "transport",
    "gratuitos", "free", "accesible", "accessible", "senderismo", "hiking",
    "Cristo de la Concordia", "Laguna Alalay", "Parque Nacional Tunari",
    "Silpancho", "Pique Macho"
  ];
  return sugerenciasLocal.filter(s => norm(s).includes(np)).slice(0, 6);
}

function showSuggestions(sugs) {
  if (!sugs.length) { hideSuggestions(); return; }
  currentSugIdx = -1;
  suggestBox.innerHTML = sugs.map((s, i) =>
    `<li class="suggest-item" data-idx="${i}" data-val="${esc(s)}">
      <span class="suggest-icon">🔍</span> ${esc(s)}
    </li>`
  ).join("");
  suggestBox.style.display = "block";

  suggestBox.querySelectorAll(".suggest-item").forEach(li => {
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const valorSeleccionado = li.dataset.val;
      input.value = valorSeleccionado;
      hideSuggestions();
      doSearch(valorSeleccionado);
    });
  });
}

function hideSuggestions() {
  suggestBox.style.display = "none";
  currentSugIdx = -1;
}

function navigateSuggestions(dir) {
  const items = suggestBox.querySelectorAll(".suggest-item");
  if (!items.length) return;
  items[currentSugIdx]?.classList.remove("suggest-item--active");
  currentSugIdx = (currentSugIdx + dir + items.length + 1) % (items.length + 1) - 1;
  if (currentSugIdx >= 0) {
    items[currentSugIdx].classList.add("suggest-item--active");
    input.value = items[currentSugIdx].dataset.val;
  }
}

function initChips() {
  const chips = document.querySelectorAll(".chip");
  console.log("📢 Inicializando", chips.length, "chips");
  
  chips.forEach(chip => {
    if (chip._handler) {
      chip.removeEventListener("click", chip._handler);
    }
    
    const handler = () => {
      let query = chip.dataset.query;
      if (!query) {
        const textSpan = chip.querySelector('.chip-text');
        if (textSpan) {
          query = textSpan.textContent.trim().toLowerCase();
        }
      }
      
      console.log("🔍 Chip clickeado:", query);
      
      if (query) {
        input.value = query;
        hideSuggestions();
        if (realtimeTimeout) clearTimeout(realtimeTimeout);
        doSearch(query);
        const resultsSection = document.querySelector(".results-section");
        if (resultsSection) resultsSection.scrollIntoView({ behavior: "smooth" });
      }
    };
    
    chip._handler = handler;
    chip.addEventListener("click", handler);
  });
}

// Evento principal
input.addEventListener("input", () => {
  clearTimeout(suggestTimeout);
  clearTimeout(realtimeTimeout);
  
  const q = input.value.trim();
  
  if (q.length < 2) { 
    hideSuggestions();
    if (q.length === 0) {
      emptyState.style.display = "flex";
      resultsEl.innerHTML = "";
    }
    return;
  }
  
  suggestTimeout = setTimeout(async () => {
    const sugs = await fetchSuggestions(q);
    showSuggestions(sugs);
  }, 200);
  
  realtimeTimeout = setTimeout(() => {
    if (q.length >= 2) {
      doRealtimeSearch(q);
    }
  }, 300);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(realtimeTimeout);
    hideSuggestions();
    doSearch();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (suggestBox.style.display === "none") {
      fetchSuggestions(input.value).then(showSuggestions);
    } else {
      navigateSuggestions(1);
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    navigateSuggestions(-1);
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

input.addEventListener("blur", () => {
  setTimeout(hideSuggestions, 150);
});

btn.addEventListener("click", () => {
  clearTimeout(realtimeTimeout);
  doSearch();
});

document.addEventListener("DOMContentLoaded", () => {
  initChips();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChips);
} else {
  initChips();
}

// Idioma inicial
const t0 = i18n[currentLang];
input.placeholder = t0.placeholder;
btn.textContent   = t0.search;

// Carrusel
(function () {
  const track  = document.getElementById("track");
  if (!track) return;
  const slides = track.children;
  const n      = slides.length;
  const dotsEl = document.getElementById("dots");
  let cur = 0, timer;

  if (dotsEl && n > 0) {
    for (let i = 0; i < n; i++) {
      const d = document.createElement("button");
      d.className = "dot" + (i === 0 ? " active" : "");
      d.setAttribute("aria-label", "Ir a slide " + (i + 1));
      d.onclick = () => go(i);
      dotsEl.appendChild(d);
    }
  }

  function go(idx) {
    cur = (idx + n) % n;
    track.style.transform = `translateX(-${cur * 100}%)`;
    if (dotsEl) {
      dotsEl.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === cur));
    }
    resetTimer();
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => go(cur + 1), 4500);
  }

  let touchStartX = 0;
  track.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  track.addEventListener("touchend", (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  if (prevBtn) prevBtn.onclick = () => go(cur - 1);
  if (nextBtn) nextBtn.onclick = () => go(cur + 1);

  if (n > 0) resetTimer();
})();

console.log("✅ Buscador Semántico listo - Español/Inglés");