// Variables globales
let estadoActual = {
    ventilador: 'OFF',
    modo: 'AUTO',
    pir: 0,
    timestamp: Date.now()
};

let estadisticas = {
    activacionesHoy: 0,
    tiempoActivo: 0,
    ultimaDeteccion: null
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    initializeApp();
});

async function initializeApp() {
    // Mostrar loading screen
    showLoading();
    
    // Conectar MQTT
    try {
        await mqttManager.connect();
        hideLoading();
        updateTime();
        setInterval(updateTime, 1000);
        initializeChart();
    } catch (error) {
        console.error('Error de inicialización:', error);
        hideLoading();
        showError('Error al conectar con el sistema IoT');
    }
}

function showLoading() {
    document.getElementById('loading-screen').classList.remove('hidden');
}

function hideLoading() {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1500);
}

function showError(message) {
    document.getElementById('loading-screen').innerHTML = `
        <div class="loader">
            <div class="loader-icon">⚠️</div>
            <div class="loader-text">${message}</div>
            <button onclick="location.reload()" style="padding:10px 20px; margin-top:20px; background:white; border:none; border-radius:8px; cursor:pointer;">
                Reintentar
            </button>
        </div>
    `;
}

function updateTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = 
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const mqttStatus = document.getElementById('mqtt-status');
    
    if (connected) {
        dot.className = 'status-dot connected';
        text.textContent = 'Conectado';
        mqttStatus.textContent = '✅ Conectado al sistema IoT';
    } else {
        dot.className = 'status-dot disconnected';
        text.textContent = 'Desconectado';
        mqttStatus.textContent = '❌ Desconectado - Reintentando...';
    }
}

function handleMQTTMessage(topic, message) {
    // Formato: "ON|MANUAL|timestamp" o "OFF|AUTO|timestamp"
    const partes = message.split('|');
    
    if (partes.length >= 2) {
        estadoActual.ventilador = partes[0];
        estadoActual.modo = partes[1];
        estadoActual.timestamp = parseInt(partes[2]) || Date.now();
        
        // Actualizar PIR simulado basado en modo auto
        if (estadoActual.modo === 'AUTO') {
            estadoActual.pir = estadoActual.ventilador === 'ON' ? 1 : 0;
        }
        
        updateDashboard();
        updateChartData();
    }
}

function controlManual(comando) {
    const btn = document.getElementById(`btn-${comando.toLowerCase()}`);
    
    if (btn) {
        btn.disabled = true;
        setTimeout(() => { btn.disabled = false; }, 1000);
    }
    
    if (mqttManager.publish(MQTT_CONFIG.topics.control, comando)) {
        // Feedback visual inmediato
        if (comando === 'ON') {
            estadoActual.ventilador = 'ON';
            estadoActual.modo = 'MANUAL';
        } else if (comando === 'OFF') {
            estadoActual.ventilador = 'OFF';
            estadoActual.modo = 'MANUAL';
        } else if (comando === 'AUTO') {
            estadoActual.modo = 'AUTO';
        }
        updateDashboard();
    }
}

function updateDashboard() {
    // Actualizar ventilador
    const ventiladorAnim = document.getElementById('ventilador-animation');
    const ventiladorBadge = document.getElementById('ventilador-badge');
    const ventiladorEstado = document.getElementById('ventilador-estado');
    const ventiladorModo = document.getElementById('ventilador-modo');
    
    if (estadoActual.ventilador === 'ON') {
        ventiladorAnim.className = 'ventilador-animation on';
        ventiladorBadge.className = 'badge badge-on';
        ventiladorBadge.textContent = 'ENCENDIDO';
        ventiladorEstado.textContent = 'Encendido';
        ventiladorEstado.style.color = '#48bb78';
    } else {
        ventiladorAnim.className = 'ventilador-animation off';
        ventiladorBadge.className = 'badge badge-off';
        ventiladorBadge.textContent = 'APAGADO';
        ventiladorEstado.textContent = 'Apagado';
        ventiladorEstado.style.color = '#a0aec0';
    }
    
    ventiladorModo.textContent = estadoActual.modo === 'AUTO' ? 'Automático' : 'Manual';
    
    // Actualizar PIR
    const pirVisual = document.getElementById('pir-visual');
    const pirBadge = document.getElementById('pir-badge');
    const pirEstado = document.getElementById('pir-estado');
    
    if (estadoActual.pir === 1) {
        pirVisual.className = 'pir-visual active';
        pirBadge.className = 'badge badge-active';
        pirBadge.textContent = 'PRESENCIA';
        pirEstado.textContent = 'Movimiento detectado';
        pirEstado.style.color = '#48bb78';
        
        estadisticas.ultimaDeteccion = new Date();
        estadisticas.activacionesHoy++;
        document.getElementById('ultima-deteccion').textContent = 
            estadisticas.ultimaDeteccion.toLocaleTimeString('es-ES');
    } else {
        pirVisual.className = 'pir-visual inactive';
        pirBadge.className = 'badge badge-inactive';
        pirBadge.textContent = 'SIN PRESENCIA';
        pirEstado.textContent = 'Sin movimiento';
        pirEstado.style.color = '#a0aec0';
    }
    
    // Actualizar estadísticas
    document.getElementById('activaciones-hoy').textContent = estadisticas.activacionesHoy;
    document.getElementById('stat-activaciones').textContent = estadisticas.activacionesHoy;
    
    if (estadoActual.ventilador === 'ON') {
        estadisticas.tiempoActivo += 5; // 5 segundos por actualización
    }
    document.getElementById('tiempo-activo').textContent = 
        Math.round(estadisticas.tiempoActivo / 60) + ' min';
    document.getElementById('stat-tiempo').textContent = 
        Math.round(estadisticas.tiempoActivo / 60) + 'm';
}