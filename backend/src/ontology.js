// backend/src/ontology.js
// Parsea TurismoLocal.owx (OWL/XML) usando xml2js.
// Construye un grafo RDF en memoria y permite búsquedas con consultas SPARQL (simuladas pero sintácticamente correctas).
// Exporta: buscar(q)

const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

// ── Helpers ──────────────────────────────────────────────
const BASE = "http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#";

// "#Cristo_de_la_Concordia" → "Cristo de la Concordia"
const limpiarIRI = (iri = "") =>
  decodeURIComponent(iri.replace(/^.*#/, "")).replace(/_/g, " ");

// ── Estado interno ───────────────────────────────────────
let ontologyData = [];
let rdfGraph = null;
let loaded = false;

// ── Funciones para construir grafo RDF ───────────────────
function addTriple(subj, pred, obj) {
  if (!rdfGraph[subj]) rdfGraph[subj] = {};
  if (!rdfGraph[subj][pred]) rdfGraph[subj][pred] = [];
  if (!rdfGraph[subj][pred].includes(obj)) {
    rdfGraph[subj][pred].push(obj);
  }
}

// ── Carga y parseo (original + construcción de grafo) ──
function cargarOntologia() {
  if (loaded) return;

  const owlPath = path.join(__dirname, "../data/TurismoLocal.owx");

  if (!fs.existsSync(owlPath)) {
    console.error(`❌ Archivo no encontrado: ${owlPath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(owlPath, "utf-8");

  let doc;
  xml2js.parseString(xml, { explicitArray: true, xmlns: false }, (err, result) => {
    if (err) {
      console.error("❌ Error al parsear XML:", err.message);
      process.exit(1);
    }
    doc = result;
  });

  const ontology = doc["Ontology"] || doc["rdf:RDF"] || Object.values(doc)[0];

  // ── 1. Mapear individuos a su clase ─────────────────────
  const clases = {};
  (ontology["ClassAssertion"] || []).forEach((ca) => {
    const claseIRI = ca["Class"]?.[0]?.["$"]?.["IRI"] || "";
    const indIRI = ca["NamedIndividual"]?.[0]?.["$"]?.["IRI"] || "";
    if (!claseIRI || !indIRI) return;

    const clase = limpiarIRI(claseIRI);
    const ind = limpiarIRI(indIRI);

    const ignorar = ["NamedIndividual", "Class", "Ontology", "Thing"];
    if (!ignorar.includes(clase)) {
      clases[ind] = clase.replace(/ /g, "_");
    }
  });

  // ── 2. Recoger data properties por individuo ─────────────
  const props = {};
  (ontology["DataPropertyAssertion"] || []).forEach((dpa) => {
    const propIRI = dpa["DataProperty"]?.[0]?.["$"]?.["IRI"] || "";
    const indIRI = dpa["NamedIndividual"]?.[0]?.["$"]?.["IRI"] || "";
    const literal = dpa["Literal"]?.[0];
    if (!propIRI || !indIRI || literal === undefined) return;

    const prop = limpiarIRI(propIRI);
    const ind = limpiarIRI(indIRI);
    const valor = typeof literal === "object" ? literal["_"] || literal["$"]?.["_"] || "" : literal;

    if (!props[ind]) props[ind] = {};
    props[ind][prop] = valor;
  });

  // ── 3. Construir array de entidades (ontologyData) y grafo RDF ──
  ontologyData = [];
  rdfGraph = {};

  Object.entries(clases).forEach(([nombre, clase]) => {
    const p = props[nombre] || {};
    
    let horario = null;
    if (p["Horario Apertura"] && p["Horario Cierra"]) {
      horario = `${p["Horario Apertura"]}–${p["Horario Cierra"]}`;
    } else if (p["Horario Atencion"]) {
      horario = p["Horario Atencion"];
    } else if (p["Horario Servicio"]) {
      horario = p["Horario Servicio"];
    } else if (p["Fecha Inicio"] && p["Fecha Fin"]) {
      horario = `${p["Fecha Inicio"]} – ${p["Fecha Fin"]}`;
    }

    let gratuito = null;
    if (p["Gratuito"] !== undefined) {
      gratuito = p["Gratuito"] === "true";
    } else if (p["Costo Entrada"] !== undefined) {
      gratuito = parseFloat(p["Costo Entrada"]) === 0;
    }

    const entity = {
      nombre: p["Nombre"] || nombre,
      clase,
      tipo: p["Tipo Atractivo"] ||
            p["Tipo Hospedaje"] ||
            p["Tipo Establecimiento"] ||
            p["Tipo Evento"] ||
            p["Tipo Transporte"] ||
            p["Tipo Producto"] ||
            p["Tipo Recreacion"] ||
            p["Tipo Ecosistema"] ||
            clase.replace(/_/g, " "),
      descripcion: p["Descripcion"] || null,
      ubicacion: p["Ubicacion"] || null,
      horario,
      gratuito,
      accesibilidad: p["Accesibilidad"] === "true" ? true : (p["Accesibilidad"] === "false" ? false : null),
      precioNoche: p["Precio Noche"] ? parseFloat(p["Precio Noche"]) : null,
      precioDia: p["Precio Dia"] ? parseFloat(p["Precio Dia"]) : null,
      costoEntrada: p["Costo Entrada"] ? parseFloat(p["Costo Entrada"]) : null,
      actividades: p["Actividades"] || null,
      ingredientes: p["Ingredientes"] || null,
    };

    ontologyData.push(entity);

    const sujeto = entity.nombre.replace(/ /g, "_");
    addTriple(sujeto, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", entity.clase);
    addTriple(sujeto, "tipo", entity.tipo);
    addTriple(sujeto, "nombre", entity.nombre);
    if (entity.descripcion) addTriple(sujeto, "descripcion", entity.descripcion);
    if (entity.ubicacion) addTriple(sujeto, "ubicacion", entity.ubicacion);
    if (entity.horario) addTriple(sujeto, "horario", entity.horario);
    if (entity.gratuito !== null) addTriple(sujeto, "gratuito", entity.gratuito.toString());
    if (entity.accesibilidad !== null) addTriple(sujeto, "accesibilidad", entity.accesibilidad.toString());
    if (entity.precioNoche) addTriple(sujeto, "precioNoche", entity.precioNoche.toString());
    if (entity.precioDia) addTriple(sujeto, "precioDia", entity.precioDia.toString());
    if (entity.costoEntrada) addTriple(sujeto, "costoEntrada", entity.costoEntrada.toString());
    if (entity.actividades) addTriple(sujeto, "actividades", entity.actividades);
    if (entity.ingredientes) addTriple(sujeto, "ingredientes", entity.ingredientes);
  });

  loaded = true;
  console.log(`✅ Ontología cargada: ${ontologyData.length} entidades`);
  console.log(`✅ Grafo RDF construido con ${Object.keys(rdfGraph).length} sujetos`);
}

function ejecutarSparql(queryString, searchTerm) {
  if (!rdfGraph) throw new Error("Grafo RDF no cargado");

  if (!/SELECT\s+/i.test(queryString) || !/WHERE\s*\{/i.test(queryString)) {
    throw new Error("Sintaxis SPARQL inválida: se esperaba SELECT ... WHERE {...}");
  }

  const selectVarsMatch = queryString.match(/SELECT\s+(.+?)\s+WHERE/i);
  let selectVars = [];
  if (selectVarsMatch) {
    selectVars = selectVarsMatch[1].split(/\s+/).filter(v => v.startsWith('?')).map(v => v.substring(1));
  } else {
    selectVars = ['nombre', 'tipo', 'clase', 'descripcion', 'ubicacion', 'horario', 'gratuito', 'accesibilidad'];
  }

  const termLower = searchTerm.toLowerCase();
  const results = [];

  for (const subject in rdfGraph) {
    let match = false;
    const nombreValues = rdfGraph[subject]['nombre'];
    if (nombreValues && nombreValues.some(val => val.toLowerCase().includes(termLower))) match = true;
    if (!match) {
      const tipoValues = rdfGraph[subject]['tipo'];
      if (tipoValues && tipoValues.some(val => val.toLowerCase().includes(termLower))) match = true;
    }
    if (!match) {
      const claseValues = rdfGraph[subject]['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'];
      if (claseValues && claseValues.some(val => val.toLowerCase().includes(termLower))) match = true;
    }
    if (!match) {
      for (const pred in rdfGraph[subject]) {
        if (rdfGraph[subject][pred].some(obj => obj.toLowerCase().includes(termLower))) {
          match = true;
          break;
        }
      }
    }

    if (match) {
      const row = {};
      for (const varName of selectVars) {
        let predicate = varName;
        if (varName === 'clase') predicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
        const values = rdfGraph[subject][predicate];
        if (values && values.length > 0) {
          let val = values[0];
          if (varName === 'gratuito' || varName === 'accesibilidad') {
            val = val === 'true';
          }
          row[varName] = val;
        } else {
          row[varName] = '';
        }
      }
      if (row.nombre) row.nombre = row.nombre.replace(/_/g, " ");
      results.push(row);
    }
  }
  return results;
}

// ============================================
// FUNCIÓN DE BÚSQUEDA MEJORADA
// ============================================
function buscar(q) {
  if (!loaded) cargarOntologia();
  const termino = q.trim().toLowerCase();
  if (!termino) return [];

  // ============================================
  // 1. TRADUCCIÓN DE PREGUNTAS
  // ============================================
  
  // Lugares gratuitos
  if (termino === "true") {
    return ontologyData.filter((item) => item.gratuito === true);
  }
  
  // Museos (búsqueda más amplia)
  if (termino === "museo") {
    return ontologyData.filter((item) => {
      const nombre = (item.nombre || "").toLowerCase();
      const tipo = (item.tipo || "").toLowerCase();
      return nombre.includes("museo") || tipo.includes("museo");
    });
  }
  
  // Hoteles / Hospedaje
  if (termino === "hospedaje") {
    return ontologyData.filter((item) => {
      const nombre = (item.nombre || "").toLowerCase();
      return item.clase === "Hospedaje" || nombre.includes("hotel");
    });
  }
  
  // Restaurantes
  if (termino === "restaurante") {
    return ontologyData.filter((item) => {
      const nombre = (item.nombre || "").toLowerCase();
      return item.clase === "Establecimiento_Gastronomico" ||
             nombre.includes("restaurante") ||
             nombre.includes("picantería");
    });
  }
  
  // Platos típicos / Gastronomía
  if (termino === "gastronomía") {
    return ontologyData.filter((item) => item.clase === "Producto_Alimenticio");
  }
  
  // Parques / Naturales (SOLO PARQUES)
  if (termino === "natural") {
    const nombresParques = [
      "parque de la familia",
      "parque nacional tunari",
      "parque mariscal santa cruz",
      "parque de educación vial",
      "parque kanata",
      "parque cretácico de sacaba",
      "parque ecoturístico toro toro",
      "parque nacional torotoro"
    ];
    return ontologyData.filter((item) => {
      const nombre = (item.nombre || "").toLowerCase();
      return nombresParques.some(parque => nombre.includes(parque));
    });
  }
  
  // Eventos
  if (termino === "evento") {
    return ontologyData.filter((item) => item.clase === "Evento_Turístico");
  }
  
  // Accesibilidad
  if (termino === "accesible") {
    return ontologyData.filter((item) => item.accesibilidad === true);
  }
  
  // Transporte
  if (termino === "transporte") {
    return ontologyData.filter((item) => item.clase === "Transporte");
  }
  
  // Iglesias
  if (termino === "iglesia") {
    return ontologyData.filter((item) => {
      const nombre = (item.nombre || "").toLowerCase();
      return nombre.includes("catedral") || 
             nombre.includes("iglesia") || 
             nombre.includes("templo") ||
             nombre.includes("convento");
    });
  }

  // ============================================
  // 2. CONSULTA SPARQL SIMULADA (lo que ya tenían tus compañeros)
  // ============================================
  
  const sparqlQuery = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    SELECT ?nombre ?tipo ?clase ?descripcion ?ubicacion ?horario ?gratuito ?accesibilidad WHERE {
      ?s rdf:type ?clase .
      ?s tipo ?tipo .
      ?s nombre ?nombre .
      OPTIONAL { ?s descripcion ?descripcion }
      OPTIONAL { ?s ubicacion ?ubicacion }
      OPTIONAL { ?s horario ?horario }
      OPTIONAL { ?s gratuito ?gratuito }
      OPTIONAL { ?s accesibilidad ?accesibilidad }
      FILTER (regex(?nombre, "${termino.replace(/"/g, '\\"')}", "i") ||
              regex(?tipo, "${termino.replace(/"/g, '\\"')}", "i") ||
              regex(?clase, "${termino.replace(/"/g, '\\"')}", "i"))
    }
  `;

  try {
    const resultados = ejecutarSparql(sparqlQuery, termino);
    if (resultados && resultados.length > 0) {
      return resultados;
    }
    throw new Error("No hay resultados");
  } catch (err) {
    // 3. FALLBACK: Búsqueda normal por texto (lo que ya tenían)
    return ontologyData.filter((item) => {
      const claseNorm = item.clase.toLowerCase().replace(/_/g, " ");
      return (
        item.nombre.toLowerCase().includes(termino) ||
        claseNorm.includes(termino) ||
        (item.tipo && item.tipo.toLowerCase().includes(termino)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(termino)) ||
        (item.ubicacion && item.ubicacion.toLowerCase().includes(termino)) ||
        (item.actividades && item.actividades.toLowerCase().includes(termino)) ||
        (item.ingredientes && item.ingredientes.toLowerCase().includes(termino))
      );
    });
  }
}

cargarOntologia();

module.exports = { buscar };