// backend/src/ontology.js
// VERSIÓN COMPLETA - Búsqueda semántica con soporte BILINGÜE (Español/Inglés)

const fs = require("fs");
const path = require("path");
const $rdf = require("rdflib");

const BASE = "http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#";
const RDF  = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const OWL  = "http://www.w3.org/2002/07/owl#";

let store  = null;
let loaded = false;

// ============================================================
// CARGA DE ONTOLOGÍA
// ============================================================
function cargarOntologia() {
  if (loaded) return;
  const owlPath = path.join(__dirname, "../data/TurismoLocal.owl");
  if (!fs.existsSync(owlPath)) {
    console.error(`❌ Archivo OWL no encontrado: ${owlPath}`);
    process.exit(1);
  }
  const fixedPath   = owlPath.replace(/\\/g, "/").replace(/ /g, "%20");
  const owlPathUrl  = "file:///" + fixedPath;
  const contenido   = fs.readFileSync(owlPath, "utf-8");
  store = $rdf.graph();
  try {
    $rdf.parse(contenido, store, owlPathUrl, "application/rdf+xml");
    console.log(`✅ Grafo cargado: ${store.statements.length} triples`);
  } catch (err) {
    console.error("❌ Error al parsear OWL:", err.message);
    process.exit(1);
  }
  loaded = true;
}

