// backend/src/ontology.js
// Motor semántico nativo: Lee TurismoLocal.ttl con N3.Store
// Ejecuta consultas SPARQL-like mediante patrones de tripletas
// Cumple issue #17 - Sin xml2js, sin JSON en las respuestas

const fs   = require("fs");
const path = require("path");
const N3   = require("n3");
const { DataFactory } = N3;
const { namedNode, literal, quad: createQuad } = DataFactory;

// ── Namespaces ───────────────────────────────────────────
const BASE = "http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#";
const RDF  = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const OWL  = "http://www.w3.org/2002/07/owl#";
const XSD  = "http://www.w3.org/2001/XMLSchema#";

// ── Estado interno ───────────────────────────────────────
let store = null;        // N3.Store con todos los triples
let prefixes = {};       // Prefijos del archivo Turtle
let loaded = false;

// ── Utilidades ───────────────────────────────────────────
const localName = (iri = "") => {
  const idx = iri.lastIndexOf("#");
  return idx >= 0
    ? decodeURIComponent(iri.slice(idx + 1)).replace(/_/g, " ")
    : iri;
};

// Clases OWL a ignorar
const CLASES_META = new Set([
  `${OWL}NamedIndividual`,
  `${OWL}Class`,
  `${OWL}Ontology`,
  `${OWL}Thing`,
]);

// ── Carga del archivo Turtle ─────────────────────────────
function cargarOntologia() {
  if (loaded) return;

  const ttlPath = path.join(__dirname, "../data/TurismoLocal.ttl");

  if (!fs.existsSync(ttlPath)) {
    console.error(`❌ Archivo no encontrado: ${ttlPath}`);
    process.exit(1);
  }

  const contenido = fs.readFileSync(ttlPath, "utf-8");
  const parser = new N3.Parser({ format: "Turtle" });
  store = new N3.Store();

  try {
    const quads = parser.parse(contenido);
    store.addQuads(quads);
    console.log(`✅ Grafo RDF cargado: ${store.size} triples desde TurismoLocal.ttl`);
  } catch (err) {
    console.error("❌ Error al parsear Turtle:", err.message);
    process.exit(1);
  }

  loaded = true;
}

// ── Obtener entidad desde el store ──────────────────────
function obtenerEntidad(uri) {
  const quads = store.getQuads(uri, null, null, null);
  if (quads.length === 0) return null;

  const entidad = {
    id: uri.value,
    propiedades: {}
  };

  quads.forEach(quad => {
    const pred = quad.predicate.value;
    const obj = quad.object;

    if (pred === `${RDF}type`) {
      if (!entidad.tipos) entidad.tipos = [];
      entidad.tipos.push(obj.value);
    } else if (N3.Util.isLiteral(obj)) {
      entidad.propiedades[pred] = obj.value;
    } else {
      // Object property - referencia a otra entidad
      if (!entidad.referencias) entidad.referencias = {};
      if (!entidad.referencias[pred]) entidad.referencias[pred] = [];
      entidad.referencias[pred].push(obj.value);
    }
  });

  return entidad;
}

