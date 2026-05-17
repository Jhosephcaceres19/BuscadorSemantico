// 1. Seleccionar los elementos del DOM mediante sus IDs
const inputBusqueda = document.getElementById('searchInput');
const btnBuscar = document.getElementById('searchBtn');

// URL base de tu backend Express
const BASE_URL = 'http://localhost:3000/api/search';

// 2. Función asíncrona principal que realiza la petición Fetch
async function realizarBusqueda() {
    const termino = inputBusqueda.value.trim(); // Obtener el valor actual y limpiar espacios

    // Validación básica para no enviar búsquedas vacías
    if (termino === "") {
        alert("Por favor, ingresa un término de búsqueda.");
        return;
    }

    console.log(`Enviando petición al servidor para: "${termino}"`);

    try {
        // 3. Utilizar fetch() asíncrono enviando el término como parámetro 'q'
        // encodeURIComponent se asegura de formatear correctamente caracteres especiales o espacios en la URL
        const urlCompleta = `${BASE_URL}?q=${encodeURIComponent(termino)}`;
        const response = await fetch(urlCompleta);

        // Verificar si la respuesta del servidor fue exitosa (código 200-299)
        if (!response.ok) {
            throw new Error(`Error en la petición: ${response.status}`);
        }

        // 4. Transformar la respuesta cruda en un objeto JSON
        const data = await response.json();

        // CRITERIO DE ACEPTACIÓN: Imprimir momentáneamente la respuesta por consola
        console.log("Respuesta JSON recibida con éxito desde el servidor:", data);

    } catch (error) {
        console.error("Hubo un problema al conectar con el servidor backend:", error);
    }
}

// 5. CAPTURA DE EVENTOS

// Evento Click en el botón de búsqueda
btnBuscar.addEventListener('click', realizarBusqueda);

// Evento de presionar la tecla "Enter" dentro del input
inputBusqueda.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        realizarBusqueda();
    }
});