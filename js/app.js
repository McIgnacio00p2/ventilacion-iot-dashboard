// === CONFIGURACIÓN DEL SISTEMA ===
const THINGSPEAK_CHANNEL_ID = "3397586";
const THINGSPEAK_READ_KEY   = "A0VIWKX95SC6X6XQ";

const MQTT_BROKER   = "broker.emqx.io";
const MQTT_PORT     = 8084;
const MQTT_PATH     = "/mqtt";
const MQTT_CLIENT_ID = "web_client_" + Math.random().toString(16).substr(2, 8);

const MQTT_TOPIC_CONTROL = "antartik/mcignacio00p2/ventilador/control";
const MQTT_TOPIC_STATUS  = "antartik/mcignacio00p2/ventilador/status";

let mqttClient;

// 1. INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", () => {
    conectarMQTT();
    cargarHistorialThingSpeak();

    // Escuchar cambios en el selector de filtros para mostrar/ocultar fechas
    const selectFiltro = document.getElementById("select-filtro");
    const contenedorFechas = document.getElementById("contenedor-fechas");

    selectFiltro.addEventListener("change", () => {
        if (selectFiltro.value === "rango") {
            contenedorFechas.classList.remove("d-none");
            // Colocar por defecto la fecha de hoy en los inputs
            const hoyStr = new Date().toISOString().split('T')[0];
            document.getElementById("fecha-inicio").value = hoyStr;
            document.getElementById("fecha-fin").value = hoyStr;
        } else {
            contenedorFechas.classList.add("d-none");
            cargarHistorialThingSpeak(); // Cargar Hoy o Ayer inmediatamente
        }
    });

    // Botón para aplicar filtro de rango de fechas personalizado
    document.getElementById("btn-aplicar-filtro").addEventListener("click", cargarHistorialThingSpeak);

    // Automatización: Refrescar de forma segura cada 15 segundos
    setInterval(() => {
        // Solo refrescar automáticamente en segundo plano si está seleccionado "Hoy"
        if (selectFiltro.value === "hoy") {
            console.log("Actualizando automáticamente datos de Hoy desde ThingSpeak...");
            cargarHistorialThingSpeak();
        }
    }, 15000);

    // Configurar botones de control remoto MQTT
    document.getElementById("btn-on").addEventListener("click", () => enviarComando("ON"));
    document.getElementById("btn-off").addEventListener("click", () => enviarComando("OFF"));
    document.getElementById("btn-auto").addEventListener("click", () => enviarComando("AUTO"));
    
    // Botón manual superior de actualizar tabla
    document.getElementById("btn-refresh-db").addEventListener("click", cargarHistorialThingSpeak);
});

// 2. LÓGICA DE CONEXIÓN MQTT (WEB Sockets)
function conectarMQTT() {
    const badge = document.getElementById("mqtt-status-badge");
    mqttClient = new Paho.MQTT.Client(MQTT_BROKER, Number(MQTT_PORT), MQTT_PATH, MQTT_CLIENT_ID);

    mqttClient.onConnectionLost = (responseObject) => {
        console.log("Conexión MQTT perdida:", responseObject.errorMessage);
        badge.className = "badge bg-danger";
        badge.innerText = "Desconectado";
        setTimeout(conectarMQTT, 5000);
    };

    mqttClient.onMessageArrived = (message) => {
        console.log("Mensaje MQTT recibido:", message.payloadString);
        if (message.destinationName === MQTT_TOPIC_STATUS) {
            procesarEstadoPico(message.payloadString);
        }
    };

    const opciones = {
        useSSL: true,
        onSuccess: () => {
            console.log("✅ Conectado exitosamente al Broker MQTT");
            badge.className = "badge bg-success";
            badge.innerText = "Online (MQTT)";
            mqttClient.subscribe(MQTT_TOPIC_STATUS);
        },
        onFailure: (error) => {
            console.log("❌ Fallo de conexión MQTT:", error.errorMessage);
            badge.className = "badge bg-warning text-dark";
            badge.innerText = "Error de Conexión";
            setTimeout(conectarMQTT, 10000);
        }
    };
    mqttClient.connect(opciones);
}

// 3. ENVIAR COMANDOS A LA PICO W
function enviarComando(comando) {
    if (!mqttClient || !mqttClient.isConnected()) {
        alert("No hay conexión con el servidor MQTT en este momento.");
        return;
    }
    const mensaje = new Paho.MQTT.Message(comando);
    mensaje.destinationName = MQTT_TOPIC_CONTROL;
    mqttClient.send(mensaje);
    console.log(`📤 Comando enviado a la Pico W: ${comando}`);
}