// ── Búsqueda por patrón de tripletas (SPARQL-like) ──────
function buscar(q) {
  if (!loaded) cargarOntologia();

  const termino = q.trim().toLowerCase();
  if (!termino) return [];

  const resultados = new Map(); // Usar Map para evitar duplicados

  // 1. Buscar individuos (owl:NamedIndividual)
  const individuos = store.getQuads(
    null, 
    namedNode(`${RDF}type`), 
    namedNode(`${OWL}NamedIndividual`), 
    null
  );

  // 2. Para cada individuo, verificar si coincide con el término
  for (const quadInd of individuos) {
    const individuo = quadInd.subject;
    const entidad = obtenerEntidad(individuo);
    if (!entidad) continue;

    // Buscar en todas las propiedades de datos
    let coincide = false;
    
    // Verificar nombre
    if (entidad.propiedades[`${BASE}Nombre`] && 
        entidad.propiedades[`${BASE}Nombre`].toLowerCase().includes(termino)) {
      coincide = true;
    }
    
    // Verificar descripción
    if (!coincide && entidad.propiedades[`${BASE}Descripcion`] &&
        entidad.propiedades[`${BASE}Descripcion`].toLowerCase().includes(termino)) {
      coincide = true;
    }
    
    // Verificar ubicación
    if (!coincide && entidad.propiedades[`${BASE}Ubicacion`] &&
        entidad.propiedades[`${BASE}Ubicacion`].toLowerCase().includes(termino)) {
      coincide = true;
    }
    
    // Verificar tipo
    const tiposBusqueda = [
      `${BASE}Tipo_Atractivo`,
      `${BASE}Tipo_Hospedaje`,
      `${BASE}Tipo_Establecimiento`,
      `${BASE}Tipo_Evento`,
      `${BASE}Tipo_Transporte`,
      `${BASE}Tipo_Producto`,
      `${BASE}Tipo_Recreacion`,
      `${BASE}Tipo_Ecosistema`,
      `${BASE}Tipo_Patrimonio`
    ];
    
    for (const tipoProp of tiposBusqueda) {
      if (!coincide && entidad.propiedades[tipoProp] &&
          entidad.propiedades[tipoProp].toLowerCase().includes(termino)) {
        coincide = true;
        break;
      }
    }
    
    // Verificar clase/tipo RDF
    if (!coincide && entidad.tipos) {
      for (const tipo of entidad.tipos) {
        if (tipo.startsWith(BASE) && localName(tipo).toLowerCase().includes(termino)) {
          coincide = true;
          break;
        }
      }
    }

    // Verificar actividades e ingredientes
    if (!coincide && entidad.propiedades[`${BASE}Actividades`] &&
        entidad.propiedades[`${BASE}Actividades`].toLowerCase().includes(termino)) {
      coincide = true;
    }
    
    if (!coincide && entidad.propiedades[`${BASE}Ingredientes`] &&
        entidad.propiedades[`${BASE}Ingredientes`].toLowerCase().includes(termino)) {
      coincide = true;
    }

    if (coincide) {
      resultados.set(individuo.value, entidad);
    }
  }

  // Convertir a array y normalizar
  return Array.from(resultados.values()).map(entidad => 
    normalizarEntidad(entidad)
  );
}

// ── Normalizar entidad a formato amigable ────────────────
function normalizarEntidad(entidad) {
  const props = entidad.propiedades;
  
  // Determinar tipo principal
  let clasePrincipal = "Entidad_Turistica";
  if (entidad.tipos) {
    for (const tipo of entidad.tipos) {
      if (tipo.startsWith(BASE) && !CLASES_META.has(tipo)) {
        clasePrincipal = localName(tipo).replace(/ /g, "_");
        break;
      }
    }
  }

  // Construir horario
  let horario = null;
  if (props[`${BASE}Horario_Apertura`] && props[`${BASE}Horario_Cierra`]) {
    horario = `${props[`${BASE}Horario_Apertura`]}–${props[`${BASE}Horario_Cierra`]}`;
  } else if (props[`${BASE}Horario_Atencion`]) {
    horario = props[`${BASE}Horario_Atencion`];
  } else if (props[`${BASE}Horario_Servicio`]) {
    horario = props[`${BASE}Horario_Servicio`];
  } else if (props[`${BASE}Horario_Especial`]) {
    horario = props[`${BASE}Horario_Especial`];
  } else if (props[`${BASE}Fecha_Inicio`] && props[`${BASE}Fecha_Fin`]) {
    horario = `${props[`${BASE}Fecha_Inicio`]} – ${props[`${BASE}Fecha_Fin`]}`;
  }

  // Determinar gratuidad
  let gratuito = null;
  if (props[`${BASE}Gratuito`] !== undefined) {
    gratuito = props[`${BASE}Gratuito`] === "true";
  } else if (props[`${BASE}Costo_Entrada`] !== undefined) {
    gratuito = parseFloat(props[`${BASE}Costo_Entrada`]) === 0;
  }

  return {
    nombre: props[`${BASE}Nombre`] || localName(entidad.id),
    clase: clasePrincipal,
    tipo: props[`${BASE}Tipo_Atractivo`] ||
          props[`${BASE}Tipo_Hospedaje`] ||
          props[`${BASE}Tipo_Establecimiento`] ||
          props[`${BASE}Tipo_Evento`] ||
          props[`${BASE}Tipo_Transporte`] ||
          props[`${BASE}Tipo_Producto`] ||
          props[`${BASE}Tipo_Recreacion`] ||
          props[`${BASE}Tipo_Ecosistema`] ||
          props[`${BASE}Tipo_Patrimonio`] ||
          clasePrincipal.replace(/_/g, " "),
    descripcion: props[`${BASE}Descripcion`] || null,
    ubicacion: props[`${BASE}Ubicacion`] || null,
    horario,
    gratuito,
    accesibilidad: props[`${BASE}Accesibilidad`] === "true" ? true 
                 : props[`${BASE}Accesibilidad`] === "false" ? false 
                 : null,
    precioNoche: props[`${BASE}Precio_Noche`] ? parseFloat(props[`${BASE}Precio_Noche`]) : null,
    precioDia: props[`${BASE}Precio_Dia`] ? parseFloat(props[`${BASE}Precio_Dia`]) : null,
    costoEntrada: props[`${BASE}Costo_Entrada`] ? parseFloat(props[`${BASE}Costo_Entrada`]) : null,
    actividades: props[`${BASE}Actividades`] || null,
    ingredientes: props[`${BASE}Ingredientes`] || null,
    // Referencias a otras entidades
    referencias: entidad.referencias || {}
  };
}

