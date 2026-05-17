// backend/src/ontology.js
// Parsea TurismoLocal.owx (OWL/XML) usando xml2js — sin Fuseki, sin Java.
// Exporta: buscar(q)

const fs      = require("fs");
const path    = require("path");
const xml2js  = require("xml2js");

// ── Helpers ──────────────────────────────────────────────
const BASE = "http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#";

// "#Cristo_de_la_Concordia" → "Cristo de la Concordia"
const limpiarIRI = (iri = "") =>
  decodeURIComponent(iri.replace(/^.*#/, "")).replace(/_/g, " ");

// ── Estado interno ───────────────────────────────────────
let ontologyData = [];
let loaded       = false;

// ── Carga y parseo ───────────────────────────────────────
function cargarOntologia() {
  if (loaded) return;

  const owlPath = path.join(__dirname, "../data/TurismoLocal.owx");

  if (!fs.existsSync(owlPath)) {
    console.error(`❌ Archivo no encontrado: ${owlPath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(owlPath, "utf-8");

  // Parseo síncrono con xml2js
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
  const clases = {};  // "Cristo de la Concordia" → "Atractivo_Recreativo"

  (ontology["ClassAssertion"] || []).forEach((ca) => {
    const claseIRI = ca["Class"]?.[0]?.["$"]?.["IRI"] || "";
    const indIRI   = ca["NamedIndividual"]?.[0]?.["$"]?.["IRI"] || "";
    if (!claseIRI || !indIRI) return;

    const clase = limpiarIRI(claseIRI);
    const ind   = limpiarIRI(indIRI);

    // Ignorar clases meta de OWL
    const ignorar = ["NamedIndividual","Class","Ontology","Thing"];
    if (!ignorar.includes(clase)) {
      clases[ind] = clase.replace(/ /g, "_");
    }
  });

  // ── 2. Recoger data properties por individuo ─────────────
  const props = {};  // "Cristo de la Concordia" → { Nombre: "...", ... }

  (ontology["DataPropertyAssertion"] || []).forEach((dpa) => {
    const propIRI = dpa["DataProperty"]?.[0]?.["$"]?.["IRI"] || "";
    const indIRI  = dpa["NamedIndividual"]?.[0]?.["$"]?.["IRI"] || "";
    const literal = dpa["Literal"]?.[0];
    if (!propIRI || !indIRI || literal === undefined) return;

    const prop  = limpiarIRI(propIRI);
    const ind   = limpiarIRI(indIRI);
    const valor = typeof literal === "object" ? literal["_"] || literal["$"]?.["_"] || "" : literal;

    if (!props[ind]) props[ind] = {};
    props[ind][prop] = valor;
  });

  // ── 3. Construir array de entidades ─────────────────────
  ontologyData = Object.entries(clases).map(([nombre, clase]) => {
    const p = props[nombre] || {};

    // Horario
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

    // Gratuito
    let gratuito = null;
    if (p["Gratuito"] !== undefined) {
      gratuito = p["Gratuito"] === "true";
    } else if (p["Costo Entrada"] !== undefined) {
      gratuito = parseFloat(p["Costo Entrada"]) === 0;
    }

    return {
      nombre:       p["Nombre"]              || nombre,
      clase,
      tipo:         p["Tipo Atractivo"]      ||
                    p["Tipo Hospedaje"]      ||
                    p["Tipo Establecimiento"]||
                    p["Tipo Evento"]         ||
                    p["Tipo Transporte"]     ||
                    p["Tipo Producto"]       ||
                    p["Tipo Recreacion"]     ||
                    p["Tipo Ecosistema"]     ||
                    clase.replace(/_/g, " "),
      descripcion:  p["Descripcion"]         || null,
      ubicacion:    p["Ubicacion"]            || null,
      horario,
      gratuito,
      accesibilidad: p["Accesibilidad"] === "true"  ? true
                   : p["Accesibilidad"] === "false" ? false
                   : null,
      precioNoche:  p["Precio Noche"]  ? parseFloat(p["Precio Noche"])  : null,
      precioDia:    p["Precio Dia"]    ? parseFloat(p["Precio Dia"])    : null,
      costoEntrada: p["Costo Entrada"] ? parseFloat(p["Costo Entrada"]) : null,
      actividades:  p["Actividades"]   || null,
      ingredientes: p["Ingredientes"]  || null,
    };
  });

  loaded = true;
  console.log(`✅ Ontología cargada: ${ontologyData.length} entidades desde TurismoLocal.owx`);
}

// ── Búsqueda ─────────────────────────────────────────────
function buscar(q) {
  if (!loaded) cargarOntologia();
  const t = q.trim().toLowerCase();
  if (!t) return [];

  return ontologyData.filter((item) => {
    const claseNorm = item.clase.toLowerCase().replace(/_/g, " ");
    return (
      item.nombre.toLowerCase().includes(t)                              ||
      claseNorm.includes(t)                                              ||
      (item.tipo        && item.tipo.toLowerCase().includes(t))         ||
      (item.descripcion && item.descripcion.toLowerCase().includes(t))  ||
      (item.ubicacion   && item.ubicacion.toLowerCase().includes(t))    ||
      (item.actividades && item.actividades.toLowerCase().includes(t))  ||
      (item.ingredientes && item.ingredientes.toLowerCase().includes(t))
    );
  });
}

// Cargar al importar
cargarOntologia();

module.exports = { buscar };