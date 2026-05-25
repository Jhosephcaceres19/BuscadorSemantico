// backend/src/ontology.js
// Motor semántico con rdflib.js - Soporta OWL/RDF-XML
// Lee ontología OWL y responde consultas SPARQL-like

const fs = require("fs");
const path = require("path");
const $rdf = require("rdflib");

// Namespaces
const BASE = "http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const OWL = "http://www.w3.org/2002/07/owl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

let store = null;
let loaded = false;

const NamedNode = $rdf.NamedNode;

// ── Cargar ontología OWL ─────────────────────────────────
function cargarOntologia() {
  if (loaded) return;

  const owlPath = path.join(__dirname, "../data/TurismoLocal.owl");

  if (!fs.existsSync(owlPath)) {
    console.error(`❌ Archivo OWL no encontrado: ${owlPath}`);
    process.exit(1);
  }

  const contenido = fs.readFileSync(owlPath, "utf-8");
  store = $rdf.graph();

  try {
    $rdf.parse(contenido, store, owlPath, "application/rdf+xml");
    console.log(`✅ Grafo RDF cargado: ${store.statements.length} triples desde TurismoLocal.owl (RDF/XML OWL)`);
  } catch (err) {
    console.error("❌ Error al parsear RDF/XML:", err.message);
    process.exit(1);
  }

  loaded = true;
}

// ── Obtener propiedades de un recurso ─────────────────────
function obtenerPropiedades(uriNode) {
  const statements = store.statementsMatching(uriNode, null, null);
  const props = {};

  statements.forEach(st => {
    const pred = st.predicate.value;
    const obj = st.object;

    if (obj.termType === "Literal") {
      props[pred] = obj.value;
    } else if (pred === RDF + "type") {
      if (!props._tipos) props._tipos = [];
      props._tipos.push(obj.value);
    } else {
      if (!props._referencias) props._referencias = {};
      if (!props._referencias[pred]) props._referencias[pred] = [];
      props._referencias[pred].push(obj.value);
    }
  });
  return props;
}

// ── Búsqueda semántica ───────────────────────────────────
function buscar(q) {
  if (!loaded) cargarOntologia();

  const termino = q.trim().toLowerCase();
  if (!termino) return [];

  const resultados = [];

  // Obtener todos los individuos
  const individuos = store.statementsMatching(
    null,
    NamedNode(RDF + "type"),
    NamedNode(OWL + "NamedIndividual")
  );

  for (const st of individuos) {
    const individuo = st.subject;
    const props = obtenerPropiedades(individuo);

    let coincide = false;

    // Búsqueda por nombre
    if (props[BASE + "Nombre"] && props[BASE + "Nombre"].toLowerCase().includes(termino))
      coincide = true;

    // Búsqueda por descripción
    if (!coincide && props[BASE + "Descripcion"] && props[BASE + "Descripcion"].toLowerCase().includes(termino))
      coincide = true;

    // Búsqueda por ubicación
    if (!coincide && props[BASE + "Ubicacion"] && props[BASE + "Ubicacion"].toLowerCase().includes(termino))
      coincide = true;

    // Búsqueda por tipos específicos
    const tiposBusqueda = [
      BASE + "Tipo_Atractivo", BASE + "Tipo_Hospedaje", BASE + "Tipo_Establecimiento",
      BASE + "Tipo_Evento", BASE + "Tipo_Transporte", BASE + "Tipo_Producto",
      BASE + "Tipo_Recreacion", BASE + "Tipo_Ecosistema", BASE + "Tipo_Patrimonio"
    ];

    for (const tipoProp of tiposBusqueda) {
      if (!coincide && props[tipoProp] && props[tipoProp].toLowerCase().includes(termino)) {
        coincide = true;
        break;
      }
    }

    // Búsqueda por clase RDF
    if (!coincide && props._tipos) {
      for (const tipo of props._tipos) {
        const local = tipo.split("#").pop();
        if (local.toLowerCase().includes(termino)) {
          coincide = true;
          break;
        }
      }
    }

    if (coincide) {
      resultados.push({
        id: individuo.value,
        propiedades: props
      });
    }
  }

  return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
}

