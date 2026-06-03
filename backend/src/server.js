// backend/src/server.js
// Servidor Express con respuestas en OWL/RDF-XML

const express = require("express");
const cors = require("cors");
const path = require("path");
const ontology = require("./ontology");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: "https://tu_frontend_vercel"
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
  res.send("API corriendo")
})

// API de búsqueda - Respuesta en OWL/RDF-XML
app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").trim();

  console.log(`🔍 Término de búsqueda recibido: "${q}"`);

  // Error: término vacío
  if (!q) {
    res.setHeader('Content-Type', 'application/rdf+xml; charset=utf-8');
    return res.status(400).send(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns="http://www.semanticweb.org/sarzuri/ontologies/2026/2/turismo-cochabamba#">
  <owl:NamedIndividual rdf:about="#Error">
    <rdf:type rdf:resource="#Error"/>
    <mensaje>El parámetro 'q' es requerido.</mensaje>
  </owl:NamedIndividual>
</rdf:RDF>`);
  }

  // Ejecutar búsqueda semántica
  const resultados = ontology.buscar(q);

  // Serializar resultados a OWL/RDF-XML
  const owlResponse = ontology.serializarAOWL(resultados, q);
  
  res.setHeader('Content-Type', 'application/rdf+xml; charset=utf-8');
  res.status(200).send(owlResponse);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor semántico corriendo en http://localhost:${PORT}`);
  console.log(`📖 Ontología fuente: OWL/RDF-XML (TurismoLocal.owl)`);
  console.log(`📡 Formato de respuesta: OWL/RDF-XML (application/rdf+xml)`);
  console.log(`🌐 Frontend disponible en http://localhost:${PORT}`);
});