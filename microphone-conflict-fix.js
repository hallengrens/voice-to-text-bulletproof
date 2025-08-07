/**
 * FIX: Mikrofon-konflikt mellan tjänster
 * Problem: Första inspelningen misslyckas efter att mikrofon använts i annan flik
 * Lösning: Återinitiera mikrofon-åtkomst och verifiera innan inspelning
 */

class MicrophoneManager {
    constructor() {
        this.stream = null;
        this.mediaRecorder = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async initializeMicrophone() {
        try {
            // Stäng eventuell existerande stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            // Begär ny mikrofon-åtkomst med retry
            this.stream = await this.requestMicrophoneWithRetry();
            
            // Verifiera att stream fungerar
            const audioTrack = this.stream.getAudioTracks()[0];
            if (!audioTrack || !audioTrack.enabled) {
                throw new Error('Audio track not available or not enabled');
            }

            console.log('Microphone initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize microphone:', error);
            this.handleMicrophoneError(error);
            return false;
        }
    }

    async requestMicrophoneWithRetry() {
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                // Olika constraints för att öka chansen att lyckas
                const constraints = [
                    { audio: true },
                    { audio: { echoCancellation: true } },
                    { audio: { echoCancellation: false, noiseSuppression: false } }
                ];

                const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
                
                // Test att stream faktiskt fungerar
                await this.testAudioStream(stream);
                
                return stream;
            } catch (error) {
                console.log(`Microphone attempt ${i + 1} failed:`, error.message);
                
                if (i < this.maxRetries - 1) {
                    // Vänta lite innan nästa försök
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    throw error;
                }
            }
        }
    }

    async testAudioStream(stream) {
        return new Promise((resolve, reject) => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            microphone.connect(analyser);
            
            // Kolla om vi får audio data
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                
                checkCount++;
                
                // Om vi får någon audio activity eller har kollat 10 gånger
                if (sum > 0 || checkCount > 10) {
                    clearInterval(checkInterval);
                    microphone.disconnect();
                    audioContext.close();
                    
                    if (checkCount > 10 && sum === 0) {
                        console.warn('No audio activity detected, but proceeding anyway');
                    }
                    resolve();
                }
            }, 100);
            
            // Timeout efter 2 sekunder
            setTimeout(() => {
                clearInterval(checkInterval);
                microphone.disconnect();
                audioContext.close();
                reject(new Error('Audio stream test timeout'));
            }, 2000);
        });
    }

    handleMicrophoneError(error) {
        let message = 'Mikrofonåtkomst misslyckades. ';
        
        if (error.name === 'NotAllowedError') {
            message += 'Tillåt mikrofonåtkomst i webbläsaren.';
        } else if (error.name === 'NotFoundError') {
            message += 'Ingen mikrofon hittades.';
        } else if (error.name === 'NotReadableError') {
            message += 'Mikrofonen används av en annan applikation.';
        } else {
            message += 'Försök stänga andra flikar som använder mikrofonen.';
        }
        
        // Visa tydligt felmeddelande
        this.showError(message);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'microphone-error';
        errorDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #f44336;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 10000;
                max-width: 400px;
            ">
                <strong>⚠️ Mikrofonproblem</strong><br>
                ${message}<br>
                <button onclick="microphoneManager.initializeMicrophone(); this.parentElement.remove();" style="
                    margin-top: 10px;
                    padding: 5px 10px;
                    background: white;
                    color: #f44336;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                ">Försök igen</button>
            </div>
        `;
        document.body.appendChild(errorDiv);
        
        // Ta bort efter 10 sekunder
        setTimeout(() => errorDiv.remove(), 10000);
    }
}

// Global instans
window.microphoneManager = new MicrophoneManager();

// Hook in på record-knappen
document.addEventListener('DOMContentLoaded', function() {
    const originalStartRecording = window.startRecording;
    
    window.startRecording = async function() {
        // Alltid re-initiera mikrofon före inspelning
        const micReady = await window.microphoneManager.initializeMicrophone();
        
        if (!micReady) {
            console.error('Could not initialize microphone');
            return;
        }
        
        // Fortsätt med original recording logic
        if (originalStartRecording) {
            originalStartRecording.call(this);
        }
    };
});

// Detectera när flik blir aktiv igen
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('Tab became visible, preparing microphone...');
        // Pre-emptively prepare microphone när användaren kommer tillbaka
        window.microphoneManager.initializeMicrophone();
    }
});

// localStorage fix - bara begränsa storlek, inte stäng av helt
(function limitLocalStorageSize() {
    const MAX_STORAGE_MB = 5; // Max 5MB för audio backup
    
    const getStorageSize = () => {
        let size = 0;
        for (let key in localStorage) {
            if (key.includes('recording') || key.includes('audio')) {
                size += localStorage[key].length;
            }
        }
        return size / 1024 / 1024; // Convert to MB
    };
    
    // Kolla storlek före save
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        if ((key.includes('recording') || key.includes('audio')) && 
            getStorageSize() > MAX_STORAGE_MB) {
            console.warn('Audio backup storage limit reached, clearing old data');
            // Rensa äldsta backup
            const keys = Object.keys(localStorage)
                .filter(k => k.includes('recording'))
                .sort();
            if (keys.length > 0) {
                localStorage.removeItem(keys[0]);
            }
        }
        return originalSetItem.call(this, key, value);
    };
})();

console.log('Microphone conflict fix applied');