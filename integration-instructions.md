# Voice-to-Text Bulletproof Backup System - Integration Instructions

## För din befintliga talk-app på /home/admin/hallengren.fr/talk/

### Snabb Integration (5 minuter)

1. **Kopiera backup-systemet till din app:**
```bash
cd /home/admin/hallengren.fr/talk/
wget https://raw.githubusercontent.com/hallengrens/voice-to-text-bulletproof/main/recording-backup-system.js
```

2. **Lägg till i din HTML-fil (troligen index.html eller app.html):**
```html
<!-- Lägg till före slutet av </body> -->
<script src="recording-backup-system.js"></script>
```

3. **Integrera med din befintliga recording-kod:**

Hitta där du startar recording (troligen något som `mediaRecorder.start()`) och lägg till:
```javascript
// När recording startar
backupSystem.startRecording();

// När du får audio chunks (i ondataavailable)
mediaRecorder.ondataavailable = function(e) {
    // Din befintliga kod...
    chunks.push(e.data);
    
    // Lägg till backup
    backupSystem.addChunk(e.data);
};

// När recording stoppar
backupSystem.stopRecording();
```

4. **Testa att det fungerar:**
- Starta en recording
- Vänta 30 sekunder (du bör se "Auto-saved" notification)
- Ladda om sidan medan du spelar in
- Du bör få upp en dialog om att återställa recording

### Fullständig Integration (om du vill ha alla features)

Om din app använder något som detta:
```javascript
// Din befintliga start recording
function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            // ... din kod
        });
}
```

Uppdatera till:
```javascript
function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            
            // Start backup system
            const recordingId = backupSystem.startRecording();
            
            // Capture chunks for backup
            mediaRecorder.ondataavailable = function(e) {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                    backupSystem.addChunk(e.data);
                }
            };
            
            // När recording stoppas
            mediaRecorder.onstop = function() {
                const recording = backupSystem.stopRecording();
                
                // Din befintliga upload-kod, men med retry
                uploadWithBackup(chunks, recording);
            };
            
            mediaRecorder.start(1000); // Capture chunks every second
        });
}

// Ny upload-funktion med automatisk retry
async function uploadWithBackup(audioChunks, backupMetadata) {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    try {
        // Din befintliga upload
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            // Om det misslyckas, använd backup-systemets retry
            backupSystem.uploadWithRetry(audioBlob, backupMetadata, 0);
        }
    } catch (error) {
        // Vid error, låt backup-systemet hantera retry
        backupSystem.uploadWithRetry(audioBlob, backupMetadata, 0);
    }
}
```

### Vad du får:

✅ **Auto-save var 30:e sekund** - Recording sparas lokalt medan du spelar in
✅ **5 backup-slots** - De 5 senaste recordings sparas alltid
✅ **Automatisk återställning** - Om sidan laddas om, får du dialog för att återställa
✅ **Retry med exponential backoff** - Om upload misslyckas, försöker igen automatiskt
✅ **Manuell nedladdning** - Användare kan ladda ner recording om allt annat misslyckas
✅ **Visuell feedback** - Recording-indikator, auto-save notifications, etc.

### Troubleshooting

**Problem: Får inte upp recovery dialog**
- Kontrollera browser console för fel
- Verifiera att localStorage fungerar: `localStorage.setItem('test', '1')`

**Problem: Auto-save fungerar inte**
- Kontrollera att `backupSystem.startRecording()` anropas
- Verifiera i DevTools > Application > Local Storage att data sparas

**Problem: Upload retry fungerar inte**
- Kontrollera att din `/api/transcribe` endpoint returnerar rätt HTTP-statuskoder
- Verifiera att servern hanterar stora filer (sätt högre timeout)

### Server-side förbättringar (valfritt)

För din Node.js/Express backend, lägg till:
```javascript
// Högre timeout för stora recordings
app.post('/api/transcribe', (req, res) => {
    req.setTimeout(300000); // 5 minuter
    // ... din transcribe-kod
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
```

### Support

Om något inte fungerar:
1. Kolla browser console för felmeddelanden
2. Testa med en kort recording först (10 sekunder)
3. Verifiera att localStorage inte är fullt: `localStorage.clear()` (OBS: raderar allt!)

Systemet är designat för att ALDRIG förlora data, även om:
- Servern kraschar
- Nätverket försvinner
- Browsern kraschar
- Användaren stänger fliken av misstag

Lycka till! 🎤💪