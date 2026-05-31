let historyChart;
let chartData = {
    labels: [],
    ventilador: [],
    pir: []
};

function initializeChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Ventilador',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    stepped: true,
                    pointRadius: 0
                },
                {
                    label: 'Sensor PIR',
                    data: [],
                    borderColor: '#48bb78',
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    stepped: true,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        stepSize: 1,
                        callback: (value) => value === 1 ? 'ACTIVO' : 'INACTIVO'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

function updateChartData() {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    chartData.labels.push(timeLabel);
    chartData.ventilador.push(estadoActual.ventilador === 'ON' ? 1 : 0);
    chartData.pir.push(estadoActual.pir);
    
    // Mantener máximo 50 puntos
    if (chartData.labels.length > 50) {
        chartData.labels.shift();
        chartData.ventilador.shift();
        chartData.pir.shift();
    }
    
    historyChart.data.labels = chartData.labels;
    historyChart.data.datasets[0].data = chartData.ventilador;
    historyChart.data.datasets[1].data = chartData.pir;
    historyChart.update('none');
}

function changeTimeRange(range) {
    // Actualizar botones activos
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Ajustar datos según el rango
    let maxPoints;
    switch(range) {
        case '1h': maxPoints = 20; break;
        case '6h': maxPoints = 40; break;
        case '24h': maxPoints = 100; break;
    }
    
    // Limitar puntos del gráfico
    while (chartData.labels.length > maxPoints) {
        chartData.labels.shift();
        chartData.ventilador.shift();
        chartData.pir.shift();
    }
    
    historyChart.update();
}

// Actualizar gráfico periódicamente
setInterval(() => {
    if (estadoActual.ventilador) {
        updateChartData();
    }
}, 15000);