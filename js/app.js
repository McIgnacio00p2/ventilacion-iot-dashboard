const firebaseConfig = {
    apiKey: "AIzaSyBTwlWjKWyJSEQZc4Os8XqH6OrugwLtBaI",
    authDomain: "antartik-air.firebaseapp.com",
    projectId: "antartik-air",
    storageBucket: "antartik-air.firebasestorage.app",
    messagingSenderId: "467017991469",
    appId: "1:467017991469:web:607ec98b1b25e4db1b3fa4"
};
// Parametrización de ThingSpeak IoT API
const THINGSPEAK_CHANNEL_ID = "3397586";
const THINGSPEAK_READ_KEY   = "A0VIWKX95SC6X6XQ";

// Configuración del Broker MQTT mediante WebSockets Seguros
const MQTT_BROKER   = "broker.emqx.io";
const MQTT_PORT     = 8084;
const MQTT_PATH     = "/mqtt";
const MQTT_CLIENT_ID = "web_client_" + Math.random().toString(16).substr(2, 8);

// Tópicos de comunicación remota con la Raspberry Pi Pico W
const MQTT_TOPIC_CONTROL = "antartik/mcignacio00p2/ventilador/control";
const MQTT_TOPIC_STATUS  = "antartik/mcignacio00p2/ventilador/status";

// Inicialización de las instancias de Firebase (Arquitectura Serverless)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

let mqttClient;

// =============================================================================
// 2. CICLO DE VIDA DE LA APP Y MANEJO DE SESIONES (FASE 5: SEGURIDAD)
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
    
    // Listener reactivo al estado de autenticación del usuario
    auth.onAuthStateChanged((user) => {
        const loginContainer = document.getElementById("login-container");
        const dashboardContainer = document.getElementById("dashboard-container");
        const btnLogout = document.getElementById("btn-logout");

        if (user) {
            // Usuario validado -> Transición visual y apertura de sockets
            loginContainer.classList.add("d-none");
            dashboardContainer.classList.remove("d-none");
            btnLogout.classList.remove("d-none");

            if (!mqttClient || !mqttClient.isConnected()) {
                conectarMQTT();
            }
            cargarHistorialThingSpeak();
            escucharAccionesFirestore(); // Iniciar stream en tiempo real de auditoría
        } else {
            // Usuario desautenticado -> Bloqueo preventivo de la interfaz
            loginContainer.classList.remove("d-none");
            dashboardContainer.classList.add("d-none");
            btnLogout.classList.add("d-none");

            if (mqttClient && mqttClient.isConnected()) {
                mqttClient.disconnect();
            }
        }
    });

    // Evento de inicio de sesión manual (Firebase Auth)
    document.getElementById("form-login").addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const errorDiv = document.getElementById("login-error");

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                errorDiv.classList.add("d-none");
            })
            .catch((error) => {
                console.error("Error de acceso:", error.message);
                errorDiv.classList.remove("d-none");
            });
    });

    // Evento para cierre definitivo de sesión
    document.getElementById("btn-logout").addEventListener("click", () => {
        auth.signOut();
    });

    // =============================================================================
    // LÓGICA DE FILTROS E INTERFAZ DEL DASHBOARD
    // =============================================================================
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
            if (auth.currentUser) cargarHistorialThingSpeak(); 
        }
    });

    document.getElementById("btn-aplicar-filtro").addEventListener("click", cargarHistorialThingSpeak);

    // Automatización de refresco de telemetría cada 15 segundos
    setInterval(() => {
        if (selectFiltro.value === "hoy" && auth.currentUser) {
            cargarHistorialThingSpeak();
        }
    }, 15000);

    // Mapeo de clics a la lógica CRUD y MQTT
    document.getElementById("btn-on").addEventListener("click", () => enviarComando("ON"));
    document.getElementById("btn-off").addEventListener("click", () => enviarComando("OFF"));
    document.getElementById("btn-auto").addEventListener("click", () => enviarComando("AUTO"));
    document.getElementById("btn-refresh-db").addEventListener("click", cargarHistorialThingSpeak);
});

// =============================================================================
// 3. COMUNICACIÓN MQTT (TELEMETRÍA EN TIEMPO REAL)
// =============================================================================

function conectarMQTT() {
    const badge = document.getElementById("mqtt-status-badge");
    mqttClient = new Paho.MQTT.Client(MQTT_BROKER, Number(MQTT_PORT), MQTT_PATH, MQTT_CLIENT_ID);

    mqttClient.onConnectionLost = (responseObject) => {
        console.warn("Conexión MQTT interrumpida:", responseObject.errorMessage);
        badge.className = "badge bg-danger";
        badge.innerText = "Desconectado";
        if (auth.currentUser) setTimeout(conectarMQTT, 5000);
    };

    mqttClient.onMessageArrived = (message) => {
        if (message.destinationName === MQTT_TOPIC_STATUS) {
            procesarEstadoPico(message.payloadString);
        }
    };

    const opciones = {
        useSSL: true,
        onSuccess: () => {
            badge.className = "badge bg-success";
            badge.innerText = "Online (MQTT)";
            mqttClient.subscribe(MQTT_TOPIC_STATUS);
        },
        onFailure: (error) => {
            badge.className = "badge bg-warning text-dark";
            badge.innerText = "Error de Conexión";
            if (auth.currentUser) setTimeout(conectarMQTT, 10000);
        }
    };
    mqttClient.connect(opciones);
}

