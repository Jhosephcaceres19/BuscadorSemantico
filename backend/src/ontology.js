// backend/src/ontology.js
// Motor semántico con rdflib.js - Soporta OWL/RDF-XML

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
    $rdf.parse(contenido, store, "http://localhost:3000/ontology", "application/rdf+xml");
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

  // Booleanos adicionales
  const tieneDescuento = props[BASE + "Tiene_Descuento"] === "true";
  const requiereReserva = props[BASE + "Requiere_Reserva"] === "true";
  const patrimonioNacional = props[BASE + "Patrimonio_Nacional"] === "true";
  const accesibilidad = props[BASE + "Accesibilidad"] === "true";

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
    accesibilidad,
    tieneDescuento,
    requiereReserva,
    patrimonioNacional,
    precioNoche: props[BASE + "Precio_Noche"] ? parseFloat(props[BASE + "Precio_Noche"]) : null,
    precioDia: props[BASE + "Precio_Dia"] ? parseFloat(props[BASE + "Precio_Dia"]) : null,
    costoEntrada: props[BASE + "Costo_Entrada"] ? parseFloat(props[BASE + "Costo_Entrada"]) : null,
    actividades: props[BASE + "Actividades"] || null,
    ingredientes: props[BASE + "Ingredientes"] || null,
    referencias: props._referencias || {}
  };
}

