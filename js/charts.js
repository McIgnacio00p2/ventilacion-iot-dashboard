// Gráficos avanzados para el dashboard
class DashboardCharts {
    constructor() {
        this.historyChart = null;
        this.hourlyChart = null;
        this.efficiencyChart = null;
        this.movementChart = null;
        this.miniCharts = {};
        
        this.chartData = {
            history: {
                labels: [],
                ventilador: [],
                pir: []
            },
            hourly: {
                labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', 
                        '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
                data: [0, 0, 0, 2, 15, 30, 45, 38, 25, 20, 10, 5]
            }
        };
    }

    initializeAll() {
        this.createHistoryChart();
        this.createHourlyChart();
        this.createEfficiencyChart();
        this.createMovementChart();
        this.createMiniCharts();
    }

    createHistoryChart() {
        const ctx = document.getElementById('historyChart').getContext('2d');
        
        // Gradiente para Ventilador
        const gradientVent = ctx.createLinearGradient(0, 0, 0, 400);
        gradientVent.addColorStop(0, 'rgba(102, 126, 234, 0.4)');
        gradientVent.addColorStop(1, 'rgba(102, 126, 234, 0)');
        
        // Gradiente para PIR
        const gradientPIR = ctx.createLinearGradient(0, 0, 0, 400);
        gradientPIR.addColorStop(0, 'rgba(72, 187, 120, 0.4)');
        gradientPIR.addColorStop(1, 'rgba(72, 187, 120, 0)');

        this.historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Ventilador',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: gradientVent,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#667eea',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }, {
                    label: 'Sensor PIR',
                    data: [],
                    borderColor: '#48bb78',
                    backgroundColor: gradientPIR,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#48bb78',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + 
                                       (context.parsed.y === 1 ? 'ACTIVO' : 'INACTIVO');
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            stepSize: 1,
                            color: '#64748b',
                            callback: (value) => value === 1 ? 'ON' : 'OFF'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#64748b',
                            maxTicksLimit: 12
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.05)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }

    createHourlyChart() {
        const ctx = document.getElementById('hourlyChart').getContext('2d');
        
        this.hourlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.chartData.hourly.labels,
                datasets: [{
                    label: 'Minutos de Uso',
                    data: this.chartData.hourly.data,
                    backgroundColor: ctx => {
                        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.8)');
                        gradient.addColorStop(1, 'rgba(118, 75, 162, 0.2)');
                        return gradient;
                    },
                    borderColor: '#667eea',
                    borderWidth: 1,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#64748b' },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#64748b' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    createEfficiencyChart() {
        const ctx = document.getElementById('efficiencyChart').getContext('2d');
        
        this.efficiencyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Uso Eficiente', 'Standby', 'Activo'],
                datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(148, 163, 184, 0.3)',
                        'rgba(102, 126, 234, 0.8)'
                    ],
                    borderColor: 'rgba(15, 23, 42, 1)',
                    borderWidth: 3,
                    hoverBorderColor: 'rgba(102, 126, 234, 0.5)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    createMovementChart() {
        const ctx = document.getElementById('movementChart').getContext('2d');
        
        this.movementChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Mañana', 'Mediodía', 'Tarde', 'Noche', 'Madrugada'],
                datasets: [{
                    label: 'Hoy',
                    data: [30, 50, 45, 35, 10],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7
                }, {
                    label: 'Ayer',
                    data: [25, 45, 40, 30, 8],
                    borderColor: '#48bb78',
                    backgroundColor: 'rgba(72, 187, 120, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: '#48bb78',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: {
                            color: 'rgba(148, 163, 184, 0.2)'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.2)'
                        },
                        pointLabels: {
                            color: '#94a3b8'
                        },
                        ticks: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    createMiniCharts() {
        const miniConfigs = [
            { id: 'mini-chart-ventilador', color: '#667eea' },
            { id: 'mini-chart-pir', color: '#48bb78' },
            { id: 'mini-chart-tiempo', color: '#ed8936' },
            { id: 'mini-chart-activaciones', color: '#9f7aea' }
        ];

        miniConfigs.forEach(config => {
            const canvas = document.getElementById(config.id);
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            this.miniCharts[config.id] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array(10).fill(''),
                    datasets: [{
                        data: Array(10).fill(0).map(() => Math.random()),
                        borderColor: config.color,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    },
                    elements: {
                        point: { radius: 0 }
                    }
                }
            });
        });
    }

    updateHistoryChart(ventiladorState, pirState) {
        if (!this.historyChart) return;

        const now = new Date();
        const timeLabel = now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });

        this.chartData.history.labels.push(timeLabel);
        this.chartData.history.ventilador.push(ventiladorState === 'ON' ? 1 : 0);
        this.chartData.history.pir.push(pirState || 0);

        // Mantener máximo 50 puntos
        if (this.chartData.history.labels.length > 50) {
            this.chartData.history.labels.shift();
            this.chartData.history.ventilador.shift();
            this.chartData.history.pir.shift();
        }

        this.historyChart.data.labels = this.chartData.history.labels;
        this.historyChart.data.datasets[0].data = this.chartData.history.ventilador;
        this.historyChart.data.datasets[1].data = this.chartData.history.pir;
        this.historyChart.update('none');
    }

    updateMiniCharts() {
        Object.keys(this.miniCharts).forEach(key => {
            const chart = this.miniCharts[key];
            const newData = Array(10).fill(0).map(() => Math.random());
            chart.data.datasets[0].data = newData;
            chart.update('none');
        });
    }
}

// Instancia global
const dashboardCharts = new DashboardCharts();