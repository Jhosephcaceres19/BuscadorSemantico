// frontend/script.js
// Buscador Semántico - Turismo Cochabamba
// Procesa respuestas OWL/RDF-XML del backend

const BASE_URL = "http://localhost:3000/api/search";

// Traducciones
const translations = {
  es: { 
    search: "Buscar", 
    placeholder: "Ej: ¿Qué lugares son gratuitos?, museos, hoteles...", 
    free: "Gratuito", 
    notFree: "Con costo", 
    accessible: "Accesible", 
    schedule: "Horario", 
    discount: "Con descuento",
    reservation: "Requiere reserva",
    heritage: "Patrimonio Nacional",
    noResults: "Sin resultados para", 
    try: "Intenta con otro término.", 
    loading: "Buscando..." 
  },
  en: { 
    search: "Search", 
    placeholder: "E.g.: free places, museums, hotels...", 
    free: "Free", 
    notFree: "Paid", 
    accessible: "Accessible", 
    schedule: "Schedule", 
    discount: "With discount",
    reservation: "Reservation required",
    heritage: "National Heritage",
    noResults: "No results for", 
    try: "Try another term.", 
    loading: "Searching..." 
  },
  qu: { 
    search: "Mask'ay", 
    placeholder: "Ej: mana qullqi, museo, hotel...", 
    free: "Qullqi mana", 
    notFree: "Qullqiwan", 
    accessible: "Yaykuna atikuq", 
    schedule: "Pacha", 
    discount: "Qullqi wikch'uy",
    reservation: "Wakichiy atiykun",
    heritage: "Nasyunal hatun qullqi",
    noResults: "Mana tarikuchu:", 
    try: "Waq simiwan mask'ay.", 
    loading: "Mask'ay..." 
  }
};

let currentLang = "es";

const input = document.getElementById("searchInput");
const btn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("resultados");
const emptyState = document.getElementById("emptyState");

// Colores por clase
const claseColors = {
  Atractivo_Natural: "#2d6a4f",
  Atractivo_Cultural_Histórico: "#7b3f00",
  Atractivo_Recreativo: "#1a4e8c",
  Atractivo_Arqueológico: "#5a3e1b",
  Producto_Alimenticio: "#a8440a",
  Hospedaje: "#4a1942",
  Evento_Turístico: "#7d0c3c",
  Establecimiento_Gastronomico: "#1a5c3a",
  Transporte: "#1c3a5e",
};

function getColor(clase) {
  return claseColors[clase] || "#333";
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ============================================
// PARSER OWL/RDF-XML → JSON
// ============================================
function parseOWLToJSON(owlText) {
  const resultados = [];
  
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(owlText, "text/xml");
    
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error("Error parsing XML:", parserError.textContent);
      return resultados;
    }
    
    const items = xmlDoc.querySelectorAll("owl\\:NamedIndividual, NamedIndividual");
    
    for (let item of items) {
      const about = item.getAttribute("rdf:about") || "";
      
      if (about.includes("Resultado_")) {
        const getText = (tagName) => {
          const element = item.querySelector(`${tagName}, ${tagName.replace(/:/g, "\\:")}`);
          return element ? element.textContent || "" : "";
        };
        
        const getBoolean = (tagName) => {
          const element = item.querySelector(`${tagName}, ${tagName.replace(/:/g, "\\:")}`);
          return element ? element.textContent === "true" : null;
        };
        
        const getNumber = (tagName) => {
          const element = item.querySelector(`${tagName}, ${tagName.replace(/:/g, "\\:")}`);
          return element && element.textContent ? parseFloat(element.textContent) : null;
        };
        
        const entidad = {
          nombre: getText("nombre"),
          clase: getText("clase"),
          tipo: getText("tipo"),
          descripcion: getText("descripcion"),
          ubicacion: getText("ubicacion"),
          horario: getText("horario"),
          gratuito: getBoolean("gratuito"),
          accesibilidad: getBoolean("accesibilidad"),
          tieneDescuento: getBoolean("tieneDescuento"),
          requiereReserva: getBoolean("requiereReserva"),
          patrimonioNacional: getBoolean("patrimonioNacional"),
          precioNoche: getNumber("precioNoche"),
          precioDia: getNumber("precioDia"),
          costoEntrada: getNumber("costoEntrada"),
          actividades: getText("actividades"),
          ingredientes: getText("ingredientes")
        };
        
        if (entidad.nombre && entidad.nombre !== "No se encontraron resultados") {
          resultados.push(entidad);
        }
      }
    }
  } catch (error) {
    console.error("Error parsing OWL:", error);
  }
  
  return resultados;
}