// ── Normalizar entidad a formato amigable ─────────────────
function normalizarEntidad(uri, props) {
  const localName = (iri) => {
    const idx = iri.lastIndexOf("#");
    return idx >= 0 ? decodeURIComponent(iri.slice(idx + 1)).replace(/_/g, " ") : iri;
  };

  let clasePrincipal = "Entidad_Turistica";
  if (props._tipos) {
    for (const tipo of props._tipos) {
      if (tipo.startsWith(BASE) && !tipo.includes("NamedIndividual")) {
        clasePrincipal = localName(tipo).replace(/ /g, "_");
        break;
      }
    }
  }

  let horario = null;
  if (props[BASE + "Horario_Apertura"] && props[BASE + "Horario_Cierra"])
    horario = `${props[BASE + "Horario_Apertura"]}–${props[BASE + "Horario_Cierra"]}`;
  else if (props[BASE + "Horario_Atencion"])
    horario = props[BASE + "Horario_Atencion"];
  else if (props[BASE + "Horario_Servicio"])
    horario = props[BASE + "Horario_Servicio"];
  else if (props[BASE + "Horario_Especial"])
    horario = props[BASE + "Horario_Especial"];
  else if (props[BASE + "Fecha_Inicio"] && props[BASE + "Fecha_Fin"])
    horario = `${props[BASE + "Fecha_Inicio"]} – ${props[BASE + "Fecha_Fin"]}`;

  let gratuito = null;
  if (props[BASE + "Gratuito"] !== undefined)
    gratuito = props[BASE + "Gratuito"] === "true";
  else if (props[BASE + "Costo_Entrada"] !== undefined)
    gratuito = parseFloat(props[BASE + "Costo_Entrada"]) === 0;

  return {
    nombre: props[BASE + "Nombre"] || localName(uri),
    clase: clasePrincipal,
    tipo: props[BASE + "Tipo_Atractivo"] ||
          props[BASE + "Tipo_Hospedaje"] ||
          props[BASE + "Tipo_Establecimiento"] ||
          props[BASE + "Tipo_Evento"] ||
          props[BASE + "Tipo_Transporte"] ||
          props[BASE + "Tipo_Producto"] ||
          props[BASE + "Tipo_Recreacion"] ||
          props[BASE + "Tipo_Ecosistema"] ||
          props[BASE + "Tipo_Patrimonio"] ||
          clasePrincipal.replace(/_/g, " "),
    descripcion: props[BASE + "Descripcion"] || null,
    ubicacion: props[BASE + "Ubicacion"] || null,
    horario,
    gratuito,
    accesibilidad: props[BASE + "Accesibilidad"] === "true" ? true : props[BASE + "Accesibilidad"] === "false" ? false : null,
    precioNoche: props[BASE + "Precio_Noche"] ? parseFloat(props[BASE + "Precio_Noche"]) : null,
    precioDia: props[BASE + "Precio_Dia"] ? parseFloat(props[BASE + "Precio_Dia"]) : null,
    costoEntrada: props[BASE + "Costo_Entrada"] ? parseFloat(props[BASE + "Costo_Entrada"]) : null,
    actividades: props[BASE + "Actividades"] || null,
    ingredientes: props[BASE + "Ingredientes"] || null,
    referencias: props._referencias || {}
  };
}

// ── Serializar a OWL/RDF-XML ──────────────────────────────
function serializarAOWL(entidades, termino) {
  let owl = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  
  <!-- Metadatos de la consulta -->
  <owl:NamedIndividual rdf:about="#Consulta_${Date.now()}">
    <rdf:type rdf:resource="#ResultadoConsulta"/>
    <terminoBusqueda>${escapeXml(termino)}</terminoBusqueda>
    <totalResultados rdf:datatype="xsd:integer">${entidades.length}</totalResultados>
    <fechaConsulta rdf:datatype="xsd:dateTime">${new Date().toISOString()}</fechaConsulta>
  </owl:NamedIndividual>`;

  entidades.forEach((entidad, index) => {
    owl += `
  
  <owl:NamedIndividual rdf:about="#Resultado_${index}_${Date.now()}">
    <rdf:type rdf:resource="#ResultadoBusqueda"/>`;
    
    if (entidad.nombre) 
      owl += `\n    <nombre>${escapeXml(entidad.nombre)}</nombre>`;
    if (entidad.clase) 
      owl += `\n    <clase>${escapeXml(entidad.clase)}</clase>`;
    if (entidad.tipo) 
      owl += `\n    <tipo>${escapeXml(entidad.tipo)}</tipo>`;
    if (entidad.descripcion) 
      owl += `\n    <descripcion>${escapeXml(entidad.descripcion)}</descripcion>`;
    if (entidad.ubicacion) 
      owl += `\n    <ubicacion>${escapeXml(entidad.ubicacion)}</ubicacion>`;
    if (entidad.horario) 
      owl += `\n    <horario>${escapeXml(entidad.horario)}</horario>`;
    if (entidad.gratuito !== null) 
      owl += `\n    <gratuito rdf:datatype="xsd:boolean">${entidad.gratuito}</gratuito>`;
    if (entidad.accesibilidad !== null) 
      owl += `\n    <accesibilidad rdf:datatype="xsd:boolean">${entidad.accesibilidad}</accesibilidad>`;
    if (entidad.precioNoche !== null) 
      owl += `\n    <precioNoche rdf:datatype="xsd:float">${entidad.precioNoche}</precioNoche>`;
    if (entidad.precioDia !== null) 
      owl += `\n    <precioDia rdf:datatype="xsd:float">${entidad.precioDia}</precioDia>`;
    if (entidad.costoEntrada !== null) 
      owl += `\n    <costoEntrada rdf:datatype="xsd:float">${entidad.costoEntrada}</costoEntrada>`;
    if (entidad.actividades) 
      owl += `\n    <actividades>${escapeXml(entidad.actividades)}</actividades>`;
    if (entidad.ingredientes) 
      owl += `\n    <ingredientes>${escapeXml(entidad.ingredientes)}</ingredientes>`;
    
    owl += `\n  </owl:NamedIndividual>`;
  });

  owl += `\n</rdf:RDF>`;
  return owl;
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Cargar al inicio
cargarOntologia();

module.exports = {
  buscar,
  serializarAOWL
};