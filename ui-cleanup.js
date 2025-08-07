/**
 * UI CLEANUP för voice-to-text
 * 1. Flytta/fixa recording indicator
 * 2. Ta bort cloud monitor (ersätts av notification center)
 * 3. Ta bort model selector (hanteras av API)
 * 4. Lägg till token statistik widget
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. FIXA RECORDING INDICATOR
    // Ta bort den onödiga top-left indicator
    const redundantIndicator = document.getElementById('recording-indicator');
    if (redundantIndicator) {
        redundantIndicator.remove();
    }
    
    // Förbättra den existerande status indicator
    const statusIndicator = document.getElementById('status');
    if (statusIndicator) {
        // Lägg till sekund-räknare istället för chunks
        let recordingStartTime = null;
        let recordingTimer = null;
        
        // Override text när recording startar
        const originalStartRecording = window.startRecording;
        window.startRecording = function() {
            recordingStartTime = Date.now();
            
            // Starta timer för att visa sekunder
            recordingTimer = setInterval(() => {
                const seconds = Math.floor((Date.now() - recordingStartTime) / 1000);
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                
                statusIndicator.innerHTML = `
                    <span class="recording-dot" style="
                        display: inline-block;
                        width: 10px;
                        height: 10px;
                        background: #ff4444;
                        border-radius: 50%;
                        animation: blink 1s infinite;
                        margin-right: 8px;
                    "></span>
                    <span style="color: #ff4444; font-weight: bold;">
                        Spelar in ${minutes}:${remainingSeconds.toString().padStart(2, '0')}
                    </span>
                `;
                
                // Style hela status container
                statusIndicator.style.background = 'rgba(255, 68, 68, 0.1)';
                statusIndicator.style.padding = '8px 15px';
                statusIndicator.style.borderRadius = '20px';
                statusIndicator.style.border = '2px solid #ff4444';
            }, 1000);
            
            // Kör original function
            if (originalStartRecording) {
                originalStartRecording.call(this);
            }
        };
        
        // Stoppa timer när recording slutar
        const originalStopRecording = window.stopRecording;
        window.stopRecording = function() {
            if (recordingTimer) {
                clearInterval(recordingTimer);
                recordingTimer = null;
            }
            
            // Återställ status
            statusIndicator.innerHTML = 'Redo';
            statusIndicator.style.background = '';
            statusIndicator.style.padding = '';
            statusIndicator.style.border = '';
            
            if (originalStopRecording) {
                originalStopRecording.call(this);
            }
        };
    }
    
    // 2. TA BORT CLOUD MONITOR
    const cloudMonitor = document.querySelector('[data-component="cloud-monitor"]') ||
                        document.querySelector('.cloud-monitor') ||
                        document.querySelector('#cloud-monitor');
    if (cloudMonitor) {
        cloudMonitor.remove();
        console.log('Cloud monitor removed - will be replaced by notification center');
    }
    
    // 3. TA BORT MODEL SELECTOR  
    const modelSelector = document.querySelector('select[name="model"]') ||
                         document.querySelector('.model-selector') ||
                         document.querySelector('[data-component="model-selector"]');
    if (modelSelector) {
        // Ta bort hela container
        const container = modelSelector.closest('.control-group') || 
                         modelSelector.parentElement;
        if (container) {
            container.remove();
        } else {
            modelSelector.remove();
        }
        console.log('Model selector removed - handled by API');
    }
    
    // 4. LÄGG TILL TOKEN STATISTIK WIDGET
    const controlsArea = document.querySelector('.controls') ||
                        document.querySelector('.top-controls') ||
                        document.querySelector('nav');
    
    if (controlsArea) {
        const statsWidget = document.createElement('div');
        statsWidget.id = 'token-stats-widget';
        statsWidget.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 15px;
            padding: 8px 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            font-size: 12px;
            margin: 0 10px;
            box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
        `;
        
        statsWidget.innerHTML = `
            <div style="display: flex; align-items: center; gap: 5px;">
                <span style="font-size: 16px;">🪙</span>
                <span id="token-count">0</span>
                <span style="opacity: 0.8;">tokens</span>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.3); height: 20px;"></div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <span style="font-size: 16px;">💰</span>
                <span id="token-cost">€0.00</span>
            </div>
        `;
        
        controlsArea.appendChild(statsWidget);
        
        // Hämta och uppdatera statistik
        updateTokenStats();
    }
    
    // 5. CSS FÖR ANIMATIONER
    const style = document.createElement('style');
    style.textContent = `
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        .recording-active {
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7);
            }
            50% {
                transform: scale(1.05);
                box-shadow: 0 0 0 10px rgba(255, 68, 68, 0);
            }
            100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(255, 68, 68, 0);
            }
        }
    `;
    document.head.appendChild(style);
});

// Funktion för att hämta token statistik
async function updateTokenStats() {
    try {
        // Hämta från nya LLM API
        const response = await fetch('http://localhost:4000/api/usage/domain/talk.hallengren.fr', {
            headers: {
                'X-API-Key': localStorage.getItem('api-key') || ''
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Uppdatera widget
            const tokenCount = document.getElementById('token-count');
            const tokenCost = document.getElementById('token-cost');
            
            if (tokenCount) {
                tokenCount.textContent = formatNumber(data.total_tokens || 0);
            }
            
            if (tokenCost) {
                tokenCost.textContent = `€${(data.total_cost || 0).toFixed(2)}`;
            }
        }
    } catch (error) {
        console.error('Could not fetch token stats:', error);
    }
    
    // Uppdatera var 30:e sekund
    setTimeout(updateTokenStats, 30000);
}

function formatNumber(num) {
    if (num > 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num > 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

console.log('UI cleanup applied');