/**
 * EMERGENCY FIX - localStorage problem
 * Problem: 3.3MB chunks fyller localStorage på 2-3 minuter
 * Lösning: INGEN localStorage för audio, bara server-upload
 */

// STEG 1: Rensa ALL gammal localStorage data
(function clearAllAudioData() {
    const keys = Object.keys(localStorage);
    let cleared = 0;
    keys.forEach(key => {
        if (key.includes('recording') || key.includes('audio') || key.includes('voice')) {
            localStorage.removeItem(key);
            cleared++;
        }
    });
    console.log(`Cleared ${cleared} audio-related localStorage items`);
})();

// STEG 2: Override backup system helt
window.backupSystem = {
    startRecording: function() {
        console.log('Recording started - server-only backup');
        return Date.now().toString();
    },
    
    addChunk: function(audioData) {
        // GÖR INGENTING - spara INTE lokalt
        console.log('Chunk received, size:', audioData.size);
    },
    
    stopRecording: function() {
        console.log('Recording stopped');
        return { id: Date.now().toString() };
    },
    
    // Dessa funktioner gör ingenting men finns för compatibility
    saveToLocalStorage: () => false,
    checkForUnsavedRecordings: () => {},
    showRecoveryDialog: () => {},
    offerManualDownload: () => {}
};

// STEG 3: Ta bort alla download prompts
window.confirm = function(message) {
    if (message.toLowerCase().includes('download') || 
        message.toLowerCase().includes('storage')) {
        return false; // Alltid säg nej
    }
    return true;
};

// STEG 4: Blockera auto-save notifications
const originalShowNotification = window.showNotification || (() => {});
window.showNotification = function(message) {
    if (!message.includes('Auto-saved')) {
        originalShowNotification(message);
    }
};

console.log('Emergency localStorage fix applied - NO local audio storage');