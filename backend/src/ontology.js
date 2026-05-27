// backend/src/ontology.js
// VERSIÓN DEFINITIVA - COMPLETA CON TODAS LAS FUNCIONES

const fs = require("fs");
const path = require("path");
const $rdf = require("rdflib");

const BASE =
  "http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const OWL = "http://www.w3.org/2002/07/owl#";

let store = null;
let loaded = false;

const translations = {
  "Cerro San Pedro": "San Pedro Hill",
  "Cerro de Cota": "Cota Hill",
  "Complejo Arqueológico de Pocona": "Pocona Archaeological Complex",
  Corani: "Corani",
  Incachaca: "Incachaca",
  "Cristo de la Concordia": "Christ of Concord",
  "Corso de Corsos": "Corso Parade",
  "Día del Peatón": "Pedestrian Day",
  "Entrada Universitaria": "University Parade",
  FEXCO: "FEXCO",
  "Feria Artesanal La Cancha": "La Cancha Handicraft Fair",
  "Feria de la Ensalada": "Salad Fair",
  "Feria del Pique Macho": "Pique Macho Fair",
  "Festividad Santa Vera Cruz": "Santa Vera Cruz Festival",
  "Navidad en el Prado": "Christmas in El Prado",
  "Todos Santos": "All Saints",
  "Virgen de Urkupiña": "Virgin of Urkupiña",
  Senderismo: "Hiking",
  fotografía: "photography",
  Caminata: "Walking",
  "turismo religioso": "religious tourism",
  Cerro: "Hill",
  "Mirador Religioso": "Religious Viewpoint",
  "Atractivo Natural": "Natural Attraction",
  "Atractivo Cultural Histórico": "Cultural Historical Attraction",
  "Atractivo Recreativo": "Recreational Attraction",
  "Atractivo Arqueológico": "Archaeological Attraction",
  "Evento Turístico": "Tourist Event",
  Transporte: "Transport",
};

