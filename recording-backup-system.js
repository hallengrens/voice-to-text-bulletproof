/**
 * BULLETPROOF RECORDING BACKUP SYSTEM
 * Never lose voice recordings again!
 * 
 * Features:
 * - Auto-save every 30 seconds during recording
 * - Keep last 5 recordings as backup
 * - Automatic recovery on page reload
 * - Retry logic with exponential backoff
 * - Manual download capability
 */

class RecordingBackupSystem {
    constructor() {
        this.STORAGE_KEY = 'voice_recordings_backup';
        this.MAX_BACKUPS = 5;
        this.AUTO_SAVE_INTERVAL = 30000; // 30 seconds
        this.autoSaveTimer = null;
        this.currentRecording = null;
        this.retryQueue = [];
        this.maxRetries = 5;
        
        this.init();
    }

    init() {
        // Check for unsaved recordings on page load
        this.checkForUnsavedRecordings();
        
        // Set up page unload warning if recording
        window.addEventListener('beforeunload', (e) => {
            if (this.currentRecording && this.currentRecording.isRecording) {
                e.preventDefault();
                e.returnValue = 'You have an active recording. Are you sure you want to leave?';
            }
        });

        // Listen for visibility changes to save when tab becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.currentRecording) {
                this.saveToLocalStorage(this.currentRecording);
            }
        });
    }

    /**
     * Start backup system for a new recording
     */
    startRecording(recordingId) {
        this.currentRecording = {
            id: recordingId || Date.now().toString(),
            startTime: new Date().toISOString(),
            chunks: [],
            metadata: {
                userAgent: navigator.userAgent,
                url: window.location.href
            },
            isRecording: true
        };

        // Start auto-save timer
        this.startAutoSave();
        
        // Show recording indicator
        this.showRecordingIndicator();
        
        return this.currentRecording.id;
    }

    /**
     * Add audio chunk to current recording
     */
    addChunk(audioData) {
        if (!this.currentRecording) return;
        
        // Convert Blob to base64 for storage
        const reader = new FileReader();
        reader.onloadend = () => {
            this.currentRecording.chunks.push({
                data: reader.result,
                timestamp: Date.now()
            });
            
            // Update UI with chunk count
            this.updateRecordingIndicator(this.currentRecording.chunks.length);
        };
        reader.readAsDataURL(audioData);
    }

    /**
     * Stop recording and finalize backup
     */
    stopRecording() {
        if (!this.currentRecording) return;
        
        this.currentRecording.isRecording = false;
        this.currentRecording.endTime = new Date().toISOString();
        this.currentRecording.duration = Date.now() - new Date(this.currentRecording.startTime).getTime();
        
        // Stop auto-save timer
        this.stopAutoSave();
        
        // Final save
        this.saveToLocalStorage(this.currentRecording);
        
        // Hide recording indicator
        this.hideRecordingIndicator();
        
        const recording = this.currentRecording;
        this.currentRecording = null;
        
        return recording;
    }

    /**
     * Auto-save current recording every 30 seconds
     */
    startAutoSave() {
        this.stopAutoSave(); // Clear any existing timer
        
        this.autoSaveTimer = setInterval(() => {
            if (this.currentRecording) {
                this.saveToLocalStorage(this.currentRecording);
                this.showAutoSaveNotification();
            }
        }, this.AUTO_SAVE_INTERVAL);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Save recording to localStorage
     */
    saveToLocalStorage(recording) {
        try {
            // Get existing backups
            let backups = this.getBackups();
            
            // Add or update current recording
            const existingIndex = backups.findIndex(b => b.id === recording.id);
            if (existingIndex >= 0) {
                backups[existingIndex] = recording;
            } else {
                backups.unshift(recording);
            }
            
            // Keep only last MAX_BACKUPS recordings
            backups = backups.slice(0, this.MAX_BACKUPS);
            
            // Save to localStorage
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(backups));
            
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            
            // If localStorage is full, try to clear old data
            if (error.name === 'QuotaExceededError') {
                this.clearOldBackups();
                try {
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([recording]));
                    return true;
                } catch (retryError) {
                    console.error('Still failed after clearing old backups:', retryError);
                    // Last resort: offer download
                    this.offerManualDownload(recording);
                }
            }
            return false;
        }
    }

    /**
     * Get all backup recordings from localStorage
     */
    getBackups() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to retrieve backups:', error);
            return [];
        }
    }

    /**
     * Clear old backups to free space
     */
    clearOldBackups() {
        const backups = this.getBackups();
        // Keep only the 2 most recent
        const recentBackups = backups.slice(0, 2);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentBackups));
    }

    /**
     * Check for unsaved recordings on page load
     */
    checkForUnsavedRecordings() {
        const backups = this.getBackups();
        const unsavedRecordings = backups.filter(recording => 
            !recording.uploaded && recording.chunks && recording.chunks.length > 0
        );
        
        if (unsavedRecordings.length > 0) {
            this.showRecoveryDialog(unsavedRecordings);
        }
    }

    /**
     * Show recovery dialog for unsaved recordings
     */
    showRecoveryDialog(recordings) {
        const dialog = document.createElement('div');
        dialog.className = 'recording-recovery-dialog';
        dialog.innerHTML = `
            <div class="recovery-dialog-content">
                <h3>🎤 Unsaved Recordings Found</h3>
                <p>You have ${recordings.length} unsaved recording(s) from previous sessions.</p>
                <div class="recovery-list">
                    ${recordings.map(rec => `
                        <div class="recovery-item" data-id="${rec.id}">
                            <div class="recovery-info">
                                <strong>${new Date(rec.startTime).toLocaleString()}</strong>
                                <span>Duration: ${this.formatDuration(rec.duration)}</span>
                                <span>Chunks: ${rec.chunks.length}</span>
                            </div>
                            <div class="recovery-actions">
                                <button onclick="backupSystem.recoverRecording('${rec.id}')">
                                    📤 Upload
                                </button>
                                <button onclick="backupSystem.downloadRecording('${rec.id}')">
                                    💾 Download
                                </button>
                                <button onclick="backupSystem.deleteBackup('${rec.id}')">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="close-recovery" onclick="this.parentElement.parentElement.remove()">
                    Close
                </button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .recording-recovery-dialog {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 2px solid #007bff;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                max-width: 400px;
            }
            .recovery-dialog-content h3 {
                margin-top: 0;
                color: #333;
            }
            .recovery-list {
                margin: 15px 0;
                max-height: 300px;
                overflow-y: auto;
            }
            .recovery-item {
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 10px;
                margin-bottom: 10px;
            }
            .recovery-info {
                margin-bottom: 10px;
            }
            .recovery-info strong {
                display: block;
                margin-bottom: 5px;
            }
            .recovery-info span {
                display: inline-block;
                margin-right: 10px;
                font-size: 0.9em;
                color: #666;
            }
            .recovery-actions button {
                margin-right: 5px;
                padding: 5px 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: white;
                cursor: pointer;
            }
            .recovery-actions button:hover {
                background: #f0f0f0;
            }
            .close-recovery {
                width: 100%;
                padding: 10px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .close-recovery:hover {
                background: #0056b3;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(dialog);
    }

    /**
     * Recover and upload a recording with retry logic
     */
    async recoverRecording(recordingId) {
        const backups = this.getBackups();
        const recording = backups.find(r => r.id === recordingId);
        
        if (!recording) {
            console.error('Recording not found:', recordingId);
            return;
        }

        // Reconstruct audio blob from chunks
        const audioBlob = await this.reconstructAudioBlob(recording.chunks);
        
        // Upload with retry logic
        this.uploadWithRetry(audioBlob, recording, 0);
    }

    /**
     * Reconstruct audio blob from base64 chunks
     */
    async reconstructAudioBlob(chunks) {
        const audioChunks = [];
        
        for (const chunk of chunks) {
            const response = await fetch(chunk.data);
            const blob = await response.blob();
            audioChunks.push(blob);
        }
        
        return new Blob(audioChunks, { type: 'audio/webm' });
    }

    /**
     * Upload with exponential backoff retry
     */
    async uploadWithRetry(audioBlob, metadata, attemptNumber) {
        if (attemptNumber >= this.maxRetries) {
            console.error('Max retries reached for upload');
            this.showErrorNotification('Upload failed after maximum retries. Recording saved locally.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('metadata', JSON.stringify(metadata));

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(300000) // 5 minute timeout
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const result = await response.json();
            
            // Mark as uploaded in localStorage
            this.markAsUploaded(metadata.id);
            
            // Show success notification
            this.showSuccessNotification('Recording uploaded successfully!');
            
            return result;
            
        } catch (error) {
            console.error(`Upload attempt ${attemptNumber + 1} failed:`, error);
            
            // Calculate exponential backoff delay
            const delay = Math.min(1000 * Math.pow(2, attemptNumber), 30000);
            
            // Show retry notification
            this.showRetryNotification(`Retrying upload in ${delay / 1000} seconds...`);
            
            // Retry after delay
            setTimeout(() => {
                this.uploadWithRetry(audioBlob, metadata, attemptNumber + 1);
            }, delay);
        }
    }

    /**
     * Mark recording as uploaded
     */
    markAsUploaded(recordingId) {
        const backups = this.getBackups();
        const recording = backups.find(r => r.id === recordingId);
        if (recording) {
            recording.uploaded = true;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(backups));
        }
    }

    /**
     * Download recording as file
     */
    async downloadRecording(recordingId) {
        const backups = this.getBackups();
        const recording = backups.find(r => r.id === recordingId);
        
        if (!recording) {
            console.error('Recording not found:', recordingId);
            return;
        }

        // Reconstruct audio blob
        const audioBlob = await this.reconstructAudioBlob(recording.chunks);
        
        // Create download link
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording_${recording.id}_${new Date(recording.startTime).toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccessNotification('Recording downloaded successfully!');
    }

    /**
     * Delete a backup recording
     */
    deleteBackup(recordingId) {
        if (confirm('Are you sure you want to delete this recording?')) {
            let backups = this.getBackups();
            backups = backups.filter(r => r.id !== recordingId);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(backups));
            
            // Remove from UI
            const element = document.querySelector(`.recovery-item[data-id="${recordingId}"]`);
            if (element) {
                element.remove();
            }
            
            this.showSuccessNotification('Recording deleted.');
        }
    }

    /**
     * Manual download option for current recording
     */
    offerManualDownload(recording) {
        const dialog = confirm('Local storage is full. Would you like to download the recording to your device?');
        if (dialog) {
            this.downloadRecording(recording.id);
        }
    }

    /**
     * UI Helper Functions
     */
    
    showRecordingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'recording-indicator';
        indicator.className = 'recording-indicator';
        indicator.innerHTML = `
            <div class="recording-dot"></div>
            <span>Recording...</span>
            <span id="chunk-count">0 chunks</span>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .recording-indicator {
                position: fixed;
                top: 20px;
                left: 20px;
                background: #ff4444;
                color: white;
                padding: 10px 15px;
                border-radius: 25px;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 10000;
                animation: pulse 2s infinite;
            }
            .recording-dot {
                width: 10px;
                height: 10px;
                background: white;
                border-radius: 50%;
                animation: blink 1s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.9; }
                50% { opacity: 1; }
            }
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
        `;
        
        if (!document.getElementById('recording-indicator-style')) {
            style.id = 'recording-indicator-style';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(indicator);
    }

    updateRecordingIndicator(chunkCount) {
        const counter = document.getElementById('chunk-count');
        if (counter) {
            counter.textContent = `${chunkCount} chunks`;
        }
    }

    hideRecordingIndicator() {
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    showAutoSaveNotification() {
        this.showNotification('Auto-saved', 'success', 2000);
    }

    showSuccessNotification(message) {
        this.showNotification(message, 'success', 3000);
    }

    showErrorNotification(message) {
        this.showNotification(message, 'error', 5000);
    }

    showRetryNotification(message) {
        this.showNotification(message, 'info', 3000);
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `backup-notification ${type}`;
        notification.textContent = message;
        
        const style = document.createElement('style');
        style.textContent = `
            .backup-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                z-index: 10001;
                animation: slideIn 0.3s ease-out;
            }
            .backup-notification.success {
                background: #28a745;
            }
            .backup-notification.error {
                background: #dc3545;
            }
            .backup-notification.info {
                background: #17a2b8;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        if (!document.getElementById('notification-style')) {
            style.id = 'notification-style';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    /**
     * Format duration in milliseconds to readable format
     */
    formatDuration(ms) {
        if (!ms) return 'Unknown';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Initialize global instance
const backupSystem = new RecordingBackupSystem();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordingBackupSystem;
}