// ============================================
// PREGUNTAS OFICIALES (ES + EN) → clave de búsqueda
// ============================================
function normalizarPregunta(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PREGUNTAS_OFICIALES = [
  // Español
  { firma: "que lugares son gratuitos", clave: "true" },
  { firma: "que museos hay en cochabamba", clave: "museo" },
  { firma: "que hoteles estan disponibles", clave: "hospedaje" },
  { firma: "que restaurantes hay", clave: "restaurante" },
  { firma: "que platos tipicos se pueden degustar", clave: "producto alimenticio" },
  { firma: "cuales son los principales parques turisticos de la ciudad", clave: "parque" },
  { firma: "que lugares turisticos cuentan con accesibilidad para sillas de ruedas", clave: "accesible" },
  { firma: "que festividades locales se celebran cada ano", clave: "evento" },
  { firma: "que medios de transporte llegan a los destinos turisticos", clave: "transporte" },
  { firma: "que iglesias turisticas se pueden visitar", clave: "iglesia" },
  { firma: "que rutas de senderismo existen en la region", clave: "senderismo" },
  { firma: "que lugares turisticos son recomendados para familias", clave: "familia" },
  { firma: "que atractivos turisticos de tipo mirador o ubicados en cerros existen", clave: "mirador" },
  { firma: "que ferias artesanales se realizan en la region", clave: "feria artesanal" },
  { firma: "que monumentos historicos son considerados puntos de interes", clave: "monumento" },
  { firma: "que parques hay en cochabamba", clave: "parque" },
  { firma: "que atractivos naturales existen", clave: "natural" },
  // Inglés
  { firma: "what places are free", clave: "true" },
  { firma: "what museums are in cochabamba", clave: "museo" },
  { firma: "what hotels are available", clave: "hospedaje" },
  { firma: "what restaurants are there", clave: "restaurante" },
  { firma: "what typical dishes can i try", clave: "producto alimenticio" },
  { firma: "what are the main tourist parks", clave: "parque" },
  { firma: "what tourist places have wheelchair accessibility", clave: "accesible" },
  { firma: "what local festivals are celebrated each year", clave: "evento" },
  { firma: "what means of transport reach tourist destinations", clave: "transporte" },
  { firma: "what tourist churches can i visit", clave: "iglesia" },
  { firma: "what hiking trails exist in the region", clave: "senderismo" },
  { firma: "what tourist places are recommended for families", clave: "familia" },
  { firma: "what viewpoints or hill attractions exist", clave: "mirador" },
  { firma: "what craft fairs are held in the region", clave: "feria artesanal" },
  { firma: "what historical monuments are points of interest", clave: "monumento" },
  { firma: "what parks are in cochabamba", clave: "parque" },
  { firma: "what natural attractions exist", clave: "natural" },
];

// ============================================
// TRADUCTOR DE PREGUNTAS - VERSIÓN DEFINITIVA CON BOOLEANOS
// ============================================
function traducirPregunta(texto) {
  const t = normalizarPregunta(texto);
  if (!t) return texto;

  // Coincidencia exacta o pregunta que contiene la firma oficial
  for (const { firma, clave } of PREGUNTAS_OFICIALES) {
    if (t === firma || t.includes(firma)) {
      console.log(`🔍 Pregunta oficial: "${texto}" → "${clave}"`);
      return clave;
    }
  }
  
  // ========================================
  // BOOLEANOS ESPECÍFICOS (prioridad alta)
  // ========================================
  
  // Boolean: Tiene_Descuento
  if (t.includes("descuento") || t.includes("tiene descuento") || 
      t.includes("tarifa especial") || t.includes("promoción") ||
      t.includes("descuentos en sus tarifas") || t.includes("para estudiantes") ||
      t.includes("residentes locales") || t.includes("adultos mayores")) {
    console.log(`🔍 Buscando con descuento → "descuento"`);
    return "descuento";
  }
  
  // Boolean: Requiere_Reserva
  if (t.includes("requiere reserva") || t.includes("reserva obligatoria") || 
      t.includes("reserva anticipada") || t.includes("reserva online") ||
      t.includes("por teléfono") || t.includes("reserva anticipada de entradas")) {
    console.log(`🔍 Buscando reserva obligatoria → "requiere_reserva"`);
    return "requiere_reserva";
  }
  
  // Boolean: Gratuito
  if (t.includes("gratuito") || t.includes("gratuitos") || t.includes("gratis") || 
      t.includes("sin costo") || t.includes("entrada libre") || t.includes("son gratuitos")) {
    console.log(`🔍 Buscando gratuitos → "true"`);
    return "true";
  }
  
  // Boolean: Accesibilidad
  if (t.includes("accesibilidad") || t.includes("rampas") || t.includes("silla de ruedas") ||
      t.includes("discapacidad") || t.includes("movilidad reducida") || 
      t.includes("barreras arquitectónicas")) {
    console.log(`🔍 Buscando accesibles → "accesible"`);
    return "accesible";
  }
  
  // Monumentos históricos (antes que patrimonio; evita confundir "puntos de interés")
  if (t.includes("monumentos historicos") || t.includes("historical monuments")) {
    console.log(`🔍 Buscando monumentos → "monumento"`);
    return "monumento";
  }

  // Boolean: Patrimonio Nacional
  if (t.includes("patrimonio nacional") || t.includes("monumento nacional") ||
      t.includes("patrimonio historico")) {
    console.log(`🔍 Buscando patrimonio nacional → "patrimonio_nacional"`);
    return "patrimonio_nacional";
  }
  
  // ========================================
  // COMBINACIÓN DE BOOLEANOS
  // ========================================
  
  // Gratuito + Accesible
  if ((t.includes("gratuito") || t.includes("sin costo")) && 
      (t.includes("accesible") || t.includes("silla de ruedas"))) {
    console.log(`🔍 Buscando gratuito Y accesible → "gratuito_accesible"`);
    return "gratuito_accesible";
  }
  
  // ========================================
  // CATEGORÍAS DIRECTAS
  // ========================================
  
  // Lugares turísticos generales → natural
  if (t.includes("qué lugares turísticos existen") || t.includes("qué atractivos turísticos hay") ||
      t.includes("qué se puede visitar") || t.includes("qué hacer en cochabamba") ||
      t.includes("lugares para visitar") || t.includes("guía turística")) {
    return "natural";
  }
  
  // Parques
  if (t.includes("principales parques") || t.includes("parques turísticos") ||
      (t.includes("parque") && !t.includes("nacional"))) {
    return "parque";
  }
  
  // Iglesias
  if (t.includes("iglesias turísticas") || t.includes("iglesias") || t.includes("catedral") || 
      t.includes("templo") || t.includes("convento")) {
    return "iglesia";
  }
  
  // Actividades
  if (t.includes("actividades turísticas") || t.includes("qué se puede hacer") ||
      t.includes("senderismo") || t.includes("trekking") || t.includes("caminata")) {
    return "senderismo";
  }
  
  // Familias
  if (t.includes("recomendado para familias") || t.includes("para familias") ||
      t.includes("recommended for families") || t.includes("con ninos pequenos")) {
    return "familia";
  }

  // Hoteles / hospedaje
  if (t.includes("hoteles") || t.includes("hotel") || t.includes("hospedaje") ||
      t.includes("alojamiento") || t.includes("hotels are available")) {
    return "hospedaje";
  }

  // Restaurantes
  if (t.includes("restaurante") || t.includes("restaurants are there")) {
    return "restaurante";
  }
  
  // Alta concurrencia
  if (t.includes("más visitados") || t.includes("alta concurrencia")) {
    return "concurrencia_alto";
  }
  
  // Cerca de lago o montaña
  if (t.includes("cerca de un lago") || t.includes("cerca de una montaña") || 
      t.includes("cerca de lago") || t.includes("cerca de montaña")) {
    return "laguna";
  }
  
  // Atractivos naturales
  if (t.includes("atractivos naturales") || t.includes("natural attractions exist")) {
    return "natural";
  }

  // Museos
  if (t.includes("museos") || t.includes("museums are in") ||
      (t.includes("museo") && !t.includes("arqueologico"))) {
    return "museo";
  }
  
  // Transporte
  if (t.includes("medios de transporte") || t.includes("transporte llegan") || 
      t.includes("cómo llegar") || t.includes("bus") || t.includes("taxi") || t.includes("teleférico")) {
    return "transporte";
  }
  
  // Ferias artesanales
  if (t.includes("ferias artesanales") || t.includes("feria artesanal") || 
      t.includes("artesanía") || t.includes("la cancha")) {
    return "feria artesanal";
  }
  
  // Festividades
  if (t.includes("festividades locales") || t.includes("festividades se celebran") ||
      t.includes("carnaval") || t.includes("urkupiña") || t.includes("todos santos")) {
    return "evento";
  }
  
  // Rutas de senderismo
  if (t.includes("rutas de senderismo") || t.includes("senderismo existen")) {
    return "senderismo";
  }
  
  // Guía especializado
  if (t.includes("guía especializado") || t.includes("guía turístico") || 
      t.includes("equipo adicional") || t.includes("servicio de guía") || t.includes("audioguía")) {
    return "museo";
  }
  
  // Primeros auxilios
  if (t.includes("primeros auxilios") || t.includes("asistencia médica")) {
    return "natural";
  }
  
  // Pet-friendly
  if (t.includes("animales de compañía") || t.includes("pet-friendly") || 
      t.includes("ingreso de animales") || t.includes("mascotas")) {
    return "parque";
  }
  
  // Alojamiento cerca
  if (t.includes("opciones de alojamiento") || t.includes("hoteles cerca") || 
      t.includes("alojamiento cerca")) {
    return "hospedaje";
  }
  
  // Horarios
  if (t.includes("horarios de apertura") || t.includes("horario de cierre")) {
    return "natural";
  }
  
  // Platos típicos
  if (t.includes("platos típicos") || t.includes("qué platos típicos") || 
      t.includes("degustar en los restaurantes")) {
    return "producto alimenticio";
  }
  
  // Miradores
  if (t.includes("mirador") || t.includes("ubicados en cerros") || t.includes("cerro")) {
    return "mirador";
  }
  
  // Centros culturales
  if (t.includes("centros culturales") || t.includes("casas patrimoniales") ||
      t.includes("palacio") || t.includes("casona")) {
    return "museo";
  }
  
  // Horario nocturno
  if (t.includes("horarios especiales en la noche") || t.includes("horario nocturno")) {
    return "natural";
  }
  
  // Río
  if (t.includes("ecosistema de tipo río") || t.includes("río")) {
    return "laguna";
  }
  
  // Eventos deportivos
  if (t.includes("eventos deportivos") || t.includes("competencia turística")) {
    return "evento";
  }
  
  // Turismo fotográfico
  if (t.includes("turismo fotográfico") || t.includes("paisajes")) {
    return "mirador";
  }
  
  // Turismo rural
  if (t.includes("turismo rural") || t.includes("opciones de turismo rural") ||
      t.includes("turismo rural sostenible") || t.includes("certificaciones ecológicas")) {
    return "natural";
  }
  
  // Parqueo
  if (t.includes("parqueo") || t.includes("estacionamiento") || t.includes("parking")) {
    return "parque";
  }
  
  // Full-day
  if (t.includes("rutas turísticas se pueden completar") || t.includes("full-day") || 
      t.includes("un solo día") || t.includes("ruta turística optimizada")) {
    return "natural";
  }
  
  // Combinación de atractivos
  if (t.includes("combinación de atractivos") || t.includes("museo + mirador + restaurante")) {
    return "natural";
  }
  
  // Experiencias inmersivas
  if (t.includes("experiencias inmersivas") || t.includes("realidad virtual") || 
      t.includes("talleres interactivos")) {
    return "museo";
  }
  
  // Actividades bajo techo
  if (t.includes("actividades bajo techo") || t.includes("ferias cubiertas")) {
    return "museo";
  }
  
  // ========================================
  // POR DEFECTO
  // ========================================
  return texto;
}

// ============================================
// RENDERIZAR TARJETA CON TODOS LOS BOOLEANOS
// ============================================
function renderCard(item, t) {
  const clase = item.clase || '';
  const color = getColor(clase);
  const claseLabel = clase.replace(/_/g, ' ');
  
  return `
    <article class="result-card" style="--accent:${color}">
      <div class="card-clase">${escapeHtml(claseLabel)}</div>
      <h3 class="card-nombre">${escapeHtml(item.nombre || 'Sin nombre')}</h3>
      <p class="card-tipo">${escapeHtml(item.tipo || '')}</p>
      ${item.ubicacion ? `<p class="card-ubicacion">📍 ${escapeHtml(item.ubicacion)}</p>` : ''}
      ${item.descripcion ? `<p class="card-descripcion">${escapeHtml(item.descripcion)}</p>` : ''}
      <div class="card-meta">
        ${item.gratuito !== undefined && item.gratuito !== null ? 
          `<span class="badge ${item.gratuito ? 'badge--free' : 'badge--paid'}">${item.gratuito ? '🆓 ' + t.free : '💰 ' + t.notFree}</span>` : ''}
        ${item.accesibilidad === true ? `<span class="badge badge--access">♿ ${t.accessible}</span>` : ''}
        ${item.tieneDescuento === true ? `<span class="badge badge--discount" style="background:#fff3cd; color:#856404;">🏷️ ${t.discount}</span>` : ''}
        ${item.requiereReserva === true ? `<span class="badge badge--reserve" style="background:#cce5ff; color:#004085;">📅 ${t.reservation}</span>` : ''}
        ${item.patrimonioNacional === true ? `<span class="badge badge--heritage" style="background:#d4edda; color:#155724;">🏛️ ${t.heritage}</span>` : ''}
        ${item.horario ? `<span class="badge badge--time">⏰ ${escapeHtml(item.horario)}</span>` : ''}
      </div>
      ${item.precioNoche ? `<p class="card-precio">💤 Noche: Bs. ${item.precioNoche}</p>` : ''}
      ${item.precioDia ? `<p class="card-precio">☀️ Día: Bs. ${item.precioDia}</p>` : ''}
      ${item.costoEntrada ? `<p class="card-precio">🎫 Entrada: Bs. ${item.costoEntrada}</p>` : ''}
      ${item.actividades ? `<p class="card-actividades">🎯 ${escapeHtml(item.actividades)}</p>` : ''}
      ${item.ingredientes ? `<p class="card-ingredientes">🍳 ${escapeHtml(item.ingredientes)}</p>` : ''}
    </article>`;
}

// ============================================
// BÚSQUEDA PRINCIPAL
// ============================================
async function doSearch() {
  let q = input.value.trim();
  const t = translations[currentLang];

  if (!q) {
    resultsContainer.innerHTML = "";
    emptyState.style.display = "flex";
    return;
  }

  const terminoBusqueda = traducirPregunta(q);
  
  if (terminoBusqueda !== q) {
    console.log(`🔍 Pregunta: "${q}" → Traducido a: "${terminoBusqueda}"`);
  }

  emptyState.style.display = "none";
  resultsContainer.innerHTML = `<div class="loading">🔍 ${t.loading}</div>`;

  try {
    const response = await fetch(`${BASE_URL}?q=${encodeURIComponent(terminoBusqueda)}`, {
      headers: { 'Accept': 'application/rdf+xml' }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const owlText = await response.text();
    const resultados = parseOWLToJSON(owlText);
    
    console.log(`✅ "${terminoBusqueda}" → ${resultados.length} resultados`);

    if (resultados.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <p>${t.noResults} «${escapeHtml(q)}»</p>
          <p>${t.try}</p>
        </div>`;
      return;
    }

    resultsContainer.innerHTML = resultados.map(item => renderCard(item, t)).join('');
    resultsContainer.querySelectorAll('.result-card').forEach((card, i) => {
      card.style.animationDelay = `${i * 60}ms`;
      card.classList.add('card-enter');
    });

  } catch (error) {
    console.error("❌ Error:", error);
    resultsContainer.innerHTML = `<div class="no-results">❌ Error de conexión. ¿Servidor corriendo?</div>`;
  }
}

// ============================================
// EVENT LISTENERS
// ============================================
btn.addEventListener("click", doSearch);
input.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

// Chips de búsqueda rápida
const chips = document.querySelectorAll(".chip");
if (chips.length > 0) {
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const query = chip.getAttribute("data-query");
      input.value = query;
      doSearch();
      document.querySelector(".results-section")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

// Cambio de idioma
document.querySelectorAll(".lang-btn").forEach(lb => {
  lb.addEventListener("click", () => {
    document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
    lb.classList.add("active");
    currentLang = lb.dataset.lang;
    const t = translations[currentLang];
    input.placeholder = t.placeholder;
    btn.textContent = t.search;
    if (input.value.trim()) doSearch();
  });
});

// Inicialización
const t0 = translations.es;
input.placeholder = t0.placeholder;
btn.textContent = t0.search;

console.log("✅ Buscador semántico OWL listo");
console.log(`📝 Preguntas oficiales soportadas: ${PREGUNTAS_OFICIALES.length} (ES + EN)`);
console.log("🔗 Formato: OWL → procesado en frontend sin JSON");