function cargarOntologia() {
  if (loaded) return;
  const owlPath = path.join(__dirname, "../data/TurismoLocal.owl");
  if (!fs.existsSync(owlPath)) {
    console.error(`❌ Archivo OWL no encontrado: ${owlPath}`);
    process.exit(1);
  }
  let fixedPath = owlPath.replace(/\\/g, "/").replace(/ /g, "%20");
  const owlPathUrl = "file:///" + fixedPath;
  console.log(`📖 Cargando: ${owlPath}`);
  const contenido = fs.readFileSync(owlPath, "utf-8");
  store = $rdf.graph();
  try {
    $rdf.parse(contenido, store, owlPathUrl, "application/rdf+xml");
    console.log(`✅ Grafo cargado: ${store.statements.length} triples`);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
  loaded = true;
}

function obtenerPropiedades(uriNode) {
  const statements = store.statementsMatching(uriNode, null, null);
  const props = {};

  statements.forEach((st) => {
    const pred = st.predicate.value;
    const obj = st.object;
    const predName = pred.split("#").pop();

    if (obj.termType === "Literal") {
      if (!props[predName]) {
        props[predName] = [];
      }
      props[predName].push({
        value: obj.value,
        lang: obj.lang || "",
      });
    } else if (pred === RDF + "type") {
      if (!props._tipos) props._tipos = [];
      const tipoName = obj.value.split("#").pop();
      props._tipos.push(tipoName);
    }
  });

  return props;
}

function getValueByLang(props, propName, lang = "es") {
  if (!props[propName]) return null;
  const values = props[propName];
  if (!Array.isArray(values)) return null;

  for (const v of values) {
    if (v.lang === lang) {
      return v.value;
    }
  }
  if (values.length > 0) {
    return values[0].value;
  }
  return null;
}

function cleanText(text, lang) {
  if (!text) return text;
  if (text.includes(" / ")) {
    const parts = text.split(" / ");
    if (lang === "es") {
      return parts[0].trim();
    } else {
      return parts[parts.length - 1].trim();
    }
  }
  if (text.includes("/")) {
    const parts = text.split("/");
    if (lang === "es") {
      return parts[0].trim();
    } else {
      return parts[parts.length - 1].trim();
    }
  }
  return text;
}

function translateToEnglish(text, lang) {
  if (lang !== "en") return text;
  if (!text) return text;
  if (translations[text]) return translations[text];
  if (text.includes(",")) {
    const parts = text.split(",");
    const translatedParts = parts.map((part) => {
      let trimmed = part.trim();
      return translations[trimmed] || trimmed;
    });
    return translatedParts.join(", ");
  }
  return text;
}

function normalizarEntidad(uri, props, lang = "es") {
  const localName = (iri) => {
    const idx = iri.lastIndexOf("#");
    return idx >= 0
      ? decodeURIComponent(iri.slice(idx + 1)).replace(/_/g, " ")
      : iri;
  };

  let nombre = getValueByLang(props, "Nombre", "es") || localName(uri);
  let descripcion = getValueByLang(props, "Descripcion", "es") || null;
  let ubicacion = getValueByLang(props, "Ubicacion", "es") || null;
  let actividades = getValueByLang(props, "Actividades", "es") || null;
  let tipo =
    getValueByLang(props, "Tipo_Atractivo", "es") ||
    getValueByLang(props, "Tipo_Ecosistema", "es") ||
    getValueByLang(props, "Tipo_Recreacion", "es") ||
    getValueByLang(props, "Tipo_Evento", "es") ||
    getValueByLang(props, "Tipo_Transporte", "es") ||
    "";
  let horario = getValueByLang(props, "Horario_Especial", "es") || null;

  nombre = cleanText(nombre, lang);
  descripcion = cleanText(descripcion, lang);
  ubicacion = cleanText(ubicacion, lang);
  actividades = cleanText(actividades, lang);
  tipo = cleanText(tipo, lang);
  horario = cleanText(horario, lang);

  if (lang === "en") {
    nombre = translateToEnglish(nombre, lang);
    actividades = translateToEnglish(actividades, lang);
    tipo = translateToEnglish(tipo, lang);
    descripcion = translateToEnglish(descripcion, lang);
    ubicacion = translateToEnglish(ubicacion, lang);
    if (horario) horario = translateToEnglish(horario, lang);
  }

  let clasePrincipal = "Entidad Turistica";
  if (props._tipos && props._tipos.length > 0) {
    for (const t of props._tipos) {
      if (t !== "NamedIndividual" && t !== "Thing") {
        clasePrincipal = t.replace(/_/g, " ");
        break;
      }
    }
  }
  clasePrincipal = cleanText(clasePrincipal, lang);
  if (lang === "en") {
    clasePrincipal = translateToEnglish(clasePrincipal, lang);
  }

  const clasesConCosto = [
    "Atractivo Natural",
    "Natural Attraction",
    "Atractivo Cultural Histórico",
    "Cultural Historical Attraction",
    "Atractivo Recreativo",
    "Recreational Attraction",
    "Atractivo Arqueológico",
    "Archaeological Attraction",
  ];

  let mostrarCosto = clasesConCosto.includes(clasePrincipal);
  let gratuito = false;

  if (mostrarCosto) {
    const gratuitoVal = getValueByLang(props, "Gratuito", lang);
    if (gratuitoVal === "true") gratuito = true;

    const costoEntradaVal = getValueByLang(props, "Costo_Entrada", lang);
    if (costoEntradaVal && parseFloat(costoEntradaVal) === 0) gratuito = true;
  }

  let accesibilidad = getValueByLang(props, "Accesibilidad", lang) === "true";
  let tieneDescuento =
    getValueByLang(props, "Tiene_Descuento", lang) === "true";

  return {
    nombre,
    clase: clasePrincipal,
    tipo,
    descripcion,
    ubicacion,
    horario,
    gratuito,
    accesibilidad,
    tieneDescuento,
    actividades,
    mostrarCosto,
  };
}

function buscarPorClase(claseNombre, lang = "es") {
  const claseUri = BASE + claseNombre;
  const clase = new $rdf.NamedNode(claseUri);
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    clase,
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    resultados.push({ id: st.subject.value, propiedades: props });
  }

  console.log(`✅ ${claseNombre} encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

function buscarGratuitos(lang = "es") {
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    new $rdf.NamedNode(OWL + "NamedIndividual"),
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    let esGratuito = false;

    const gratuitoVal = getValueByLang(props, "Gratuito", lang);
    if (gratuitoVal === "true") esGratuito = true;

    const costoVal = getValueByLang(props, "Costo_Entrada", lang);
    if (costoVal && parseFloat(costoVal) === 0) esGratuito = true;

    if (esGratuito) {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  console.log(`✅ Gratuitos encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

function buscarMuseos(lang = "es") {
  const claseUri = BASE + "Atractivo_Cultural_Histórico";
  const clase = new $rdf.NamedNode(claseUri);
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    clase,
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    const nombre = getValueByLang(props, "Nombre", "es") || "";

    if (nombre.toLowerCase().includes("museo")) {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  console.log(`✅ Museos encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

function buscarAccesibles(lang = "es") {
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    new $rdf.NamedNode(OWL + "NamedIndividual"),
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    const accesibilidad = getValueByLang(props, "Accesibilidad", lang);

    if (accesibilidad === "true") {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  console.log(`✅ Accesibles encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

// ============================================
// NUEVAS FUNCIONES PARA LAS PREGUNTAS
// ============================================

// Buscar eventos que sean ferias artesanales
function buscarEventosFeria(lang = "es") {
  const claseUri = BASE + "Evento_Turístico";
  const clase = new $rdf.NamedNode(claseUri);
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    clase,
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    const tipoEvento = getValueByLang(props, "Tipo_Evento", "es") || "";
    const nombre = getValueByLang(props, "Nombre", "es") || "";

    if (
      tipoEvento.toLowerCase().includes("feria") ||
      nombre.toLowerCase().includes("feria")
    ) {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  console.log(`✅ Ferias artesanales encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

// Buscar parques
function buscarParques(lang = "es") {
  const claseUri = BASE + "Atractivo_Natural";
  const clase = new $rdf.NamedNode(claseUri);
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    clase,
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    const nombre = getValueByLang(props, "Nombre", "es") || "";
    const tipo = getValueByLang(props, "Tipo_Ecosistema", "es") || "";

    if (
      nombre.toLowerCase().includes("parque") ||
      tipo.toLowerCase().includes("parque")
    ) {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  console.log(`✅ Parques encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

// Buscar atractivos cerca de lago o montaña
function buscarCercaLagoMontaña(lang = "es") {
  const claseUri = BASE + "Atractivo_Natural";
  const clase = new $rdf.NamedNode(claseUri);
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    clase,
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    const tipo = getValueByLang(props, "Tipo_Ecosistema", "es") || "";

    if (
      tipo.toLowerCase().includes("lago") ||
      tipo.toLowerCase().includes("laguna") ||
      tipo.toLowerCase().includes("montaña") ||
      tipo.toLowerCase().includes("cerro")
    ) {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  console.log(
    `✅ Atractivos cerca de lago/montaña encontrados: ${resultados.length}`,
  );
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

// Buscar monumentos históricos
function buscarMonumentos(lang = "es") {
  const claseUri = BASE + "Atractivo_Cultural_Histórico";
  const clase = new $rdf.NamedNode(claseUri);
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    clase,
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    const tipoPatrimonio = getValueByLang(props, "Tipo_Patrimonio", "es") || "";
    const nombre = getValueByLang(props, "Nombre", "es") || "";

    if (
      tipoPatrimonio.toLowerCase().includes("monumento") ||
      nombre.toLowerCase().includes("monumento") ||
      tipoPatrimonio.toLowerCase().includes("histórico")
    ) {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  console.log(`✅ Monumentos históricos encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

// Buscar atractivos para familias
function buscarParaFamilias(lang = "es") {
  // Buscar en Atractivo_Recreativo (recreativos son buenos para familias)
  const claseUri = BASE + "Atractivo_Recreativo";
  const clase = new $rdf.NamedNode(claseUri);
  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    clase,
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);
    resultados.push({ id: st.subject.value, propiedades: props });
  }

  console.log(`✅ Atractivos para familias encontrados: ${resultados.length}`);
  return resultados.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

// ============================================
// FUNCIÓN DETECTAR INTENCIÓN (CORREGIDA)
// ============================================
function detectarIntencion(texto, lang) {
  const t = texto.toLowerCase();

  // Detección de accesibilidad
  if (
    t.includes("accesibilidad") ||
    t.includes("lugares con accesibilidad") ||
    t.includes("sillas de ruedas") ||
    t.includes("accesible") ||
    t.includes("accessible") ||
    t.includes("wheelchair")
  ) {
    return "accesible";
  }

  // Detección de atractivos naturales
  if (
    t.includes("atractivos naturales") ||
    t.includes("naturales existen") ||
    (t.includes("qué atractivos") && t.includes("naturales")) ||
    t.includes("what natural attractions")
  ) {
    return "natural";
  }

  // ============================================
  // NUEVAS DETECCIONES PARA LAS PREGUNTAS
  // ============================================
  if (
    t.includes("senderismo") ||
    t.includes("hiking") ||
    t.includes("rutas de senderismo")
  ) {
    return "senderismo";
  }
  if (
    t.includes("monumento") ||
    t.includes("monumentos") ||
    t.includes("puntos de interés") ||
    t.includes("historical monument") ||
    (t.includes("históricos") && t.includes("puntos"))
  ) {
    return "monumentos";
  }
  if (
    t.includes("feria artesanal") ||
    t.includes("ferias artesanales") ||
    t.includes("artesanía") ||
    t.includes("handicraft") ||
    t.includes("feria")
  ) {
    return "ferias";
  }
  if (
    t.includes("familias") ||
    t.includes("family") ||
    t.includes("recomendado para familias") ||
    t.includes("para familias")
  ) {
    return "familia";
  }
  if (
    t.includes("parque") ||
    t.includes("parques") ||
    t.includes("park") ||
    t.includes("parques turísticos")
  ) {
    return "parques";
  }
  if (
    (t.includes("lago") ||
      t.includes("montaña") ||
      t.includes("lake") ||
      t.includes("mountain")) &&
    (t.includes("cerca") || t.includes("near"))
  ) {
    return "cerca_lago_montaña";
  }
  if (
    t.includes("restaurantes") ||
    t.includes("restaurante") ||
    t.includes("restaurant") ||
    (t.includes("cerca") && t.includes("atractivos"))
  ) {
    return "restaurantes_cerca";
  }

  // ============================================
  // CÓDIGO EXISTENTE
  // ============================================
  if (
    t.includes("gratuito") ||
    t.includes("gratuitos") ||
    t.includes("gratis") ||
    t.includes("free")
  ) {
    return "gratuitos";
  }
  if (
    t.includes("museo") ||
    t.includes("museos") ||
    t.includes("museum") ||
    t.includes("museums")
  ) {
    return "museos";
  }
  if (
    t.includes("hotel") ||
    t.includes("hoteles") ||
    t.includes("hospedaje") ||
    t.includes("accommodation")
  ) {
    return "hospedaje";
  }
  if (
    t.includes("restaurante") ||
    t.includes("restaurantes") ||
    t.includes("restaurant")
  ) {
    return "restaurantes";
  }
  if (
    t.includes("plato") ||
    t.includes("platos") ||
    t.includes("comida") ||
    t.includes("food") ||
    t.includes("typical dishes")
  ) {
    return "gastronomia";
  }
  if (
    t.includes("festividad") ||
    t.includes("festividades") ||
    t.includes("evento") ||
    t.includes("eventos") ||
    t.includes("event")
  ) {
    return "eventos";
  }
  if (t.includes("transporte") || t.includes("transport")) {
    return "transporte";
  }

  return null;
}

// ============================================
// FUNCIÓN BUSCAR PRINCIPAL (CORREGIDA)
// ============================================
function buscar(q, lang = "es") {
  if (!loaded) cargarOntologia();
  if (!q || q.trim() === "") return [];

  console.log(`🔍 Pregunta: "${q}" en idioma: ${lang}`);

  const intencion = detectarIntencion(q, lang);
  console.log(`🎯 Intención: ${intencion}`);

  if (intencion) {
    switch (intencion) {
      case "gratuitos":
        return buscarGratuitos(lang);
      case "museos":
        return buscarMuseos(lang);
      case "hospedaje":
        return buscarPorClase("Hospedaje", lang);
      case "restaurantes":
        return buscarPorClase("Establecimiento_Gastronomico", lang);
      case "gastronomia":
        return buscarPorClase("Producto_Alimenticio", lang);
      case "eventos":
        return buscarPorClase("Evento_Turístico", lang);
      case "transporte":
        return buscarPorClase("Transporte", lang);
      case "natural":
        return buscarPorClase("Atractivo_Natural", lang);
      case "accesible":
        return buscarAccesibles(lang);
      // ============================================
      // NUEVOS CASOS PARA LAS PREGUNTAS
      // ============================================
      case "senderismo":
        return buscarPorClase("Atractivo_Natural", lang);
      case "monumentos":
        return buscarMonumentos(lang);
      case "ferias":
        return buscarEventosFeria(lang);
      case "familia":
        return buscarParaFamilias(lang);
      case "parques":
        return buscarParques(lang);
      case "cerca_lago_montaña":
        return buscarCercaLagoMontaña(lang);
      case "restaurantes_cerca":
        return buscarPorClase("Establecimiento_Gastronomico", lang);
      // ============================================
      default:
        break;
    }
  }

  // ============================================
  // BÚSQUEDA POR TEXTO LIBRE MEJORADA
  // ============================================
  console.log(`🔍 Búsqueda por texto libre: "${q}"`);

  let terminoNormalizado = q.toLowerCase();
  if (terminoNormalizado.endsWith("s")) {
    terminoNormalizado = terminoNormalizado.slice(0, -1);
  }
  const terminosBusqueda = [q.toLowerCase(), terminoNormalizado];
  const uniqueTerminos = [...new Set(terminosBusqueda)];

  console.log(`🔍 Términos a buscar: ${uniqueTerminos.join(", ")}`);

  const individuos = store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    new $rdf.NamedNode(OWL + "NamedIndividual"),
  );
  const resultados = [];

  for (const st of individuos) {
    const props = obtenerPropiedades(st.subject);

    let nombre = getValueByLang(props, "Nombre", "es") || "";
    let nombreEn = getValueByLang(props, "Nombre", "en") || "";
    let tipoProducto = getValueByLang(props, "Tipo_Producto", "es") || "";
    let tipoProductoEn = getValueByLang(props, "Tipo_Producto", "en") || "";

    let coincide = false;

    for (const termino of uniqueTerminos) {
      if (nombre.toLowerCase().includes(termino)) {
        coincide = true;
        console.log(`   ✅ Coincidencia en nombre: "${nombre}"`);
        break;
      }
      if (nombreEn.toLowerCase().includes(termino)) {
        coincide = true;
        console.log(`   ✅ Coincidencia en nombre inglés: "${nombreEn}"`);
        break;
      }
      if (tipoProducto.toLowerCase().includes(termino)) {
        coincide = true;
        console.log(`   ✅ Coincidencia en tipo producto: "${tipoProducto}"`);
        break;
      }
      if (tipoProductoEn.toLowerCase().includes(termino)) {
        coincide = true;
        console.log(
          `   ✅ Coincidencia en tipo producto inglés: "${tipoProductoEn}"`,
        );
        break;
      }
    }

    if (coincide) {
      resultados.push({ id: st.subject.value, propiedades: props });
    }
  }

  const uniqueResults = [];
  const ids = new Set();
  for (const res of resultados) {
    if (!ids.has(res.id)) {
      ids.add(res.id);
      uniqueResults.push(res);
    }
  }

  console.log(`✅ Resultados texto libre: ${uniqueResults.length}`);
  return uniqueResults.map((ent) =>
    normalizarEntidad(ent.id, ent.propiedades, lang),
  );
}

function serializarAOWL(entidades, termino) {
  let owl = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  <owl:NamedIndividual rdf:about="#Consulta_${Date.now()}">
    <terminoBusqueda>${escapeXml(termino || "")}</terminoBusqueda>
    <totalResultados rdf:datatype="xsd:integer">${entidades.length}</totalResultados>
  </owl:NamedIndividual>`;

  entidades.forEach((entidad, index) => {
    owl += `
  <owl:NamedIndividual rdf:about="#Resultado_${index}_${Date.now()}">`;
    if (entidad.nombre)
      owl += `\n    <nombre>${escapeXml(entidad.nombre)}</nombre>`;
    if (entidad.clase)
      owl += `\n    <clase>${escapeXml(entidad.clase)}</clase>`;
    if (entidad.tipo) owl += `\n    <tipo>${escapeXml(entidad.tipo)}</tipo>`;
    if (entidad.descripcion)
      owl += `\n    <descripcion>${escapeXml(entidad.descripcion)}</descripcion>`;
    if (entidad.ubicacion)
      owl += `\n    <ubicacion>${escapeXml(entidad.ubicacion)}</ubicacion>`;
    if (entidad.horario)
      owl += `\n    <horario>${escapeXml(entidad.horario)}</horario>`;
    owl += `\n    <gratuito rdf:datatype="xsd:boolean">${entidad.gratuito}</gratuito>`;
    if (entidad.accesibilidad)
      owl += `\n    <accesibilidad rdf:datatype="xsd:boolean">${entidad.accesibilidad}</accesibilidad>`;
    if (entidad.tieneDescuento)
      owl += `\n    <tieneDescuento rdf:datatype="xsd:boolean">${entidad.tieneDescuento}</tieneDescuento>`;
    if (entidad.actividades)
      owl += `\n    <actividades>${escapeXml(entidad.actividades)}</actividades>`;
    owl += `\n  </owl:NamedIndividual>`;
  });

  owl += `\n</rdf:RDF>`;
  return owl;
}

function escapeXml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

cargarOntologia();
module.exports = { buscar, serializarAOWL };
