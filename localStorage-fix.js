/**
 * HOTFIX för localStorage full problem
 * Problem: Systemet sparar hela audio chunks som base64, vilket fyller localStorage snabbt
 * Lösning: Spara endast metadata + ladda upp chunks progressivt till server
 */

class OptimizedBackupSystem {
    constructor() {
        this.STORAGE_KEY = 'voice_recordings_backup_meta'; // Endast metadata
        this.CHUNK_STORAGE_KEY = 'voice_recordings_chunks'; // Temporär chunk storage
        this.MAX_CHUNK_SIZE = 100000; // 100KB per chunk max
        this.uploadQueue = [];
        this.isUploading = false;
    }

    startRecording(recordingId) {
        this.currentRecording = {
            id: recordingId || Date.now().toString(),
            startTime: new Date().toISOString(),
            chunkCount: 0,
            totalSize: 0,
            isRecording: true
        };
        
        // Spara endast metadata
        this.saveMetadata();
        return this.currentRecording.id;
    }

    addChunk(audioData) {
        if (!this.currentRecording) return;
        
        this.currentRecording.chunkCount++;
        this.currentRecording.totalSize += audioData.size;
        
        // Ladda upp chunk direkt till server istället för localStorage
        this.uploadChunkToServer(audioData, this.currentRecording.id, this.currentRecording.chunkCount);
        
        // Uppdatera endast metadata
        this.saveMetadata();
    }

    async uploadChunkToServer(audioData, recordingId, chunkNumber) {
        // Lägg till i upload-kö
        this.uploadQueue.push({
            data: audioData,
            recordingId: recordingId,
            chunkNumber: chunkNumber,
            retryCount: 0
        });
        
        // Starta upload om inte redan igång
        if (!this.isUploading) {
            this.processUploadQueue();
        }
    }

    async processUploadQueue() {
        if (this.uploadQueue.length === 0) {
            this.isUploading = false;
            return;
        }
        
        this.isUploading = true;
        const chunk = this.uploadQueue.shift();
        
        try {
            const formData = new FormData();
            formData.append('audio_chunk', chunk.data);
            formData.append('recording_id', chunk.recordingId);
            formData.append('chunk_number', chunk.chunkNumber);
            
            // Skicka till server för temporär lagring
            const response = await fetch('/api/save-chunk', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Chunk upload failed');
            }
            
        } catch (error) {
            // Vid fel, lägg tillbaka i kön om inte för många försök
            if (chunk.retryCount < 3) {
                chunk.retryCount++;
                this.uploadQueue.push(chunk);
            } else {
                console.error('Failed to upload chunk after 3 retries:', error);
                // Fallback: Spara endast sista chunken lokalt som nödlösning
                this.saveEmergencyChunk(chunk.data);
            }
        }
        
        // Fortsätt med nästa chunk
        setTimeout(() => this.processUploadQueue(), 100);
    }

    saveMetadata() {
        try {
            // Spara ENDAST metadata, inte audio data
            const metadata = {
                id: this.currentRecording.id,
                startTime: this.currentRecording.startTime,
                chunkCount: this.currentRecording.chunkCount,
                totalSize: this.currentRecording.totalSize,
                isRecording: this.currentRecording.isRecording
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(metadata));
        } catch (error) {
            console.error('Failed to save metadata:', error);
        }
    }

    saveEmergencyChunk(audioData) {
        // Spara endast EN chunk som emergency backup
        try {
            // Konvertera till mindre format om möjligt
            const reader = new FileReader();
            reader.onloadend = () => {
                // Spara endast om under 50KB
                if (reader.result.length < 50000) {
                    localStorage.setItem(this.CHUNK_STORAGE_KEY, reader.result);
                }
            };
            reader.readAsDataURL(audioData);
        } catch (error) {
            console.error('Emergency save failed:', error);
        }
    }

    stopRecording() {
        if (!this.currentRecording) return;
        
        this.currentRecording.isRecording = false;
        this.currentRecording.endTime = new Date().toISOString();
        
        // Spara final metadata
        this.saveMetadata();
        
        const recording = this.currentRecording;
        this.currentRecording = null;
        
        return recording;
    }

    // Rensa localStorage helt för att frigöra utrymme
    clearAllBackups() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.CHUNK_STORAGE_KEY);
        // Ta bort gamla backup keys också
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.includes('voice_recordings')) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Ersätt gamla systemet
window.backupSystem = new OptimizedBackupSystem();

// Rensa gamla backups för att frigöra utrymme
window.backupSystem.clearAllBackups();