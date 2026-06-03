// backend/src/server.js
// Servidor Express con respuestas en OWL/RDF-XML + endpoint de sugerencias
// VERSIÓN COMPLETA CON BÚSQUEDA EN TIEMPO REAL

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const ontology = require("./ontology");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: "https://buscador-semantico.vercel.app"
}));

// // Servir archivos estáticos del frontend
// const frontendPath = path.join(__dirname, "../../frontend");
// console.log(`📁 Sirviendo estáticos desde: ${frontendPath}`);
// app.use(express.static(frontendPath));

// // Ruta raíz
// app.get("/", (req, res) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });
app.get("/",(req, res) =>{
  res.send("API corriendo en render")
})

// ─── API: Búsqueda semántica → OWL/RDF-XML ───────────────────────────────────
app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").trim();
  console.log(`\n📥 /api/search?q="${q}"`);

  if (!q) {
    res.setHeader("Content-Type", "application/rdf+xml; charset=utf-8");
    return res.status(400).send(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  <owl:NamedIndividual rdf:about="#Error">
    <mensaje>El parámetro 'q' es requerido.</mensaje>
  </owl:NamedIndividual>
</rdf:RDF>`);
  }

  try {
    const resultados   = ontology.buscar(q);
    const owlResponse  = ontology.serializarAOWL(resultados, q);
    res.setHeader("Content-Type", "application/rdf+xml; charset=utf-8");
    res.status(200).send(owlResponse);
  } catch (err) {
    console.error("❌ Error en búsqueda:", err);
    res.setHeader("Content-Type", "application/rdf+xml; charset=utf-8");
    res.status(500).send(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  <owl:NamedIndividual rdf:about="#Error">
    <mensaje>Error interno del servidor.</mensaje>
  </owl:NamedIndividual>
</rdf:RDF>`);
  }
});

// ─── NUEVO API: Búsqueda por prefijo (tiempo real) → OWL/RDF-XML ─────────────
app.get("/api/search-prefix", (req, res) => {
  const q = (req.query.q || "").trim();
  console.log(`\n⚡ /api/search-prefix?q="${q}" (búsqueda en tiempo real)`);

  if (!q || q.length < 2) {
    res.setHeader("Content-Type", "application/rdf+xml; charset=utf-8");
    return res.status(200).send(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  <owl:NamedIndividual rdf:about="#SinResultados">
    <nombre>No se encontraron resultados</nombre>
    <totalResultados rdf:datatype="xsd:integer">0</totalResultados>
  </owl:NamedIndividual>
</rdf:RDF>`);
  }

  try {
    const resultados   = ontology.buscarPorPrefijo(q);
    const owlResponse  = ontology.serializarAOWL(resultados, q);
    res.setHeader("Content-Type", "application/rdf+xml; charset=utf-8");
    res.status(200).send(owlResponse);
  } catch (err) {
    console.error("❌ Error en búsqueda por prefijo:", err);
    res.setHeader("Content-Type", "application/rdf+xml; charset=utf-8");
    res.status(500).send(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  <owl:NamedIndividual rdf:about="#Error">
    <mensaje>Error interno del servidor.</mensaje>
  </owl:NamedIndividual>
</rdf:RDF>`);
  }
});

// ─── API: Sugerencias de autocompletado → JSON ───────────────────────────────
app.get("/api/suggest", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q || q.length < 2) return res.json([]);
  try {
    const sugs = ontology.sugerencias(q);
    res.json(sugs);
  } catch (err) {
    console.error("❌ Error en sugerencias:", err);
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Servidor en http://localhost:${PORT}`);
  console.log(`📡 OWL/RDF-XML activo`);
  console.log(`⚡ Búsqueda en tiempo real: /api/search-prefix?q=...`);
  console.log(`💡 Sugerencias en /api/suggest?q=...`);
  console.log(`🌐 Soporte bilingüe: Español e Inglés`);
});