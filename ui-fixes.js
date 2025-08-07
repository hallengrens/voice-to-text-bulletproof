/**
 * UI Fixes för voice-to-text
 * 1. Ta bort dubbla recording badges
 * 2. Återställ pulsering på inspelningsknappen
 * 3. Ta bort onödiga download dialogs
 * 4. Lägg till Transcribe/Assistant mode toggle
 */

// 1. Ta bort överflödig recording badge
document.addEventListener('DOMContentLoaded', function() {
    // Ta bort den nya recording badge (top-left)
    const redundantBadge = document.getElementById('recording-indicator');
    if (redundantBadge) {
        redundantBadge.remove();
    }
    
    // 2. Lägg till pulsering på inspelningsknappen
    const recordButton = document.querySelector('.record-button');
    if (recordButton) {
        // Lägg till CSS för pulsering
        const style = document.createElement('style');
        style.textContent = `
            .record-button.recording {
                animation: pulse 1.5s infinite;
                background-color: #ff4444 !important;
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
            
            /* Gör "Spelar in" badge röd */
            .recording-status {
                background-color: #ff4444 !important;
                color: white !important;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 3. Blockera onödiga download dialogs
    const originalConfirm = window.confirm;
    window.confirm = function(message) {
        // Blockera endast "download recording" dialogs efter normal inspelning
        if (message.includes('download the recording') && 
            !message.includes('storage is full')) {
            return false; // Auto-reject download prompt
        }
        return originalConfirm.call(window, message);
    };
    
    // 4. Lägg till Mode Toggle (Transcribe vs Assistant)
    addModeToggle();
});

function addModeToggle() {
    // Hitta inspelningsknappen container
    const controlsContainer = document.querySelector('.controls-container') || 
                            document.querySelector('.record-controls');
    
    if (!controlsContainer) return;
    
    // Skapa mode toggle
    const modeToggle = document.createElement('div');
    modeToggle.className = 'mode-toggle';
    modeToggle.innerHTML = `
        <div class="mode-selector">
            <button class="mode-btn active" data-mode="transcribe">
                <span class="mode-icon">📝</span>
                <span class="mode-label">Transcribe</span>
            </button>
            <button class="mode-btn" data-mode="assistant">
                <span class="mode-icon">🤖</span>
                <span class="mode-label">Assistant</span>
            </button>
        </div>
    `;
    
    // Lägg till CSS för toggle
    const style = document.createElement('style');
    style.textContent = `
        .mode-toggle {
            margin: 10px 0;
            display: flex;
            justify-content: center;
        }
        
        .mode-selector {
            display: flex;
            background: #f0f0f0;
            border-radius: 25px;
            padding: 4px;
            gap: 4px;
        }
        
        .mode-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border: none;
            background: transparent;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
            color: #666;
        }
        
        .mode-btn.active {
            background: white;
            color: #333;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .mode-btn:hover:not(.active) {
            background: rgba(255,255,255,0.5);
        }
        
        .mode-icon {
            font-size: 18px;
        }
        
        /* Assistant mode specific styles */
        body.assistant-mode .transcribe-only {
            display: none !important;
        }
        
        body.transcribe-mode .assistant-only {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
    
    // Lägg till före inspelningsknappen
    controlsContainer.insertBefore(modeToggle, controlsContainer.firstChild);
    
    // Hantera mode switching
    const modeBtns = modeToggle.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active state
            modeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update body class
            const mode = this.dataset.mode;
            document.body.className = document.body.className.replace(/\b(transcribe|assistant)-mode\b/g, '');
            document.body.classList.add(`${mode}-mode`);
            
            // Store preference
            localStorage.setItem('voice-mode', mode);
            
            // Trigger mode change event
            window.dispatchEvent(new CustomEvent('modeChanged', { 
                detail: { mode: mode } 
            }));
        });
    });
    
    // Set initial mode from localStorage
    const savedMode = localStorage.getItem('voice-mode') || 'transcribe';
    document.querySelector(`[data-mode="${savedMode}"]`).click();
}

// 5. Förbättra arkiverade konversationer
function improveArchivedConversations() {
    // Lazy loading för arkiverade konversationer
    const archiveContainer = document.querySelector('.archived-conversations');
    if (!archiveContainer) return;
    
    // Implementera infinite scroll
    let loadedItems = 0;
    const itemsPerLoad = 50;
    
    archiveContainer.addEventListener('scroll', function() {
        if (archiveContainer.scrollTop + archiveContainer.clientHeight >= 
            archiveContainer.scrollHeight - 100) {
            loadMoreArchivedItems();
        }
    });
    
    function loadMoreArchivedItems() {
        // Ladda nästa 50 items
        // Detta skulle anropa ett API endpoint för att hämta mer data
        console.log(`Loading items ${loadedItems} to ${loadedItems + itemsPerLoad}`);
        loadedItems += itemsPerLoad;
    }
}

// 6. Ta bort/inaktivera icke-fungerande knappar
document.addEventListener('DOMContentLoaded', function() {
    // Inaktivera återställningsknapp om den inte fungerar
    const resetButton = document.querySelector('.reset-button');
    if (resetButton && !resetButton.onclick) {
        resetButton.style.display = 'none';
    }
    
    // Ta bort todo-lista (ska flyttas till Focus)
    const todoSection = document.querySelector('.todo-section');
    if (todoSection) {
        todoSection.style.display = 'none';
    }
});

// Kör förbättringar
improveArchivedConversations();