// ── BÚSQUEDA SEMÁNTICA (VERSIÓN COMPLETA CON BOOLEANOS) ─────────
function buscar(q) {
  if (!loaded) cargarOntologia();

  const termino = q.trim().toLowerCase();
  if (!termino) return [];

  const resultados = [];

  // ========================================
  // CASO 1: BÚSQUEDA DE GRATUITOS (true)
  // ========================================
  if (termino === "true" || termino === "gratuito" || termino === "gratuitos") {
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      new $rdf.NamedNode(OWL + "NamedIndividual")
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      const esGratuito = props[BASE + "Gratuito"] === "true" ||
                         (props[BASE + "Costo_Entrada"] && parseFloat(props[BASE + "Costo_Entrada"]) === 0);
      
      if (esGratuito) {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Gratuitos: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 2: DESCUENTO (Tiene_Descuento = true)
  // ========================================
  if (termino === "descuento" || termino === "tiene_descuento") {
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      new $rdf.NamedNode(OWL + "NamedIndividual")
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      if (props[BASE + "Tiene_Descuento"] === "true") {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Con descuento: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 3: REQUIERE_RESERVA (Requiere_Reserva = true)
  // ========================================
  if (termino === "requiere_reserva" || termino === "reserva_obligatoria") {
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      new $rdf.NamedNode(OWL + "NamedIndividual")
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      if (props[BASE + "Requiere_Reserva"] === "true") {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Requieren reserva: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 4: PATRIMONIO_NACIONAL
  // ========================================
  if (termino === "patrimonio_nacional") {
    const clase = new $rdf.NamedNode(BASE + "Atractivo_Cultural_Histórico");
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      clase
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      if (props[BASE + "Patrimonio_Nacional"] === "true") {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Patrimonio nacional: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 5: ACCESIBLE (Accesibilidad = true)
  // ========================================
  if (termino === "accesible" || termino === "accesibilidad") {
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      new $rdf.NamedNode(OWL + "NamedIndividual")
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      if (props[BASE + "Accesibilidad"] === "true") {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Accesibles: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 6: GRATUITO Y ACCESIBLE (combinación)
  // ========================================
  if (termino === "gratuito_accesible") {
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      new $rdf.NamedNode(OWL + "NamedIndividual")
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      const esGratuito = props[BASE + "Gratuito"] === "true" ||
                         (props[BASE + "Costo_Entrada"] && parseFloat(props[BASE + "Costo_Entrada"]) === 0);
      const esAccesible = props[BASE + "Accesibilidad"] === "true";
      
      if (esGratuito && esAccesible) {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Gratuitos y accesibles: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 7: PRODUCTOS ALIMENTICIOS (PLATOS TÍPICOS)
  // ========================================
  if (termino === "producto alimenticio" || termino === "producto_alimenticio" || 
      termino === "plato típico" || termino === "comida típica" ||
      termino === "gastronomía") {
    
    const productoAlimenticio = new $rdf.NamedNode(BASE + "Producto_Alimenticio");
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      productoAlimenticio
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      resultados.push({
        id: individuo.value,
        propiedades: props
      });
    }
    
    console.log(`🔍 Productos alimenticios: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 8: BÚSQUEDA POR CLASE ESPECÍFICA
  // ========================================
  const clasesMap = {
    "museo": "Atractivo_Cultural_Histórico",
    "hospedaje": "Hospedaje",
    "evento": "Evento_Turístico",
    "natural": "Atractivo_Natural",
    "recreativo": "Atractivo_Recreativo",
    "arqueológico": "Atractivo_Arqueológico",
    "transporte": "Transporte",
    "restaurante": "Establecimiento_Gastronomico",
    "iglesia": "Atractivo_Cultural_Histórico",
    "parque": "Atractivo_Natural",
    "laguna": "Atractivo_Natural",
    "mirador": "Atractivo_Recreativo",
    "monumento": "Atractivo_Cultural_Histórico"
  };

  if (clasesMap[termino]) {
    const claseUri = BASE + clasesMap[termino];
    const clase = new $rdf.NamedNode(claseUri);
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      clase
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      // Filtro adicional para parques
      if (termino === "parque") {
        const nombre = props[BASE + "Nombre"] || "";
        const tipo = props[BASE + "Tipo_Ecosistema"] || "";
        if (nombre.toLowerCase().includes("parque") || tipo.toLowerCase().includes("parque")) {
          resultados.push({
            id: individuo.value,
            propiedades: props
          });
        }
      }
      // Filtro para lagunas
      else if (termino === "laguna") {
        const tipo = props[BASE + "Tipo_Ecosistema"] || "";
        if (tipo.toLowerCase().includes("laguna") || tipo.toLowerCase().includes("lago")) {
          resultados.push({
            id: individuo.value,
            propiedades: props
          });
        }
      }
      // Filtro para miradores
      else if (termino === "mirador") {
        const tipo = props[BASE + "Tipo_Recreacion"] || "";
        if (tipo.toLowerCase().includes("mirador")) {
          resultados.push({
            id: individuo.value,
            propiedades: props
          });
        }
      }
      // Filtro para iglesias
      else if (termino === "iglesia") {
        const tipoPatrimonio = props[BASE + "Tipo_Patrimonio"] || "";
        const nombre = props[BASE + "Nombre"] || "";
        if (tipoPatrimonio.toLowerCase().includes("religiosa") ||
            nombre.toLowerCase().includes("iglesia") ||
            nombre.toLowerCase().includes("catedral") ||
            nombre.toLowerCase().includes("templo")) {
          resultados.push({
            id: individuo.value,
            propiedades: props
          });
        }
      }
      // Filtro para monumentos
      else if (termino === "monumento") {
        const tipoPatrimonio = props[BASE + "Tipo_Patrimonio"] || "";
        const patrimonioNacional = props[BASE + "Patrimonio_Nacional"] === "true";
        if (patrimonioNacional || tipoPatrimonio.includes("Monumento") ||
            tipoPatrimonio.includes("Histórico")) {
          resultados.push({
            id: individuo.value,
            propiedades: props
          });
        }
      }
      else {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Clase ${clasesMap[termino]}: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 9: TODOS LOS ATRACTIVOS TURÍSTICOS
  // ========================================
  if (termino === "atractivo_turistico" || termino === "todos" || termino === "") {
    const clase = new $rdf.NamedNode(BASE + "Atractivo_Turistico");
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      clase
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      resultados.push({
        id: individuo.value,
        propiedades: props
      });
    }
    
    // También agregar servicios turísticos
    const servicios = ["Hospedaje", "Establecimiento_Gastronomico", "Evento_Turístico", "Transporte"];
    for (const servicio of servicios) {
      const claseServicio = new $rdf.NamedNode(BASE + servicio);
      const individuosServicio = store.statementsMatching(
        null,
        new $rdf.NamedNode(RDF + "type"),
        claseServicio
      );
      for (const st of individuosServicio) {
        const individuo = st.subject;
        const props = obtenerPropiedades(individuo);
        if (!resultados.some(r => r.id === individuo.value)) {
          resultados.push({
            id: individuo.value,
            propiedades: props
          });
        }
      }
    }
    
    console.log(`🔍 Todos los atractivos turísticos: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 10: FERIAS ARTESANALES
  // ========================================
  if (termino === "feria artesanal" || termino === "artesanía" || termino === "la cancha") {
    const clase = new $rdf.NamedNode(BASE + "Evento_Turístico");
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      clase
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      const tipo = props[BASE + "Tipo_Evento"] || "";
      const nombre = props[BASE + "Nombre"] || "";
      
      if (tipo.toLowerCase().includes("feria") || nombre.toLowerCase().includes("feria")) {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Ferias artesanales: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 11: ALTA CONCURRENCIA
  // ========================================
  if (termino === "concurrencia_alto" || termino === "concurrencia alto" || 
      termino === "más visitados") {
    const individuos = store.statementsMatching(
      null,
      new $rdf.NamedNode(RDF + "type"),
      new $rdf.NamedNode(OWL + "NamedIndividual")
    );

    for (const st of individuos) {
      const individuo = st.subject;
      const props = obtenerPropiedades(individuo);
      
      if (props[BASE + "Nivel_Concurrencia"] === "Alto") {
        resultados.push({
          id: individuo.value,
          propiedades: props
        });
      }
    }
    
    console.log(`🔍 Alta concurrencia: ${resultados.length} resultados`);
    return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
  }

  // ========================================
  // CASO 12: BÚSQUEDA POR TEXTO LIBRE
  // ========================================
  const rdfType = new $rdf.NamedNode(RDF + "type");
  const owlNamedIndividual = new $rdf.NamedNode(OWL + "NamedIndividual");
  const individuos = store.statementsMatching(null, rdfType, owlNamedIndividual);

  for (const st of individuos) {
    const individuo = st.subject;
    const props = obtenerPropiedades(individuo);

    let coincide = false;

    if (props[BASE + "Nombre"] && props[BASE + "Nombre"].toLowerCase().includes(termino))
      coincide = true;

    if (!coincide && props[BASE + "Descripcion"] && props[BASE + "Descripcion"].toLowerCase().includes(termino))
      coincide = true;

    if (!coincide && props[BASE + "Ubicacion"] && props[BASE + "Ubicacion"].toLowerCase().includes(termino))
      coincide = true;

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

    if (coincide) {
      resultados.push({
        id: individuo.value,
        propiedades: props
      });
    }
  }

  console.log(`🔍 Texto libre "${termino}": ${resultados.length} resultados`);
  return resultados.map(ent => normalizarEntidad(ent.id, ent.propiedades));
}

// ── Serializar a OWL/RDF-XML ──────────────────────────────
function serializarAOWL(entidades, termino) {
  if (!entidades || !Array.isArray(entidades)) {
    entidades = [];
  }
  
  let owl = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  
  <owl:NamedIndividual rdf:about="#Consulta_${Date.now()}">
    <rdf:type rdf:resource="#ResultadoConsulta"/>
    <terminoBusqueda>${escapeXml(termino || "")}</terminoBusqueda>
    <totalResultados rdf:datatype="xsd:integer">${entidades.length}</totalResultados>
    <fechaConsulta rdf:datatype="xsd:dateTime">${new Date().toISOString()}</fechaConsulta>
  </owl:NamedIndividual>`;

  if (entidades.length === 0) {
    owl += `
  
  <owl:NamedIndividual rdf:about="#SinResultados">
    <rdf:type rdf:resource="#ResultadoBusqueda"/>
    <nombre>No se encontraron resultados</nombre>
    <descripcion>Intenta con otro término de búsqueda</descripcion>
  </owl:NamedIndividual>`;
  }

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
    if (entidad.gratuito !== null && entidad.gratuito !== undefined) 
      owl += `\n    <gratuito rdf:datatype="xsd:boolean">${entidad.gratuito}</gratuito>`;
    if (entidad.accesibilidad !== null && entidad.accesibilidad !== undefined) 
      owl += `\n    <accesibilidad rdf:datatype="xsd:boolean">${entidad.accesibilidad}</accesibilidad>`;
    if (entidad.tieneDescuento !== null && entidad.tieneDescuento !== undefined) 
      owl += `\n    <tieneDescuento rdf:datatype="xsd:boolean">${entidad.tieneDescuento}</tieneDescuento>`;
    if (entidad.requiereReserva !== null && entidad.requiereReserva !== undefined) 
      owl += `\n    <requiereReserva rdf:datatype="xsd:boolean">${entidad.requiereReserva}</requiereReserva>`;
    if (entidad.patrimonioNacional !== null && entidad.patrimonioNacional !== undefined) 
      owl += `\n    <patrimonioNacional rdf:datatype="xsd:boolean">${entidad.patrimonioNacional}</patrimonioNacional>`;
    if (entidad.precioNoche !== null && entidad.precioNoche !== undefined) 
      owl += `\n    <precioNoche rdf:datatype="xsd:float">${entidad.precioNoche}</precioNoche>`;
    if (entidad.precioDia !== null && entidad.precioDia !== undefined) 
      owl += `\n    <precioDia rdf:datatype="xsd:float">${entidad.precioDia}</precioDia>`;
    if (entidad.costoEntrada !== null && entidad.costoEntrada !== undefined) 
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