// frontend/script.js
// Buscador Semántico - Turismo Cochabamba
// Versión Turtle: procesa respuestas RDF del backend semántico

const BASE_URL = "http://localhost:3000/api/search";

// ── Traducciones de interfaz ──
const translations = {
  es: { search: "Buscar", placeholder: "Ej: ¿Qué lugares son gratuitos?, museos, hoteles...", free: "Gratuito", notFree: "Con costo", accessible: "Accesible", schedule: "Horario", noResults: "Sin resultados para", try: "Intenta con otro término.", loading: "Buscando..." },
  en: { search: "Search", placeholder: "E.g.: free places, museums, hotels...", free: "Free", notFree: "Paid", accessible: "Accessible", schedule: "Schedule", noResults: "No results for", try: "Try another term.", loading: "Searching..." },
  qu: { search: "Mask'ay", placeholder: "Ej: mana qullqi, museo, hotel...", free: "Qullqi mana", notFree: "Qullqiwan", accessible: "Yaykuna atikuq", schedule: "Pacha", noResults: "Mana tarikuchu:", try: "Waq simiwan mask'ay.", loading: "Mask'ay..." }
};

let currentLang = "es";

const input = document.getElementById("searchInput");
const btn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("resultados");
const emptyState = document.getElementById("emptyState");

// ── Colores por clase ──
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
// PARSER TURTLE → JSON (sin dependencias externas)
// ============================================
function parseTurtleToJSON(turtleText) {
  const resultados = [];
  const lines = turtleText.split('\n');
  let currentEntity = null;
  let currentProperty = null;
  let bufferValue = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Ignorar líneas de prefijos y comentarios
    if (line.startsWith('@prefix') || line.startsWith('#') || line === '') {
      continue;
    }
    
    // Detectar entidades de resultado
    const resultMatch = line.match(/:resultado_(\d+)\s+rdf:type\s+:ResultadoBusqueda\s*;?/);
    if (resultMatch) {
      if (currentEntity) {
        resultados.push(currentEntity);
      }
      currentEntity = {
        id: resultMatch[1]
      };
      continue;
    }
    
    // Detectar metadatos de consulta
    const queryMatch = line.match(/:terminoBusqueda\s+"([^"]+)"/);
    if (queryMatch && currentEntity === null) {
      // Es metadato, ignorar por ahora
      continue;
    }
    
    if (currentEntity) {
      // Procesar propiedad con valor multilínea (""")
      if (currentProperty && (line.endsWith(';') || line.endsWith('.'))) {
        // Fin del valor multilínea
        bufferValue += ' ' + line.replace(/"""/g, '').replace(/[;.]$/, '').trim();
        currentEntity[currentProperty] = bufferValue.trim();
        currentProperty = null;
        bufferValue = '';
        continue;
      }
      
      if (currentProperty) {
        // Continuar acumulando valor multilínea
        bufferValue += ' ' + line.replace(/"""/g, '');
        continue;
      }
      
      // Detectar propiedad con valor normal
      const propMatch = line.match(/:(\w+)\s+(.+?)\s*([.;])$/);
      if (propMatch) {
        const propName = propMatch[1];
        let value = propMatch[2].trim();
        const endChar = propMatch[3];
        
        // Detectar valor multilínea
        if (value.startsWith('"""') && !value.endsWith('"""')) {
          currentProperty = propName;
          bufferValue = value.replace(/"""/g, '');
          continue;
        }
        
        // Limpiar valor
        value = value
          .replace(/"""/g, '')
          .replace(/"(\^\^[^"]+)?/g, (match, type) => type || '')
          .replace(/;$/, '')
          .trim();
        
        // Convertir tipos
        if (value === 'true' || value === 'false') {
          value = value === 'true';
        } else if (!isNaN(value) && value !== '') {
          value = parseFloat(value);
        }
        
        currentEntity[propName] = value;
        
        // Si termina con punto, la entidad está completa
        if (endChar === '.' && propName === 'uri') {
          resultados.push(currentEntity);
          currentEntity = null;
        }
      }
    }
  }
  
  // Agregar última entidad si existe
  if (currentEntity) {
    resultados.push(currentEntity);
  }
  
  return resultados;
}