// ── Serializar resultados a Turtle ───────────────────────
function serializarATurtle(entidades) {
  let turtle = `
@prefix : <${BASE}> .
@prefix rdf: <${RDF}> .
@prefix owl: <${OWL}> .
@prefix xsd: <${XSD}> .

`;

  entidades.forEach((entidad, index) => {
    const sujeto = `:resultado_${index}`;
    turtle += `\n${sujeto} rdf:type :ResultadoBusqueda ;\n`;
    
    if (entidad.nombre) 
      turtle += `    :nombre "${entidad.nombre}" ;\n`;
    if (entidad.clase) 
      turtle += `    :clase "${entidad.clase}" ;\n`;
    if (entidad.tipo) 
      turtle += `    :tipo "${entidad.tipo}" ;\n`;
    if (entidad.descripcion) 
      turtle += `    :descripcion """${entidad.descripcion}""" ;\n`;
    if (entidad.ubicacion) 
      turtle += `    :ubicacion "${entidad.ubicacion}" ;\n`;
    if (entidad.horario) 
      turtle += `    :horario "${entidad.horario}" ;\n`;
    if (entidad.gratuito !== null) 
      turtle += `    :gratuito "${entidad.gratuito}"^^xsd:boolean ;\n`;
    if (entidad.accesibilidad !== null) 
      turtle += `    :accesibilidad "${entidad.accesibilidad}"^^xsd:boolean ;\n`;
    if (entidad.precioNoche !== null) 
      turtle += `    :precioNoche "${entidad.precioNoche}"^^xsd:float ;\n`;
    if (entidad.precioDia !== null) 
      turtle += `    :precioDia "${entidad.precioDia}"^^xsd:float ;\n`;
    if (entidad.costoEntrada !== null) 
      turtle += `    :costoEntrada "${entidad.costoEntrada}"^^xsd:float ;\n`;
    if (entidad.actividades) 
      turtle += `    :actividades "${entidad.actividades}" ;\n`;
    if (entidad.ingredientes) 
      turtle += `    :ingredientes "${entidad.ingredientes}" ;\n`;
    
    turtle += `    :uri "${entidad.nombre?.replace(/ /g, '_') || `entidad_${index}`}" .\n`;
  });

  return turtle;
}

// Cargar al importar el módulo
cargarOntologia();

module.exports = { 
  buscar,
  serializarATurtle
};