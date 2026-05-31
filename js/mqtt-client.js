// Configuración MQTT
const MQTT_CONFIG = {
    broker: 'broker.emqx.io',
    port: 8084,  // Puerto WebSocket seguro
    clientId: 'web_dashboard_' + Math.random().toString(16).substr(2, 8),
    topics: {
        control: 'ventilador/control',
        status: 'ventilador/status'
    }
};

class MQTTManager {
    constructor() {
        this.client = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.client = mqtt.connect(`wss://${MQTT_CONFIG.broker}:${MQTT_CONFIG.port}`, {
                    clientId: MQTT_CONFIG.clientId,
                    clean: true,
                    reconnectPeriod: 5000,
                    connectTimeout: 30000
                });

                this.client.on('connect', () => {
                    console.log('✅ MQTT Conectado al broker');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    // Suscribirse al topic de estado
                    this.client.subscribe(MQTT_CONFIG.topics.status, (err) => {
                        if (!err) {
                            console.log(`📻 Suscrito a: ${MQTT_CONFIG.topics.status}`);
                            updateConnectionStatus(true);
                            resolve();
                        }
                    });
                });

                this.client.on('message', (topic, message) => {
                    const msg = message.toString();
                    console.log(`📨 MQTT: ${topic} -> ${msg}`);
                    handleMQTTMessage(topic, msg);
                });

                this.client.on('error', (error) => {
                    console.error('❌ Error MQTT:', error);
                    this.connected = false;
                    updateConnectionStatus(false);
                });

                this.client.on('close', () => {
                    console.log('Conexión MQTT cerrada');
                    this.connected = false;
                    updateConnectionStatus(false);
                });

            } catch (error) {
                console.error('Error creando cliente MQTT:', error);
                reject(error);
            }
        });
    }

    publish(topic, message) {
        if (this.client && this.connected) {
            this.client.publish(topic, message, { qos: 0, retain: false });
            console.log(`📤 MQTT Publicado: ${topic} -> ${message}`);
            return true;
        }
        return false;
    }

    disconnect() {
        if (this.client) {
            this.client.end();
        }
    }
}

// Instancia global
const mqttManager = new MQTTManager();