// Estado global
let estado = {
    ventilador: false,
    modo: 'AUTO',
    presencia: false,
    lastDetection: null
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        await mqttManager.connect();
        updateTime();
        setInterval(updateTime, 1000);
        initChart();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión');
    }
}

function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = 
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// Manejar mensajes MQTT
function handleMQTTMessage(topic, message) {
    const [vent, modo, timestamp] = message.split('|');
    
    estado.ventilador = vent === 'ON';
    estado.modo = modo || 'AUTO';
    
    if (estado.modo === 'AUTO') {
        estado.presencia = estado.ventilador;
    }
    
    if (estado.presencia && !estado.lastDetection) {
        estado.lastDetection = new Date();
    }
    
    updateUI();
    updateChart();
}

function controlManual(comando) {
    const btn = document.getElementById(comando === 'ON' ? 'btnOn' : 'btnOff');
    btn.disabled = true;
    setTimeout(() => btn.disabled = false, 1000);
    
    mqttManager.publish('ventilador/control', comando);
    showToast(`Comando enviado: ${comando === 'ON' ? 'Encender' : 'Apagar'}`);
}

function updateUI() {
    // Ícono del ventilador
    const fanIcon = document.getElementById('fanIcon');
    const ventiladorLabel = document.getElementById('ventiladorLabel');
    
    if (estado.ventilador) {
        fanIcon.classList.add('spinning');
        ventiladorLabel.textContent = 'ENCENDIDO';
        ventiladorLabel.classList.add('on');
        ventiladorLabel.classList.remove('off');
    } else {
        fanIcon.classList.remove('spinning');
        ventiladorLabel.textContent = 'APAGADO';
        ventiladorLabel.classList.add('off');
        ventiladorLabel.classList.remove('on');
    }
    
    // Modo
    const modeBadge = document.getElementById('modeBadge');
    modeBadge.textContent = estado.modo === 'AUTO' ? 'Modo Auto' : 'Modo Manual';
    modeBadge.classList.toggle('manual', estado.modo === 'MANUAL');
    
    // Sensor
    const sensorRadar = document.getElementById('sensorRadar');
    const sensorStatus = document.getElementById('sensorStatus');
    
    if (estado.presencia) {
        sensorRadar.classList.add('active');
        sensorStatus.textContent = 'Presencia detectada';
        sensorStatus.classList.add('active');
    } else {
        sensorRadar.classList.remove('active');
        sensorStatus.textContent = 'Sin presencia';
        sensorStatus.classList.remove('active');
    }
    
    if (estado.lastDetection) {
        document.getElementById('lastDetection').textContent = 
            `Última: ${estado.lastDetection.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionIndicator');
    const label = indicator.querySelector('.label');
    
    if (connected) {
        indicator.classList.remove('disconnected');
        label.textContent = 'Conectado';
    } else {
        indicator.classList.add('disconnected');
        label.textContent = 'Desconectado';
    }
}

// Gráfico simplificado
let chart;
let chartPoints = [];

function initChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Ventilador',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: 'Sensor',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: { 
                        stepSize: 1,
                        display: false
                    },
                    grid: { 
                        color: 'rgba(148, 163, 184, 0.05)' 
                    }
                },
                x: {
                    grid: { 
                        display: false 
                    },
                    ticks: { 
                        maxTicksLimit: 6,
                        color: '#94a3b8'
                    }
                }
            },
            plugins: {
                legend: { 
                    display: false 
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function updateChart() {
    const now = new Date();
    const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    chartPoints.push({
        time,
        ventilador: estado.ventilador ? 1 : 0,
        presencia: estado.presencia ? 1 : 0
    });
    
    if (chartPoints.length > 30) {
        chartPoints.shift();
    }
    
    chart.data.labels = chartPoints.map(p => p.time);
    chart.data.datasets[0].data = chartPoints.map(p => p.ventilador);
    chart.data.datasets[1].data = chartPoints.map(p => p.presencia);
    chart.update('none');
}

// Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}