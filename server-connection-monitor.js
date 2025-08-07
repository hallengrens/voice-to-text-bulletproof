/**
 * SERVER CONNECTION MONITOR
 * Kollar kontinuerligt att backend är tillgänglig
 * Varnar INNAN du börjar spela in om servern är nere
 */

class ServerConnectionMonitor {
    constructor() {
        this.apiEndpoint = '/api/health'; // eller '/api/transcribe/health'
        this.isConnected = false;
        this.checkInterval = 5000; // Kolla var 5:e sekund
        this.lastCheckTime = null;
        this.intervalId = null;
        
        this.init();
    }

    init() {
        // Starta monitoring
        this.startMonitoring();
        
        // Kolla direkt när fönster blir aktivt
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('Tab active - checking server connection...');
                this.checkConnection();
            }
        });
        
        // Kolla när fönster får fokus
        window.addEventListener('focus', () => {
            this.checkConnection();
        });
        
        // Initial check
        this.checkConnection();
    }

    startMonitoring() {
        // Rensa eventuellt existerande interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        // Kolla connection regelbundet
        this.intervalId = setInterval(() => {
            this.checkConnection();
        }, this.checkInterval);
    }

    async checkConnection() {
        try {
            // Enkel health check till backend
            const response = await fetch(this.apiEndpoint, {
                method: 'GET',
                cache: 'no-cache',
                signal: AbortSignal.timeout(3000) // 3 sekunder timeout
            });
            
            if (response.ok) {
                this.setConnectionStatus(true);
            } else {
                this.setConnectionStatus(false, `Server svarade med: ${response.status}`);
            }
        } catch (error) {
            this.setConnectionStatus(false, error.message);
        }
        
        this.lastCheckTime = Date.now();
    }

    setConnectionStatus(connected, errorMessage = '') {
        const wasConnected = this.isConnected;
        this.isConnected = connected;
        
        // Uppdatera UI
        this.updateUI(connected, errorMessage);
        
        // Om connection återställd efter avbrott
        if (!wasConnected && connected) {
            this.showNotification('✅ Anslutning återställd', 'success');
        }
        
        // Om connection förlorad
        if (wasConnected && !connected) {
            this.showNotification('⚠️ Serveranslutning förlorad!', 'error');
        }
    }

    updateUI(connected, errorMessage) {
        // Uppdatera navigation bar
        const navbar = document.querySelector('.navbar') || 
                      document.querySelector('.navigation') || 
                      document.querySelector('nav');
        
        if (navbar) {
            if (connected) {
                navbar.style.borderTop = '3px solid #4CAF50';
                navbar.classList.remove('connection-error');
            } else {
                navbar.style.borderTop = '3px solid #f44336';
                navbar.classList.add('connection-error');
            }
        }
        
        // Uppdatera/skapa status indicator
        let statusIndicator = document.getElementById('connection-status');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'connection-status';
            statusIndicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(statusIndicator);
        }
        
        if (connected) {
            statusIndicator.style.background = '#4CAF50';
            statusIndicator.style.color = 'white';
            statusIndicator.innerHTML = `
                <span style="width: 8px; height: 8px; background: white; border-radius: 50%; animation: pulse 2s infinite;"></span>
                <span>Online</span>
            `;
        } else {
            statusIndicator.style.background = '#f44336';
            statusIndicator.style.color = 'white';
            statusIndicator.innerHTML = `
                <span style="width: 8px; height: 8px; background: white; border-radius: 50%;"></span>
                <span>Offline</span>
            `;
        }
        
        // Disable/enable record button
        const recordButton = document.querySelector('.record-button') || 
                           document.querySelector('[data-action="record"]');
        
        if (recordButton) {
            if (connected) {
                recordButton.disabled = false;
                recordButton.style.opacity = '1';
                recordButton.title = 'Starta inspelning';
            } else {
                recordButton.disabled = true;
                recordButton.style.opacity = '0.5';
                recordButton.title = 'Ingen serveranslutning - kan inte spela in';
            }
        }
        
        // Visa varning om offline
        if (!connected) {
            this.showOfflineWarning(errorMessage);
        } else {
            this.hideOfflineWarning();
        }
    }

    showOfflineWarning(errorMessage) {
        let warning = document.getElementById('offline-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'offline-warning';
            warning.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ff5722;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 400px;
                text-align: center;
            `;
            document.body.appendChild(warning);
        }
        
        warning.innerHTML = `
            <strong>⚠️ Ingen serveranslutning</strong><br>
            <small>${errorMessage || 'Kan inte nå servern'}</small><br>
            <small>Inspelning är inaktiverad tills anslutningen återställs</small><br>
            <button onclick="serverMonitor.checkConnection()" style="
                margin-top: 10px;
                padding: 5px 15px;
                background: white;
                color: #ff5722;
                border: none;
                border-radius: 3px;
                cursor: pointer;
            ">Försök igen</button>
        `;
    }

    hideOfflineWarning() {
        const warning = document.getElementById('offline-warning');
        if (warning) {
            warning.remove();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Manuell check före inspelning
    async ensureConnection() {
        await this.checkConnection();
        
        if (!this.isConnected) {
            alert('Servern är inte tillgänglig. Kontrollera din anslutning och försök igen.');
            return false;
        }
        
        return true;
    }
}

// CSS för animationer
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .connection-error {
        animation: shake 0.5s;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Initiera global monitor
window.serverMonitor = new ServerConnectionMonitor();

// Hook på record button för extra säkerhet
document.addEventListener('DOMContentLoaded', function() {
    const recordButton = document.querySelector('.record-button');
    if (recordButton) {
        recordButton.addEventListener('click', async function(e) {
            // Kolla connection innan inspelning startar
            const canRecord = await window.serverMonitor.ensureConnection();
            if (!canRecord) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
});

console.log('Server connection monitor active');