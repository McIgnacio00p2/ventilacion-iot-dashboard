// === CONFIGURACIÓN DEL SISTEMA ===
const THINGSPEAK_CHANNEL_ID = "3397586";
const THINGSPEAK_READ_KEY   = "A0VIWKX95SC6X6XQ";

const MQTT_BROKER   = "broker.emqx.io";
const MQTT_PORT     = 8084;
const MQTT_PATH     = "/mqtt";
const MQTT_CLIENT_ID = "web_client_" + Math.random().toString(16).substr(2, 8);

// Tópicos
const MQTT_TOPIC_CONTROL = "antartik/mcignacio00p2/ventilador/control";
const MQTT_TOPIC_STATUS  = "antartik/mcignacio00p2/ventilador/status";

let mqttClient;

// 1. INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", () => {
    conectarMQTT();
    cargarHistorialThingSpeak();

    const selectFiltro = document.getElementById("select-filtro");
    const contenedorFechas = document.getElementById("contenedor-fechas");

    selectFiltro.addEventListener("change", () => {
        if (selectFiltro.value === "rango") {
            contenedorFechas.classList.remove("d-none");
            
            const ahora = new Date();
            const y = ahora.getFullYear();
            const m = String(ahora.getMonth() + 1).padStart(2, '0');
            const d = String(ahora.getDate()).padStart(2, '0');
            const hoyLocalStr = `${y}-${m}-${d}`;
            
            document.getElementById("fecha-inicio").value = hoyLocalStr;
            document.getElementById("fecha-fin").value = hoyLocalStr;
        } else {
            contenedorFechas.classList.add("d-none");
            cargarHistorialThingSpeak(); 
        }
    });

    document.getElementById("btn-aplicar-filtro").addEventListener("click", cargarHistorialThingSpeak);

    // Automatización: Refrescar cada 15 segundos sólo si se está viendo "Hoy"
    setInterval(() => {
        if (selectFiltro.value === "hoy") {
            console.log("Actualizando datos automáticos de hoy...");
            cargarHistorialThingSpeak();
        }
    }, 15000);

    // Configurar botones de control remoto
    document.getElementById("btn-on").addEventListener("click", () => enviarComando("ON"));
    document.getElementById("btn-off").addEventListener("click", () => enviarComando("OFF"));
    document.getElementById("btn-auto").addEventListener("click", () => enviarComando("AUTO"));
    
    document.getElementById("btn-refresh-db").addEventListener("click", cargarHistorialThingSpeak);
});

// 2. LÓGICA DE CONEXIÓN MQTT
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

// 3. ENVIAR COMANDOS
function enviarComando(command) {
    if (!mqttClient || !mqttClient.isConnected()) {
        alert("No hay conexión con el servidor MQTT en este momento.");
        return;
    }
    const mensaje = new Paho.MQTT.Message(command);
    mensaje.destinationName = MQTT_TOPIC_CONTROL;
    mqttClient.send(mensaje);
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
        txtVent.className = estadoVentilador === "ON" ? "display-5 my-2 text-success fw-bold" : "display-5 my-2 text-danger fw-bold";

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

// 5. JALAR HISTORIAL DESDE LA BASE DE DATOS
async function cargarHistorialThingSpeak() {
    const tabla = document.getElementById("tabla-historial");
    const filtro = document.getElementById("select-filtro").value;
    
    let url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_KEY}`;

    const dateToUTCString = (dateObj) => {
        const y = dateObj.getUTCFullYear();
        const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getUTCDate()).padStart(2, '0');
        const hh = String(dateObj.getUTCHours()).padStart(2, '0');
        const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
        const ss = String(dateObj.getUTCSeconds()).padStart(2, '0');
        return `${y}-${m}-${d}%20${hh}:${mm}:${ss}`;
    };

    if (filtro === "hoy") {
        const start = new Date();
        start.setHours(0, 0, 0, 0); 
        const end = new Date();
        end.setHours(23, 59, 59, 999); 
        
        url += `&start=${dateToUTCString(start)}&end=${dateToUTCString(end)}&results=8000`;
    } 
    else if (filtro === "ayer") {
        const start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0); 
        
        const end = new Date();
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999); 
        
        url += `&start=${dateToUTCString(start)}&end=${dateToUTCString(end)}&results=8000`;
    } 
    else if (filtro === "rango") {
        const fechaInicioVal = document.getElementById("fecha-inicio").value;
        const fechaFinVal = document.getElementById("fecha-fin").value;
        
        if (!fechaInicioVal || !fechaFinVal) {
            alert("Por favor, selecciona un rango válido.");
            return;
        }

        const pInicio = fechaInicioVal.split("-");
        const start = new Date(pInicio[0], pInicio[1] - 1, pInicio[2], 0, 0, 0);

        const pFin = fechaFinVal.split("-");
        const end = new Date(pFin[0], pFin[1] - 1, pFin[2], 23, 59, 59);

        url += `&start=${dateToUTCString(start)}&end=${dateToUTCString(end)}&results=8000`;
    }

    try {
        const respuesta = await fetch(url);
        const datos = await respuesta.json();
        const registros = datos.feeds.reverse();

        if (registros.length === 0) {
            tabla.innerHTML = `<tr><td colspan="3" class="text-center text-warning py-4"><i class="bi bi-exclamation-triangle me-2"></i>No hay registros en el lapso seleccionado.</td></tr>`;
            return;
        }

        // CORRECCIÓN: Validamos de forma segura si la etiqueta existe en el HTML antes de usarla
        const ultimoRegistro = registros[0];
        const txtCloudSync = document.getElementById("txt-cloud-sync");
        if (txtCloudSync) {
            txtCloudSync.innerText = `Último envío: ${formatearFecha(ultimoRegistro.created_at)}`;
        }

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
        tabla.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">❌ Error al conectar con ThingSpeak API</td></tr>`;
    }
}

function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}