// ============================================
// TRADUCTOR DE PREGUNTAS
// ============================================
function traducirPregunta(texto) {
  const t = texto.toLowerCase().trim();
  
  // 1. GRATUITOS
  if (t.includes("gratuito") || t.includes("gratuitos") || t.includes("gratis") || 
      t.includes("sin costo") || t.includes("entrada libre")) {
    return "true";
  }
  
  // 2. MUSEOS
  if (t.includes("museo") || t.includes("museos")) {
    return "museo";
  }
  
  // 3. HOTELES / HOSPEDAJE
  if (t.includes("hotel") || t.includes("hoteles") || t.includes("hospedaje") || 
      t.includes("alojamiento") || t.includes("dónde dormir")) {
    return "hospedaje";
  }
  
  // 4. RESTAURANTES
  if (t.includes("restaurante") || t.includes("restaurantes") || t.includes("dónde comer") || 
      t.includes("almorzar") || t.includes("cenar") || t.includes("comer fuera")) {
    return "restaurante";
  }
  
  // 5. PLATOS TÍPICOS / GASTRONOMÍA
  if ((t.includes("plato") || t.includes("comida típica") || t.includes("gastronomía") || 
       t.includes("qué comer") || t.includes("especialidad") || t.includes("típico")) && 
       !t.includes("restaurante") && !t.includes("dónde comer")) {
    return "gastronomía";
  }
  
  // 6. PARQUES / NATURALES
  if (t.includes("parque") || t.includes("parques") || t.includes("natural") || t.includes("naturaleza")) {
    return "natural";
  }
  
  // 7. ACCESIBILIDAD
  if (t.includes("accesible") || t.includes("silla de ruedas") || t.includes("rampa") || 
      t.includes("discapacidad") || t.includes("accesibilidad")) {
    return "accesible";
  }
  
  // 8. TRANSPORTE
  if (t.includes("transporte") || t.includes("bus") || t.includes("taxi") || 
      t.includes("teleférico") || t.includes("cómo llegar")) {
    return "transporte";
  }
  
  // 9. EVENTOS / FESTIVIDADES
  if (t.includes("evento") || t.includes("eventos") || t.includes("festividad") || 
      t.includes("feria") || t.includes("celebración")) {
    return "evento";
  }
  
  // 10. IGLESIAS
  if (t.includes("iglesia") || t.includes("iglesias") || t.includes("catedral") || 
      t.includes("templo") || t.includes("religioso")) {
    return "iglesia";
  }
  
  // 11. LUGARES HISTÓRICOS
  if (t.includes("histórico") || t.includes("históricos") || t.includes("monumento") || 
      t.includes("patrimonio")) {
    return "histórico";
  }
  
  // 12. SENDERISMO
  if (t.includes("senderismo") || t.includes("trekking") || t.includes("caminata")) {
    return "senderismo";
  }
  
  // 13. LAGUNAS
  if (t.includes("laguna") || t.includes("lago") || t.includes("río")) {
    return "laguna";
  }
  
  // 14. MIRADORES
  if (t.includes("mirador") || t.includes("vista") || t.includes("panorámico")) {
    return "mirador";
  }
  
  // Si no hay coincidencia, devolver el texto original
  return texto;
}

// ── Renderizar una tarjeta con datos reales ──
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
          `<span class="badge ${item.gratuito ? 'badge--free' : 'badge--paid'}">${item.gratuito ? t.free : t.notFree}</span>` : ''}
        ${item.accesibilidad === true ? `<span class="badge badge--access">♿ ${t.accessible}</span>` : ''}
        ${item.horario ? `<span class="badge badge--time">⏰ ${escapeHtml(item.horario)}</span>` : ''}
      </div>
      ${item.precioNoche ? `<p class="card-precio">💤 Noche: Bs. ${item.precioNoche}</p>` : ''}
      ${item.precioDia ? `<p class="card-precio">☀️ Día: Bs. ${item.precioDia}</p>` : ''}
      ${item.costoEntrada ? `<p class="card-precio">🎫 Entrada: Bs. ${item.costoEntrada}</p>` : ''}
      ${item.actividades ? `<p class="card-actividades">🎯 ${escapeHtml(item.actividades)}</p>` : ''}
      ${item.ingredientes ? `<p class="card-ingredientes">🍳 ${escapeHtml(item.ingredientes)}</p>` : ''}
    </article>`;
}

// ── Búsqueda real contra el backend (Turtle) ──
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
      headers: {
        'Accept': 'text/turtle'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    // Obtener respuesta como texto Turtle
    const turtleText = await response.text();
    console.log('📄 Respuesta Turtle recibida:', turtleText.substring(0, 200) + '...');
    
    // Parsear Turtle a objetos utilizables
    const resultados = parseTurtleToJSON(turtleText);
    console.log('✅ Resultados parseados:', resultados.length);

    if (resultados.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <span>${t.noResults} "<strong>${escapeHtml(q)}</strong>".</span>
          <span>${t.try}</span>
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
    resultsContainer.innerHTML = `
      <div class="no-results">
        ❌ Error de conexión. ¿Servidor corriendo?
        <br><small>${escapeHtml(error.message)}</small>
      </div>`;
  }
}

// ── Event Listeners ──
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

console.log("✅ Buscador semántico Turtle listo");
console.log("📝 Preguntas soportadas: gratuitos, museos, hoteles, restaurantes, platos típicos, parques, accesibilidad, transporte, eventos");
console.log("🔗 Formato: Turtle/RDF → procesado en frontend sin JSON");