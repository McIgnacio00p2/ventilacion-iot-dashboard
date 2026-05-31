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
    ultimaDeteccion: null,
    actividadReciente: []
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    showLoading();
    
    // Inicializar Particles.js
    initParticles();
    
    // Inicializar AOS
    AOS.init({
        duration: 800,
        easing: 'ease-out-cubic',
        once: true
    });
    
    // Inicializar gráficos
    dashboardCharts.initializeAll();
    
    // Conectar MQTT
    try {
        await mqttManager.connect();
        hideLoading();
        initializeNavigation();
        updateDateTime();
        setInterval(updateDateTime, 1000);
        setInterval(() => dashboardCharts.updateMiniCharts(), 5000);
    } catch (error) {
        console.error('Error de inicialización:', error);
        hideLoading();
        showError('Error al conectar con el sistema IoT');
    }
}

function initParticles() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 50, density: { enable: true, value_area: 800 } },
            color: { value: '#667eea' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            line_linked: {
                enable: true,
                distance: 150,
                color: '#667eea',
                opacity: 0.2,
                width: 1
            },
            move: {
                enable: true,
                speed: 2,
                direction: 'none',
                random: true,
                straight: false,
                out_mode: 'out'
            }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: { enable: true, mode: 'grab' },
                onclick: { enable: true, mode: 'push' },
                resize: true
            }
        },
        retina_detect: true
    });
}

function initializeNavigation() {
    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            // Actualizar menu
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Mostrar sección
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}-section`).classList.add('active');
        });
    });
    
    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });
    
    // Time range buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Aquí puedes filtrar los datos según el rango
        });
    });
}

function updateDateTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = 
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('current-date').textContent = 
        now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function handleMQTTMessage(topic, message) {
    const partes = message.split('|');
    
    if (partes.length >= 2) {
        estadoActual.ventilador = partes[0];
        estadoActual.modo = partes[1];
        estadoActual.timestamp = parseInt(partes[2]) || Date.now();
        
        updateDashboard();
        dashboardCharts.updateHistoryChart(estadoActual.ventilador, estadoActual.pir);
        updateActivityTimeline();
    }
}

function controlManual(comando) {
    if (mqttManager.publish(MQTT_CONFIG.topics.control, comando)) {
        // Feedback visual
        const btn = document.querySelector(`.ctrl-${comando.toLowerCase()}`);
        if (btn) {
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
        }
        
        // Actualizar estado local
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
    // Actualizar ventilador 3D
    const ventilador3D = document.getElementById('ventilador-3d');
    ventilador3D.className = `ventilador-3d ${estadoActual.ventilador === 'ON' ? 'on' : 'off'}`;
    
    // Speed bar
    document.getElementById('speed-bar').style.width = estadoActual.ventilador === 'ON' ? '100%' : '0%';
    document.getElementById('consumo').textContent = estadoActual.ventilador === 'ON' ? '12W' : '0W';
    
    // Stats
    document.getElementById('stat-ventilador').textContent = estadoActual.ventilador === 'ON' ? 'ENCENDIDO' : 'APAGADO';
    document.getElementById('stat-pir').textContent = estadoActual.pir === 1 ? 'PRESENCIA DETECTADA' : 'SIN PRESENCIA';
    
    // Actualizar estadísticas
    if (estadoActual.ventilador === 'ON') {
        estadisticas.tiempoActivo += 5;
    }
    
    document.getElementById('stat-tiempo').textContent = Math.round(estadisticas.tiempoActivo / 60) + ' min';
    
    // Actualizar sidebar status
    const connected = mqttManager.connected;
    document.getElementById('sidebar-status-dot').className = `indicator-dot ${connected ? 'connected' : ''}`;
    document.getElementById('sidebar-status-text').textContent = connected ? 'Conectado' : 'Desconectado';
}

function updateActivityTimeline() {
    const timeline = document.getElementById('activity-timeline');
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    const icon = estadoActual.ventilador === 'ON' ? 'fa-play-circle text-success' : 'fa-stop-circle text-danger';
    const event = estadoActual.ventilador === 'ON' ? 'Ventilador encendido' : 'Ventilador apagado';
    
    estadisticas.actividadReciente.unshift({ time: timeStr, icon, event });
    
    // Mantener solo 5 eventos
    if (estadisticas.actividadReciente.length > 5) {
        estadisticas.actividadReciente.pop();
    }
    
    timeline.innerHTML = estadisticas.actividadReciente.map(item => `
        <div class="timeline-item animate-fade-in-left">
            <div class="time">${item.time}</div>
            <div class="event">
                <i class="fas ${item.icon}"></i>
                ${item.event}
            </div>
        </div>
    `).join('');
}

function showLoading() {
    document.getElementById('loading-screen').classList.remove('hidden');
}

function hideLoading() {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 2000);
}

function showError(message) {
    document.getElementById('loading-screen').innerHTML = `
        <div class="loader-content">
            <div class="loader-icon">⚠️</div>
            <h2 class="loader-title">Error de Conexión</h2>
            <p class="loader-subtitle">${message}</p>
            <button onclick="location.reload()" class="ctrl-btn ctrl-auto" style="margin-top: 30px;">
                <i class="fas fa-redo"></i>
                Reintentar
            </button>
        </div>
    `;
}