// ============================================================
// NORMALIZACIÓN DE TEXTO
// ============================================================
function normalizar(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Distancia de Levenshtein
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function similares(a, b) {
  const na = normalizar(a), nb = normalizar(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const maxDist = nb.length <= 5 ? 1 : 2;
  return levenshtein(na, nb) <= maxDist;
}

// ============================================================
// DICCIONARIO BILINGÜE (Español ↔ Inglés)
// ============================================================
const DICCIONARIO_BILINGUE = {
  // Gratuitos
  "free": "gratuito",
  "gratis": "gratuito",
  "gratuito": "gratuito",
  "free places": "lugares gratuitos",
  "free entry": "entrada gratis",
  
  // Museos
  "museums": "museos",
  "museum": "museos",
  "museo": "museos",
  "museos": "museos",
  
  // Hospedaje
  "hotels": "hospedaje",
  "hotel": "hospedaje",
  "hostels": "hospedaje",
  "hostel": "hospedaje",
  "hospedaje": "hospedaje",
  "lodging": "hospedaje",
  "accommodation": "hospedaje",
  
  // Restaurantes
  "restaurants": "restaurante",
  "restaurant": "restaurante",
  "restaurante": "restaurante",
  
  // Parques
  "parks": "parques",
  "park": "parques",
  "parque": "parques",
  "parques": "parques",
  
  // Senderismo
  "hiking": "senderismo",
  "trekking": "senderismo",
  "senderismo": "senderismo",
  
  // Transporte
  "transport": "transporte",
  "transportation": "transporte",
  "transporte": "transporte",
  
  // Eventos
  "events": "eventos",
  "event": "eventos",
  "festivals": "eventos",
  "festival": "eventos",
  "evento": "eventos",
  "eventos": "eventos",
  
  // Iglesias
  "churches": "iglesias",
  "church": "iglesias",
  "cathedral": "iglesias",
  "iglesia": "iglesias",
  "iglesias": "iglesias",
  
  // Gastronomía
  "food": "gastronomia",
  "typical food": "gastronomia",
  "local food": "gastronomia",
  "dishes": "gastronomia",
  "gastronomia": "gastronomia",
  "platos tipicos": "gastronomia",
  
  // Accesibilidad
  "accessible": "accesible",
  "wheelchair": "accesible",
  "accesible": "accesible",
  
  // Arqueológico
  "archaeological": "arqueologico",
  "ruins": "arqueologico",
  "arqueologico": "arqueologico",
  
  // Familia
  "family": "familia",
  "family friendly": "familia",
  "kids": "familia",
  "children": "familia",
  "familia": "familia",
  
  // Miradores
  "viewpoint": "mirador",
  "viewpoints": "mirador",
  "mirador": "mirador",
  
  // Natural
  "natural": "natural",
  "nature": "natural",
  
  // Ferias
  "fair": "feria",
  "fairs": "feria",
  "artisan fair": "feria",
  "feria": "feria"
};

function traducirConsulta(query) {
  const lowerQuery = query.toLowerCase().trim();
  
  // Traducción directa
  if (DICCIONARIO_BILINGUE[lowerQuery]) {
    console.log(`🌐 Traduciendo: "${query}" → "${DICCIONARIO_BILINGUE[lowerQuery]}"`);
    return DICCIONARIO_BILINGUE[lowerQuery];
  }
  
  // Traducción de frases
  const palabras = lowerQuery.split(" ");
  if (palabras.length > 1) {
    const traducidas = palabras.map(p => DICCIONARIO_BILINGUE[p] || p);
    const resultado = traducidas.join(" ");
    if (resultado !== lowerQuery) {
      console.log(`🌐 Traducción frase: "${query}" → "${resultado}"`);
      return resultado;
    }
  }
  
  return query;
}

// ============================================================
// DICCIONARIO DE INTENCIONES (MEJORADO CON INGLÉS)
// ============================================================
const INTENCIONES = [
  {
    clave: "gratuito",
    terminos: [
      "gratuito","gratuita","gratuitos","gratuitas","gratis","gratus","gratzis","gratiz",
      "grtis","grtas","gatris","gtaris","gatis","gatiz","free","sin costo","sin cobro",
      "entrada libre","entrada gratis","no cobran","no pagan","acceso libre","costo cero",
      "gratuidad","gratu","grats","grat","grstu","free entry","free access","no cost",
      "complimentary","zero cost","gratis entry","free of charge"
    ]
  },
  {
    clave: "museo",
    terminos: [
      "museo","museos","museum","museums","muse","musseo","mueso","museso",
      "arqueologico","arqueológico","arqueologia","arqueología","historia","historico",
      "historica","cultural","cultura","patrimonial","patrimonio","art gallery",
      "gallery","exhibition","art museum"
    ]
  },
  {
    clave: "hospedaje",
    terminos: [
      "hotel","hoteles","hotels","hotle","hotl","hospedaje","hospedajes","hostal",
      "hostales","alojamiento","alojamientos","accommodation","lodging","hote",
      "hospeda","hospedar","dormir","donde dormir","donde quedarme","donde quedarse",
      "habitacion","habitaciones","room","rooms","alberge","albergue","posada",
      "inn","guesthouse","bed and breakfast","bnb"
    ]
  },
  {
    clave: "restaurante",
    terminos: [
      "restaurante","restaurantes","restaurant","restaurants","restoran","restorante",
      "comida","comer","almorzar","almuerzo","cenar","cena","picantera","picanteria",
      "parrilada","parrilla","buffet","mercado","salteñeria","establecimiento",
      "gastronomico","gastronomy","donde comer","lugar para comer","dining",
      "eatery","cafe","coffee shop","lunch","dinner","breakfast"
    ]
  },
  {
    clave: "gastronomia",
    terminos: [
      "plato","platos","comida tipica","comidas tipicas","gastronomia","gastronomía",
      "tipico","tipicos","typical","dish","dishes","silpancho","pique macho","chicharron",
      "chicharrón","sopa de mani","salteña","lapping","trancapecho","garapiña",
      "mocochinchi","chicha","bebida","bebidas","food","local food","typical food",
      "receta","recetas","degustar","probar","sabor","sabores","plato tipico",
      "traditional food","bolivian food","culinary","cooking"
    ]
  },
  {
    clave: "parque",
    terminos: [
      "parque","parques","park","parks","parqe","parqes","jardin","jardines","garden",
      "gardens","jardin botanico","botanical","botanico","tunari","kanata","familia",
      "vial","mariscal","cretacico","toro toro","torotoro","recreativo","recreativos",
      "recreación","recreacion","area verde","areas verdes","national park",
      "nature reserve","ecological park","green area"
    ]
  },
  {
    clave: "natural",
    terminos: [
      "natural","naturales","nature","atractivo natural","atractivos naturales",
      "ecosistema","ecosistemas","cerro","cerros","laguna","lagunas","lago","lagos",
      "rio","ríos","rios","river","lake","mountain","montaña","montañas","hill",
      "flora","fauna","paisaje","paisajes","landscape","landscapes","campo","campestre",
      "silvestre","verde","waterfall","cascade","valley","forest","jungle"
    ]
  },
  {
    clave: "senderismo",
    terminos: [
      "sendero","senderos","senderismo","hiking","trekking","treking","caminata",
      "caminatas","caminar","ruta","rutas","trail","trails","excursion",
      "ascenso","escalada","espeleologia","aventura","outdoor","aire libre",
      "climbing","expedition","backpacking","nature walk","path","route"
    ]
  },
  {
    clave: "mirador",
    terminos: [
      "mirador","miradores","viewpoint","viewpoints","vista",
      "vistas","panorama","panoramico","panoramica","alto","altura","elevacion",
      "elevación","colina","cima","cumbre","lookout","observation point",
      "scenic view","overlook"
    ]
  },
  {
    clave: "iglesia",
    terminos: [
      "iglesia","iglesias","church","churches","catedral","catedrales","cathedral",
      "templo","templos","temple","convento","conventos","convent","capilla",
      "capillas","religioso","religiosa","religiosos","religiosas","religión",
      "religion","espiritual","basilica","shrine","chapel","monastery"
    ]
  },
  {
    clave: "evento",
    terminos: [
      "evento","eventos","event","events","festividad","festividades","festival",
      "festivales","fiesta","fiestas","celebracion","celebración","carnaval",
      "urkupiña","todos santos","navidad","entrada universitaria","corso",
      "dia del peaton","feria","ferias","fair","fairs","anual","anualmente",
      "celebration","parade","feast","holiday"
    ]
  },
  {
    clave: "feria",
    terminos: [
      "feria artesanal","ferias artesanales","artesania","artesanías","artesanal",
      "artesanales","handicraft","craft","crafts","la cancha","cancha",
      "mercado artesanal","souvenirs","souvenir","artesano","artesanos",
      "artisan fair","craft fair","market","handmade"
    ]
  },
  {
    clave: "transporte",
    terminos: [
      "transporte","transportes","transport","transportation","bus","buses","micro",
      "minibus","minibús","trufi","taxi","radio taxi","teleferico","teleférico",
      "cable car","tren","train","mototaxi","moto taxi","transfer","aeropuerto",
      "como llegar","llegar","acceso","acceder","llego","movilidad","shuttle",
      "van","collective","public transport","metro","cableway","aerial tram"
    ]
  },
  {
    clave: "accesible",
    terminos: [
      "accesible","accesibles","accessible","accessibility","accesibilidad",
      "silla de ruedas","sillas de ruedas","wheelchair","discapacidad","discapacitado",
      "movilidad reducida","movilidad","inclusivo","inclusiva","sin barreras",
      "barreras arquitectonicas","rampas","handicap accessible","disabled access"
    ]
  },
  {
    clave: "arqueologico",
    terminos: [
      "arqueologico","arqueológico","arqueologia","arqueología","ruinas","ruin","ruins",
      "vestigios","pukara","qollqas","inca","incaico","prehispanico","prehispánico",
      "precolombino","fossil","fosil","dinosaurio","dinosaurios","prehistoric",
      "prehistorico","prehistórico","incallajta","pocona","tarata","mizque","taracari",
      "archaeological site","ancient ruins","excavation","artifact","remains"
    ]
  },
  {
    clave: "familia",
    terminos: [
      "familia","familias","family","families","niños","niñas","ninos","ninas",
      "kids","children","infantil","infantes","padres","hijos","familiar",
      "para niños","con niños","recomendado para familias","apto para niños",
      "diversión familiar","diversion","family friendly","child friendly",
      "family oriented","kid friendly","with children"
    ]
  }
];

// ============================================================
// DETECCIÓN DE INTENCIÓN ROBUSTA
// ============================================================
function detectarIntencion(texto) {
  const norm = normalizar(texto);
  const palabras = norm.split(" ");

  const puntajes = {};

  for (const intencion of INTENCIONES) {
    let puntaje = 0;
    for (const termino of intencion.terminos) {
      const nt = normalizar(termino);
      if (norm.includes(nt)) {
        puntaje += 10;
        continue;
      }
      for (const palabra of palabras) {
        if (similares(palabra, nt)) {
          puntaje += 5;
        }
      }
    }
    if (puntaje > 0) puntajes[intencion.clave] = puntaje;
  }

  if (Object.keys(puntajes).length === 0) return null;

  const ganadora = Object.entries(puntajes).sort((a, b) => b[1] - a[1])[0];
  console.log(`🎯 Intención: "${ganadora[0]}" (puntaje: ${ganadora[1]})`);
  console.log(`   Puntajes:`, puntajes);
  return ganadora[0];
}

// ============================================================
// ACCESO A PROPIEDADES
// ============================================================
function obtenerPropiedades(uriNode) {
  const statements = store.statementsMatching(uriNode, null, null);
  const props = {};
  statements.forEach((st) => {
    const pred    = st.predicate.value;
    const obj     = st.object;
    const predName = pred.split("#").pop();
    if (obj.termType === "Literal") {
      if (!props[predName]) props[predName] = [];
      props[predName].push({ value: obj.value, lang: obj.lang || "" });
    } else if (pred === RDF + "type") {
      if (!props._tipos) props._tipos = [];
      props._tipos.push(obj.value.split("#").pop());
    } else {
      if (!props._objProps) props._objProps = {};
      if (!props._objProps[predName]) props._objProps[predName] = [];
      props._objProps[predName].push(obj.value.split("#").pop().replace(/_/g, " "));
    }
  });
  return props;
}

function getProp(props, name) {
  if (!props[name] || !props[name].length) return null;
  return props[name][0].value;
}

function getBool(props, name) {
  const v = getProp(props, name);
  if (v === null) return null;
  return v === "true";
}

function getNum(props, name) {
  const v = getProp(props, name);
  if (v === null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ============================================================
// NORMALIZACIÓN DE ENTIDAD
// ============================================================
function normalizarEntidad(uri, props) {
  const localName = (iri) => {
    const idx = iri.lastIndexOf("#");
    return idx >= 0 ? decodeURIComponent(iri.slice(idx + 1)).replace(/_/g, " ") : iri;
  };

  let clasePrincipal = "Entidad Turistica";
  if (props._tipos) {
    for (const t of props._tipos) {
      if (t !== "NamedIndividual" && t !== "Thing") {
        clasePrincipal = t.replace(/_/g, " ");
        break;
      }
    }
  }

  const nombre =
    getProp(props, "Nombre") ||
    getProp(props, "Tipo_Hospedaje") ||
    getProp(props, "Tipo_Transporte") ||
    localName(uri);

  const tipo =
    getProp(props, "Tipo_Atractivo")   ||
    getProp(props, "Tipo_Ecosistema")  ||
    getProp(props, "Tipo_Recreacion")  ||
    getProp(props, "Tipo_Evento")      ||
    getProp(props, "Tipo_Transporte")  ||
    getProp(props, "Tipo_Hospedaje")   ||
    getProp(props, "Tipo_Establecimiento") ||
    getProp(props, "Tipo_Producto")    ||
    getProp(props, "Tipo_Patrimonio")  ||
    getProp(props, "Es_Tipico")        ||
    "";

  const descripcion  = getProp(props, "Descripcion");
  const ubicacion    = getProp(props, "Ubicacion");
  const ingredientes = getProp(props, "Ingredientes");
  const actividades  = getProp(props, "Actividades");
  const ruta         = getProp(props, "Ruta");
  const epoch        = getProp(props, "Epoca");
  const frecuencia   = getProp(props, "Frecuencia");
  const fechaInicio  = getProp(props, "Fecha_Inicio");
  const fechaFin     = getProp(props, "Fecha_Fin");
  const culturaOrigen = getProp(props, "Cultura_Origen");
  const estadoConservacion = getProp(props, "Estado_Conservacion");
  const incluye      = getProp(props, "Incluye_Servicios");
  const servicios    = getProp(props, "Servicios");
  const capacidad    = getNum(props, "Capacidad");
  const costoAprox   = getNum(props, "Costo_Aproximado");

  const horario =
    getProp(props, "Horario_Especial")  ||
    getProp(props, "Horario_Apertura")  ||
    getProp(props, "Horario_Atencion")  ||
    getProp(props, "Horario_Servicio")  ||
    null;

  const horarioCierra = getProp(props, "Horario_Cierra");
  const horarioFull = horario && horarioCierra
    ? `${horario} - ${horarioCierra}`
    : horario;

  const gratuito          = getBool(props, "Gratuito");
  const accesibilidad     = getBool(props, "Accesibilidad");
  const tieneDescuento    = getBool(props, "Tiene_Descuento");
  const requiereReserva   = getBool(props, "Requiere_Reserva");
  const patrimonioNacional = getBool(props, "Patrimonio_Nacional");
  const disponible        = getBool(props, "Disponible");

  const precioNoche  = getNum(props, "Precio_Noche");
  const precioDia    = getNum(props, "Precio_Dia");
  const costoEntrada = getNum(props, "Costo_Entrada");

  const nivelConcurrencia = getProp(props, "Nivel_Concurrencia");

  return {
    nombre,
    clase: clasePrincipal,
    tipo,
    descripcion,
    ubicacion,
    horario: horarioFull,
    gratuito,
    accesibilidad,
    tieneDescuento,
    requiereReserva,
    patrimonioNacional,
    precioNoche,
    precioDia,
    costoEntrada,
    actividades,
    ingredientes,
    ruta,
    epoch,
    frecuencia,
    fechaInicio,
    fechaFin,
    culturaOrigen,
    estadoConservacion,
    incluye,
    servicios,
    capacidad,
    costoAprox,
    nivelConcurrencia,
    disponible,
  };
}

// ============================================================
// FUNCIONES DE BÚSQUEDA POR CLASE
// ============================================================
function individuosDe(clase) {
  return store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    new $rdf.NamedNode(BASE + clase)
  );
}

function todosLosIndividuos() {
  return store.statementsMatching(
    null,
    new $rdf.NamedNode(RDF + "type"),
    new $rdf.NamedNode(OWL + "NamedIndividual")
  );
}

function buscarPorClase(clase) {
  return individuosDe(clase).map((st) => {
    const p = obtenerPropiedades(st.subject);
    return normalizarEntidad(st.subject.value, p);
  });
}

function buscarTodos() {
  const ids = new Set();
  const res = [];
  for (const st of todosLosIndividuos()) {
    if (!ids.has(st.subject.value)) {
      ids.add(st.subject.value);
      const p = obtenerPropiedades(st.subject);
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res;
}

// ============================================================
// BÚSQUEDAS ESPECÍFICAS
// ============================================================
function buscarGratuitos() {
  const res = [];
  for (const st of todosLosIndividuos()) {
    const p = obtenerPropiedades(st.subject);
    const g = getBool(p, "Gratuito");
    const c = getNum(p, "Costo_Entrada");
    if (g === true || c === 0) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res;
}

function buscarAccesibles() {
  const res = [];
  for (const st of todosLosIndividuos()) {
    const p = obtenerPropiedades(st.subject);
    if (getBool(p, "Accesibilidad") === true) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res;
}

function buscarMuseos() {
  const res = [];
  for (const st of individuosDe("Atractivo_Cultural_Histórico")) {
    const p = obtenerPropiedades(st.subject);
    const n = normalizar(getProp(p, "Nombre") || "");
    const t = normalizar(getProp(p, "Tipo_Patrimonio") || "");
    if (n.includes("museo") || t.includes("muse") || t.includes("musei")) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  if (res.length === 0) return buscarPorClase("Atractivo_Cultural_Histórico");
  return res;
}

function buscarIglesias() {
  const res = [];
  const clases = ["Atractivo_Cultural_Histórico", "Atractivo_Recreativo"];
  for (const clase of clases) {
    for (const st of individuosDe(clase)) {
      const p = obtenerPropiedades(st.subject);
      const n = normalizar(getProp(p, "Nombre") || "");
      const t = normalizar(getProp(p, "Tipo_Patrimonio") || "") +
               " " + normalizar(getProp(p, "Tipo_Atractivo") || "") +
               " " + normalizar(getProp(p, "Tipo_Recreacion") || "");
      if (
        n.includes("iglesia") || n.includes("catedral") || n.includes("templo") ||
        n.includes("convento") || n.includes("capilla") ||
        t.includes("religi") || t.includes("mirador religi")
      ) {
        res.push(normalizarEntidad(st.subject.value, p));
      }
    }
  }
  return res;
}

function buscarMiradores() {
  const res = [];
  for (const st of todosLosIndividuos()) {
    const p = obtenerPropiedades(st.subject);
    const n = normalizar(getProp(p, "Nombre") || "");
    const t = normalizar(getProp(p, "Tipo_Recreacion") || "") +
             " " + normalizar(getProp(p, "Tipo_Ecosistema") || "") +
             " " + normalizar(getProp(p, "Tipo_Atractivo") || "");
    if (
      n.includes("cerro") || n.includes("mirador") || n.includes("cristo") ||
      t.includes("mirador") || t.includes("cerro") || t.includes("montaña")
    ) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res;
}

function buscarParques() {
  const res = [];
  for (const st of todosLosIndividuos()) {
    const p = obtenerPropiedades(st.subject);
    const n = normalizar(getProp(p, "Nombre") || "");
    const t = normalizar(getProp(p, "Tipo_Ecosistema") || "") +
             " " + normalizar(getProp(p, "Tipo_Recreacion") || "") +
             " " + normalizar(getProp(p, "Tipo_Atractivo") || "");
    if (
      n.includes("parque") || n.includes("jardin") ||
      t.includes("parque") || t.includes("jardin") || t.includes("botanico")
    ) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res;
}

function buscarSenderismo() {
  const res = [];
  for (const st of individuosDe("Atractivo_Natural")) {
    const p = obtenerPropiedades(st.subject);
    const act = normalizar(getProp(p, "Actividades") || "");
    const desc = normalizar(getProp(p, "Descripcion") || "");
    if (
      act.includes("sendero") || act.includes("trekking") ||
      act.includes("caminata") || act.includes("hiking") ||
      desc.includes("sendero") || desc.includes("trekking")
    ) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  for (const st of individuosDe("Atractivo_Cultural_Histórico")) {
    const p = obtenerPropiedades(st.subject);
    const desc = normalizar(getProp(p, "Descripcion") || "");
    if (desc.includes("sendero") || desc.includes("caminata")) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res.length > 0 ? res : buscarPorClase("Atractivo_Natural");
}

function buscarFerias() {
  const res = [];
  for (const st of individuosDe("Evento_Turístico")) {
    const p = obtenerPropiedades(st.subject);
    const n = normalizar(getProp(p, "Nombre") || "");
    const t = normalizar(getProp(p, "Tipo_Evento") || "");
    if (n.includes("feria") || t.includes("feria") || t.includes("artesanal")) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res.length > 0 ? res : buscarPorClase("Evento_Turístico");
}

function buscarMonumentos() {
  const res = [];
  for (const st of individuosDe("Atractivo_Cultural_Histórico")) {
    const p = obtenerPropiedades(st.subject);
    const t = normalizar(getProp(p, "Tipo_Patrimonio") || "");
    const n = normalizar(getProp(p, "Nombre") || "");
    if (t.includes("monumento") || t.includes("historico") || n.includes("monumento")) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res.length > 0 ? res : buscarPorClase("Atractivo_Cultural_Histórico");
}

function buscarFamilias() {
  const res = [];
  for (const st of individuosDe("Atractivo_Recreativo")) {
    const p = obtenerPropiedades(st.subject);
    const t = normalizar(getProp(p, "Tipo_Recreacion") || "");
    const n = normalizar(getProp(p, "Nombre") || "");
    if (
      t.includes("familiar") || t.includes("infantil") || t.includes("educativo") ||
      n.includes("familia") || n.includes("kanata") || n.includes("jardin")
    ) {
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res.length > 0 ? res : buscarPorClase("Atractivo_Recreativo");
}

// ============================================================
// BÚSQUEDA POR NOMBRE
// ============================================================
function buscarPorNombre(nombreBuscado) {
  const normBuscado = normalizar(nombreBuscado);
  const res = [];
  const ids = new Set();

  for (const st of todosLosIndividuos()) {
    if (ids.has(st.subject.value)) continue;
    const p = obtenerPropiedades(st.subject);

    const nombre = normalizar(getProp(p, "Nombre") || "");
    const tipoH  = normalizar(getProp(p, "Tipo_Hospedaje") || "");
    const tipoT  = normalizar(getProp(p, "Tipo_Transporte") || "");
    
    const idx = st.subject.value.lastIndexOf("#");
    const localN = normalizar(
      idx >= 0
        ? decodeURIComponent(st.subject.value.slice(idx + 1)).replace(/_/g, " ")
        : st.subject.value
    );

    if (
      nombre === normBuscado ||
      tipoH === normBuscado ||
      tipoT === normBuscado ||
      localN === normBuscado ||
      (nombre.includes(normBuscado) && normBuscado.length > 2) ||
      (normBuscado.includes(nombre) && nombre.length > 2) ||
      (nombre.split(" ")[0] === normBuscado && normBuscado.length > 2)
    ) {
      ids.add(st.subject.value);
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }
  return res;
}

// ============================================================
// BÚSQUEDA POR PREFIJO (para tiempo real)
// ============================================================
function buscarPorPrefijo(prefijo) {
  if (!loaded) cargarOntologia();
  if (!prefijo || prefijo.trim().length < 2) return [];
  
  const normPrefijo = normalizar(prefijo);
  const resultados = [];
  const ids = new Set();
  
  console.log(`🔍 Búsqueda por prefijo: "${prefijo}" (normalizado: "${normPrefijo}")`);
  
  for (const st of todosLosIndividuos()) {
    if (ids.has(st.subject.value)) continue;
    const p = obtenerPropiedades(st.subject);
    
    const nombre = normalizar(getProp(p, "Nombre") || "");
    const descripcion = normalizar(getProp(p, "Descripcion") || "");
    const ubicacion = normalizar(getProp(p, "Ubicacion") || "");
    const tipo = normalizar(
      (getProp(p, "Tipo_Atractivo") || "") +
      " " + (getProp(p, "Tipo_Recreacion") || "") +
      " " + (getProp(p, "Tipo_Ecosistema") || "") +
      " " + (getProp(p, "Tipo_Patrimonio") || "")
    );
    const actividades = normalizar(getProp(p, "Actividades") || "");
    
    let coincide = false;
    
    if (nombre.startsWith(normPrefijo)) coincide = true;
    else if (nombre.includes(" " + normPrefijo)) coincide = true;
    else if (descripcion.includes(normPrefijo)) coincide = true;
    else if (ubicacion.includes(normPrefijo)) coincide = true;
    else if (tipo.includes(normPrefijo)) coincide = true;
    else if (actividades.includes(normPrefijo)) coincide = true;
    
    if (coincide) {
      ids.add(st.subject.value);
      resultados.push(normalizarEntidad(st.subject.value, p));
      if (resultados.length >= 20) break;
    }
  }
  
  console.log(`✅ Prefijo "${prefijo}" → ${resultados.length} resultados`);
  return resultados;
}

// ============================================================
// BÚSQUEDA POR TEXTO LIBRE
// ============================================================
function buscarTextoLibre(q) {
  const norm_q  = normalizar(q);
  const stopwords = new Set(["que","los","las","hay","con","son","una","uno","del","para","por","como","donde","cual","cuales","sus","esta","este","the","and","for","with","are"]);
  const palabras  = norm_q.split(" ").filter(p => p.length > 2 && !stopwords.has(p));

  const ids = new Set();
  const res = [];

  for (const st of todosLosIndividuos()) {
    if (ids.has(st.subject.value)) continue;
    const p = obtenerPropiedades(st.subject);

    const nombre = normalizar(getProp(p, "Nombre") || "");
    const tipoH  = normalizar(getProp(p, "Tipo_Hospedaje") || "");
    const tipoT  = normalizar(getProp(p, "Tipo_Transporte") || "");

    if (
      nombre === norm_q ||
      tipoH  === norm_q ||
      tipoT  === norm_q ||
      (nombre && nombre === norm_q)
    ) {
      ids.add(st.subject.value);
      res.push(normalizarEntidad(st.subject.value, p));
      continue;
    }

    if (
      (nombre && nombre.includes(norm_q)) ||
      (nombre && norm_q.includes(nombre) && nombre.length > 4)
    ) {
      ids.add(st.subject.value);
      res.push(normalizarEntidad(st.subject.value, p));
      continue;
    }

    if (palabras.length === 0) continue;

    const campos = [
      nombre,
      normalizar(getProp(p, "Descripcion") || ""),
      normalizar(getProp(p, "Tipo_Atractivo") || ""),
      normalizar(getProp(p, "Tipo_Ecosistema") || ""),
      normalizar(getProp(p, "Tipo_Recreacion") || ""),
      normalizar(getProp(p, "Tipo_Evento") || ""),
      normalizar(getProp(p, "Tipo_Producto") || ""),
      tipoH,
      normalizar(getProp(p, "Tipo_Establecimiento") || ""),
      normalizar(getProp(p, "Tipo_Patrimonio") || ""),
      normalizar(getProp(p, "Actividades") || ""),
      normalizar(getProp(p, "Ubicacion") || ""),
      normalizar(getProp(p, "Cultura_Origen") || ""),
    ].filter(Boolean).join(" ");

    const campoTokens = campos.split(" ").filter(t => t.length > 1);

    const todasCoinciden = palabras.every(pal =>
      campos.includes(pal) ||
      campoTokens.some(ct => ct.length > 2 && similares(pal, ct))
    );

    if (todasCoinciden) {
      ids.add(st.subject.value);
      res.push(normalizarEntidad(st.subject.value, p));
    }
  }

  return res;
}

// ============================================================
// FUNCIÓN PRINCIPAL DE BÚSQUEDA (CON TRADUCCIÓN)
// ============================================================
function buscar(q) {
  if (!loaded) cargarOntologia();
  if (!q || q.trim() === "") return [];

  let query = q.trim();
  console.log(`\n🔍 Consulta original: "${query}"`);
  
  // TRADUCIR si es necesario (inglés → español)
  const queryTraducida = traducirConsulta(query);
  if (queryTraducida !== query) {
    console.log(`🔄 Usando traducción: "${queryTraducida}"`);
    query = queryTraducida;
  }

  const porNombre = buscarPorNombre(query);
  if (porNombre.length > 0 && porNombre.length <= 5) {
    console.log(`✅ Coincidencia por nombre: ${porNombre.length} resultado(s)`);
    return porNombre;
  }

  const intencion = detectarIntencion(query);
  console.log(`🎯 Intención detectada: ${intencion || "ninguna → texto libre"}`);

  let resultados = [];

  switch (intencion) {
    case "gratuito":       resultados = buscarGratuitos();                              break;
    case "museo":          resultados = buscarMuseos();                                 break;
    case "hospedaje":      resultados = buscarPorClase("Hospedaje");                    break;
    case "restaurante":    resultados = buscarPorClase("Establecimiento_Gastronomico"); break;
    case "gastronomia":    resultados = buscarPorClase("Producto_Alimenticio");         break;
    case "parque":         resultados = buscarParques();                                break;
    case "natural":        resultados = buscarPorClase("Atractivo_Natural");            break;
    case "senderismo":     resultados = buscarSenderismo();                             break;
    case "mirador":        resultados = buscarMiradores();                              break;
    case "iglesia":        resultados = buscarIglesias();                               break;
    case "evento":         resultados = buscarPorClase("Evento_Turístico");             break;
    case "feria":          resultados = buscarFerias();                                 break;
    case "transporte":     resultados = buscarPorClase("Transporte");                   break;
    case "accesible":      resultados = buscarAccesibles();                             break;
    case "arqueologico":   resultados = buscarPorClase("Atractivo_Arqueológico");       break;
    case "familia":        resultados = buscarFamilias();                               break;
    case "monumentos":     resultados = buscarMonumentos();                             break;
    default:
      resultados = buscarTextoLibre(query);
  }

  console.log(`✅ ${resultados.length} resultados para "${q}"`);
  return resultados;
}

// ============================================================
// SUGERENCIAS DE AUTOCOMPLETADO (BILINGÜE)
// ============================================================
function sugerencias(prefijo) {
  if (!loaded) cargarOntologia();
  if (!prefijo || prefijo.trim().length < 2) return [];

  const norm = normalizar(prefijo);
  const sugs = new Set();

  // Sugerencias de nombres de entidades
  for (const st of todosLosIndividuos()) {
    const p = obtenerPropiedades(st.subject);
    const nombre = getProp(p, "Nombre");
    if (nombre && normalizar(nombre).includes(norm)) {
      if (!sugs.has(nombre)) sugs.add(nombre);
    }
    if (sugs.size >= 6) break;
  }

  // Sugerencias bilingües del diccionario
  if (sugs.size < 4) {
    const todosTerminos = new Set();
    for (const int of INTENCIONES) {
      for (const t of int.terminos) {
        todosTerminos.add(t);
      }
    }
    for (const [en, es] of Object.entries(DICCIONARIO_BILINGUE)) {
      todosTerminos.add(en);
      todosTerminos.add(es);
    }
    
    for (const term of todosTerminos) {
      const normTerm = normalizar(term);
      if (normTerm.startsWith(norm) && !sugs.has(term)) {
        sugs.add(term);
        if (sugs.size >= 8) break;
      }
    }
  }

  const resultado = [...sugs].slice(0, 8);
  console.log(`💡 Sugerencias para "${prefijo}":`, resultado);
  return resultado;
}

// ============================================================
// SERIALIZACIÓN OWL/RDF-XML
// ============================================================
function escapeXml(str) {
  if (!str && str !== false && str !== 0) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[m]));
}

function serializarAOWL(entidades, termino) {
  const ts = Date.now();
  let owl = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  <owl:NamedIndividual rdf:about="#Consulta_${ts}">
    <terminoBusqueda>${escapeXml(termino)}</terminoBusqueda>
    <totalResultados rdf:datatype="xsd:integer">${entidades.length}</totalResultados>
  </owl:NamedIndividual>`;

  entidades.forEach((e, i) => {
    owl += `\n  <owl:NamedIndividual rdf:about="#Resultado_${i}_${ts}">`;
    const add = (tag, val) => {
      if (val !== null && val !== undefined && val !== "") {
        owl += `\n    <${tag}>${escapeXml(val)}</${tag}>`;
      }
    };
    const addBool = (tag, val) => {
      if (val !== null && val !== undefined) {
        owl += `\n    <${tag} rdf:datatype="xsd:boolean">${val}</${tag}>`;
      }
    };
    const addNum = (tag, val) => {
      if (val !== null && val !== undefined) {
        owl += `\n    <${tag} rdf:datatype="xsd:float">${val}</${tag}>`;
      }
    };

    add("nombre",          e.nombre);
    add("clase",           e.clase);
    add("tipo",            e.tipo);
    add("descripcion",     e.descripcion);
    add("ubicacion",       e.ubicacion);
    add("horario",         e.horario);
    addBool("gratuito",          e.gratuito);
    addBool("accesibilidad",     e.accesibilidad);
    addBool("tieneDescuento",    e.tieneDescuento);
    addBool("requiereReserva",   e.requiereReserva);
    addBool("patrimonioNacional", e.patrimonioNacional);
    addBool("disponible",        e.disponible);
    addNum("precioNoche",   e.precioNoche);
    addNum("precioDia",     e.precioDia);
    addNum("costoEntrada",  e.costoEntrada);
    addNum("costoAprox",    e.costoAprox);
    add("actividades",     e.actividades);
    add("ingredientes",    e.ingredientes);
    add("ruta",            e.ruta);
    add("epoch",           e.epoch);
    add("frecuencia",      e.frecuencia);
    add("fechaInicio",     e.fechaInicio);
    add("fechaFin",        e.fechaFin);
    add("culturaOrigen",   e.culturaOrigen);
    add("estadoConservacion", e.estadoConservacion);
    add("incluye",         e.incluye);
    add("servicios",       e.servicios);
    if (e.capacidad) add("capacidad", e.capacidad);
    add("nivelConcurrencia", e.nivelConcurrencia);

    owl += `\n  </owl:NamedIndividual>`;
  });

  owl += `\n</rdf:RDF>`;
  return owl;
}

cargarOntologia();
module.exports = { buscar, serializarAOWL, sugerencias, buscarPorPrefijo };