// 4. PROCESAR ESTADO EN TIEMPO REAL
function procesarEstadoPico(payload) {
    const datos = payload.split("|");
    if (datos.length >= 3) {
        const estadoVentilador = datos[0];
        const modoSistema      = datos[1];
        const estadoPir        = datos[2];

        const txtVent = document.getElementById("txt-ventilador");
        txtVent.innerText = estadoVentilador;
        if (estadoVentilador === "ON") {
            txtVent.className = "display-5 my-2 text-success fw-bold";
        } else {
            txtVent.className = "display-5 my-2 text-danger fw-bold";
        }

        const badgeModo = document.getElementById("badge-modo");
        badgeModo.innerText = `Modo: ${modoSistema}`;
        badgeModo.className = modoSistema === "AUTO" ? "badge bg-primary" : "badge bg-warning text-dark";

        const txtPir = document.getElementById("txt-pir");
        const txtPirTiempo = document.getElementById("txt-pir-tiempo");
        if (estadoPir === "1") {
            txtPir.innerText = "DETECTADO";
            txtPir.className = "display-5 my-2 text-danger fw-bold";
            txtPirTiempo.innerText = "Movimiento detectado en tiempo real.";
        } else {
            txtPir.innerText = "CLEAR";
            txtPir.className = "display-5 my-2 text-secondary fw-normal";
            txtPirTiempo.innerText = "Área despejada.";
        }
    }
}

// 5. JALAR HISTORIAL DESDE LA BASE DE DATOS CON FILTROS DINÁMICOS
async function cargarHistorialThingSpeak() {
    const tabla = document.getElementById("tabla-historial");
    const filtro = document.getElementById("select-filtro").value;
    
    // Base de la URL de lectura
    let url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_KEY}`;

    // Funciones internas auxiliares para formatear la fecha estilo ThingSpeak (YYYY-MM-DD)
    const pad = (num) => String(num).padStart(2, '0');
    const formatearAFechaString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Evaluar qué filtros añadir a la query HTTP
    if (filtro === "hoy") {
        const hoy = new Date();
        const fechaStr = formatearAFechaString(hoy);
        url += `&start=${fechaStr}%2000:00:00&end=${fechaStr}%2023:59:59&results=8000`;
    } 
    else if (filtro === "ayer") {
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const fechaStr = formatearAFechaString(ayer);
        url += `&start=${fechaStr}%2000:00:00&end=${fechaStr}%2023:59:59&results=8000`;
    } 
    else if (filtro === "rango") {
        const fechaInicio = document.getElementById("fecha-inicio").value;
        const fechaFin = document.getElementById("fecha-fin").value;
        
        if (!fechaInicio || !fechaFin) {
            alert("Por favor, selecciona una fecha de inicio y una fecha de fin.");
            return;
        }
        url += `&start=${fechaInicio}%2000:00:00&end=${fechaFin}%2023:59:59&results=8000`;
    }

    try {
        tabla.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Buscando registros en la nube...</td></tr>`;
        
        const respuesta = await fetch(url);
        const datos = await respuesta.json();
        const registros = datos.feeds.reverse(); // Mostrar los más nuevos arriba

        if (registros.length === 0) {
            tabla.innerHTML = `<tr><td colspan="3" class="text-center text-warning py-4"><i class="bi bi-exclamation-triangle me-2"></i>No se encontraron datos guardados en el período seleccionado.</td></tr>`;
            return;
        }

        // Mostrar la fecha del registro más reciente del canal en el indicador superior
        const ultimoRegistro = registros[0];
        document.getElementById("txt-cloud-sync").innerText = `Último envío: ${formatearFecha(ultimoRegistro.created_at)}`;

        // Limpiar la tabla y renderizar todas las filas devueltas
        tabla.innerHTML = "";
        registros.forEach(reg => {
            const fila = document.createElement("tr");
            
            const celdaFecha = document.createElement("td");
            celdaFecha.innerText = formatearFecha(reg.created_at);
            
            const celdaVent = document.createElement("td");
            celdaVent.innerHTML = reg.field1 === "1" 
                ? `<span class="badge bg-success-subtle text-success border border-success-subtle">Encendido</span>` 
                : `<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Apagado</span>`;
                
            const celdaPir = document.createElement("td");
            celdaPir.innerHTML = reg.field2 === "1" 
                ? `<span class="text-danger fw-bold"><i class="bi bi-person-exclamation me-1"></i> Movimiento</span>` 
                : `<span class="text-muted">Inactivo</span>`;

            fila.appendChild(celdaFecha);
            fila.appendChild(celdaVent);
            fila.appendChild(celdaPir);
            tabla.appendChild(fila);
        });

    } catch (error) {
        console.error("Error consultando ThingSpeak:", error);
        tabla.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">❌ Error al conectar con la API de ThingSpeak</td></tr>`;
    }
}

function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}