// =============================================================================
// 4. FASE 4: OPERACIONES CRUD EN LA NUBE (CREATE & READ)
// =============================================================================

// --- OPERACIÓN: CREATE (Escritura en Firestore) ---
function enviarComando(command) {
    if (!mqttClient || !mqttClient.isConnected()) {
        alert("Sin conexión establecida con el Broker MQTT.");
        return;
    }
    
    // 1. Envío físico del payload a la Raspberry Pi por protocolo MQTT
    const mensaje = new Paho.MQTT.Message(command);
    mensaje.destinationName = MQTT_TOPIC_CONTROL;
    mqttClient.send(mensaje);

    // 2. Persistencia en la nube: Guardar acción estructurada con el usuario actual
    const usuarioActual = auth.currentUser;
    if (usuarioActual) {
        db.collection("historial_acciones").add({
            usuario: usuarioActual.email,
            accion: command,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => console.log("✔ Evento registrado en Firestore (Operación CREATE exitosa)."))
        .catch(err => console.error("Error de persistencia cloud:", err));
    }
}

// --- OPERACIÓN: READ (Escucha activa / Stream en tiempo real) ---
function escucharAccionesFirestore() {
    const tablaCloud = document.getElementById("tabla-acciones-cloud");
    if (!tablaCloud) return;

    db.collection("historial_acciones")
        .orderBy("fecha", "desc")
        .limit(10)
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                // Ajustamos el colspan a 4 debido a la nueva columna
                tablaCloud.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No hay comandos en la nube.</td></tr>`;
                return;
            }

            tablaCloud.innerHTML = "";
            snapshot.forEach((doc) => {
                const data = doc.data();
                const fila = document.createElement("tr");

                // Columna 1: Fecha
                const celdaFecha = document.createElement("td");
                const fechaObj = data.fecha ? data.fecha.toDate() : new Date();
                celdaFecha.innerText = fechaObj.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

                // Columna 2: Usuario
                const celdaUsuario = document.createElement("td");
                const nombreCorto = data.usuario ? data.usuario.split("@")[0] : "Desconocido";
                celdaUsuario.innerHTML = `<span class="text-dark fw-medium"><i class="bi bi-person me-1"></i>${nombreCorto}</span>`;

                // Columna 3: Comando (Badge)
                const celdaAccion = document.createElement("td");
                let badgeClass = "bg-secondary";
                if (data.accion === "ON") badgeClass = "bg-success";
                if (data.accion === "OFF") badgeClass = "bg-danger";
                if (data.accion === "AUTO") badgeClass = "bg-primary";
                celdaAccion.innerHTML = `<span class="badge ${badgeClass} px-2.5 py-1.5 fw-bold shadow-sm">${data.accion}</span>`;

                // Columna 4: NUEVA CELDA CON BOTÓN DE ELIMINAR (DELETE)
                const celdaEliminar = document.createElement("td");
                celdaEliminar.className = "text-center";
                celdaEliminar.innerHTML = `
                    <button class="btn btn-sm btn-outline-danger border-0 py-1 px-2" onclick="eliminarComandoCloud('${doc.id}')" title="Eliminar registro">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                `;

                fila.appendChild(celdaFecha);
                fila.appendChild(celdaUsuario);
                fila.appendChild(celdaAccion);
                fila.appendChild(celdaEliminar);
                tablaCloud.appendChild(fila);
            });
        }, (error) => {
            console.error("Fallo crítico en escucha reactiva Firestore:", error);
            tablaCloud.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">❌ Error de permisos o índice</td></tr>`;
        });
}

// --- OPERACIÓN: DELETE ---
function eliminarComandoCloud(docId) {
    if (confirm("¿Estás seguro de que deseas eliminar este registro de auditoría en la nube?")) {
        db.collection("historial_acciones").doc(docId).delete()
            .then(() => {
                console.log("✔ Registro eliminado de Firestore (Operación DELETE exitosa).");
            })
            .catch((error) => {
                console.error("Error al intentar eliminar el documento de la nube:", error);
                alert("No tienes permisos suficientes para borrar este registro.");
            });
    }
}

// =============================================================================
// 5. PARSEO DE PROTOCOLO E HISTORIAL DE SENSORES (THINGSPEAK)
// =============================================================================

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
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        url += `&start=${dateToUTCString(start)}&end=${dateToUTCString(end)}&results=8000`;
    } 
    else if (filtro === "ayer") {
        const start = new Date(); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999);
        url += `&start=${dateToUTCString(start)}&end=${dateToUTCString(end)}&results=8000`;
    } 
    else if (filtro === "rango") {
        const fechaInicioVal = document.getElementById("fecha-inicio").value;
        const fechaFinVal = document.getElementById("fecha-fin").value;
        if (!fechaInicioVal || !fechaFinVal) return;

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

        document.getElementById("txt-cloud-sync").innerText = `Último envío: ${formatearFecha(registros[0].created_at)}`;
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
        console.error("Fallo consultando ThingSpeak API:", error);
        tabla.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">❌ Error al conectar con ThingSpeak API</td></tr>`;
    }
}

function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}