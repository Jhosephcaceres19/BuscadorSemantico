// backend/src/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const ontology = require("./ontology");

const app = express();
const PORT = 3000;

// ── Middlewares ──────────────────────────────────────────
app.use(cors());

// IMPORTANTE: No usar express.json() - Solo aceptamos Turtle
// Middleware para asegurar respuestas Turtle
app.use((req, res, next) => {
  // Solo para rutas que no son archivos estáticos
  if (!req.path.includes('.') && req.path !== '/') {
    res.setHeader('Content-Type', 'text/turtle; charset=utf-8');
  }
  next();
});

// ── Servir archivos estáticos ────────────────────────────
// Opción 1: Ruta absoluta (más confiable)
const frontendPath = path.join(__dirname, "../../frontend");
console.log(`📁 Sirviendo estáticos desde: ${frontendPath}`);

app.use(express.static(frontendPath));

// Opción 2: Redirigir raíz a index.html explícitamente
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ── GET /api/search?q=<término> ──────────────────────────
app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").trim();

  console.log(`🔍 Término de búsqueda recibido: "${req.query.q}"`);

  if (!q) {
    res.setHeader('Content-Type', 'text/turtle; charset=utf-8');
    return res.status(400).send(`
@prefix : <http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:error rdf:type :Error ;
    :mensaje "El parámetro 'q' es requerido." .
`);
  }

  // Ejecutar búsqueda semántica
  const resultados = ontology.buscar(q);

  // Serializar resultados a Turtle
  const turtleResponse = ontology.serializarATurtle(resultados);
  
  // Agregar metadatos de la consulta
  const turtleConMetadata = `
@prefix : <http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:consulta rdf:type :ResultadoConsulta ;
    :terminoBusqueda "${q}" ;
    :totalResultados "${resultados.length}"^^xsd:integer .

${turtleResponse}`;

  res.setHeader('Content-Type', 'text/turtle; charset=utf-8');
  res.status(200).send(turtleConMetadata);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor semántico corriendo en http://localhost:${PORT}`);
  console.log(`📡 Respuestas en formato Turtle (text/turtle)`);
  console.log(`🌐 Frontend disponible en http://localhost:${PORT}`);
});