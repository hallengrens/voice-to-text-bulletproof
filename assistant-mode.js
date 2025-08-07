/**
 * Assistant Mode för Voice-to-Text
 * Intelligent AI-assistent som kan:
 * - Skapa och hantera projekt
 * - Göra research och spara till projekt
 * - Hålla kontext inom trådar
 * - Delegera uppgifter
 */

class AssistantMode {
    constructor() {
        this.llmAPI = 'http://localhost:4000/api/llm';
        this.projectsAPI = 'http://localhost:4000/api/projects';
        this.entitiesAPI = 'http://localhost:4000/api/entities';
        this.currentContext = null;
        this.conversationHistory = [];
        this.activeProject = null;
    }

    async processAssistantCommand(transcription, context = null) {
        // Lägg till i konversationshistorik
        this.conversationHistory.push({
            role: 'user',
            content: transcription,
            timestamp: new Date().toISOString()
        });

        // Analysera intent med AI
        const intent = await this.analyzeIntent(transcription, context);
        
        // Hantera olika kommandon
        switch(intent.type) {
            case 'CREATE_PROJECT':
                return await this.createProject(intent);
            
            case 'ADD_TO_PROJECT':
                return await this.addToProject(intent);
            
            case 'RESEARCH':
                return await this.performResearch(intent);
            
            case 'CREATE_TODO':
                return await this.createTodo(intent);
            
            case 'DELEGATE_TASK':
                return await this.delegateTask(intent);
            
            case 'LIST_PROJECTS':
                return await this.listProjects();
            
            case 'SET_CONTEXT':
                return await this.setContext(intent);
            
            case 'QUESTION':
            default:
                return await this.answerQuestion(transcription);
        }
    }

    async analyzeIntent(text, context) {
        const systemPrompt = `Du är en intelligent assistent som analyserar användarens kommandon.
        
Identifiera intent från följande kategorier:
- CREATE_PROJECT: Användaren vill skapa ett nytt projekt
- ADD_TO_PROJECT: Användaren vill lägga till information till ett projekt
- RESEARCH: Användaren vill göra research om något
- CREATE_TODO: Användaren vill skapa en todo/uppgift
- DELEGATE_TASK: Användaren vill delegera något till någon
- LIST_PROJECTS: Användaren vill se sina projekt
- SET_CONTEXT: Användaren vill sätta kontext för konversationen
- QUESTION: Användaren ställer en fråga eller behöver hjälp

Extrahera också:
- project_name: Om ett projektnamn nämns
- person: Om en person nämns
- entity: Om ett företag/plats nämns
- deadline: Om en deadline nämns

${context ? `Aktuell kontext: ${JSON.stringify(context)}` : ''}`;

        const response = await fetch(`${this.llmAPI}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Domain': 'talk.hallengren.fr'
            },
            body: JSON.stringify({
                prompt: `${systemPrompt}\n\nAnvändarens kommando: "${text}"\n\nSvara i JSON-format.`,
                model: 'gpt-4-turbo',
                max_tokens: 500,
                response_format: { type: 'json_object' }
            })
        });

        const result = await response.json();
        return JSON.parse(result.completion);
    }

    async createProject(intent) {
        const project = {
            name: intent.project_name,
            description: intent.description || '',
            life_area: intent.life_area || 'work',
            goals: intent.goals || [],
            created_at: new Date().toISOString()
        };

        const response = await fetch(`${this.projectsAPI}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });

        const created = await response.json();
        this.activeProject = created;

        // Lägg till i konversationshistorik
        this.conversationHistory.push({
            role: 'assistant',
            content: `Projekt "${created.name}" har skapats! Det är nu aktivt för denna konversation.`,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            message: `Projekt "${created.name}" har skapats!`,
            project: created
        };
    }

    async addToProject(intent) {
        const projectId = intent.project_id || this.activeProject?.id;
        
        if (!projectId) {
            return {
                success: false,
                message: 'Inget aktivt projekt. Säg vilket projekt du vill lägga till information i.'
            };
        }

        const update = {
            type: 'append_note',
            content: intent.content,
            metadata: {
                source: 'voice_assistant',
                timestamp: new Date().toISOString(),
                intent: intent
            }
        };

        const response = await fetch(`${this.projectsAPI}/projects/${projectId}/updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update)
        });

        return {
            success: true,
            message: 'Information har lagts till i projektet.'
        };
    }

    async performResearch(intent) {
        // Starta research i bakgrunden
        const researchJob = {
            query: intent.query,
            type: intent.research_type || 'general',
            depth: intent.depth || 'medium',
            sources: intent.sources || ['news', 'academic', 'web'],
            project_id: this.activeProject?.id
        };

        const response = await fetch(`${this.llmAPI}/research`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Request-Domain': 'talk.hallengren.fr'
            },
            body: JSON.stringify(researchJob)
        });

        const job = await response.json();

        // Om vi har ett aktivt projekt, spara research dit
        if (this.activeProject) {
            await this.addToProject({
                content: `Research påbörjad: ${intent.query}\nJob ID: ${job.id}`,
                project_id: this.activeProject.id
            });
        }

        return {
            success: true,
            message: `Research har startats om "${intent.query}". Du får en notifikation när den är klar.`,
            job_id: job.id
        };
    }

    async createTodo(intent) {
        const todo = {
            text: intent.text,
            project_id: intent.project_id || this.activeProject?.id,
            assigned_to: intent.assigned_to || 'self',
            deadline: intent.deadline,
            priority: 'ai-will-decide',
            created_via: 'voice_assistant'
        };

        const response = await fetch(`${this.projectsAPI}/todos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(todo)
        });

        const created = await response.json();

        return {
            success: true,
            message: `Todo skapad: "${created.text}"`,
            todo: created
        };
    }

    async delegateTask(intent) {
        const delegation = {
            task: intent.task,
            to: intent.person,
            from: 'current_user',
            project_id: this.activeProject?.id,
            deadline: intent.deadline,
            context: intent.context
        };

        const response = await fetch(`${this.projectsAPI}/delegations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(delegation)
        });

        const created = await response.json();

        return {
            success: true,
            message: `Uppgift delegerad till ${intent.person}`,
            delegation: created
        };
    }

    async listProjects() {
        const response = await fetch(`${this.projectsAPI}/projects`);
        const projects = await response.json();

        const projectList = projects.map(p => 
            `• ${p.name} (${p.life_area}) - ${p.todos_count || 0} todos`
        ).join('\n');

        return {
            success: true,
            message: `Dina projekt:\n${projectList}`,
            projects: projects
        };
    }

    async setContext(intent) {
        this.currentContext = {
            project: intent.project_name,
            thread: intent.thread_id,
            entities: intent.entities || [],
            metadata: intent.metadata
        };

        // Ladda historik om det finns en tråd
        if (intent.thread_id) {
            await this.loadThreadHistory(intent.thread_id);
        }

        return {
            success: true,
            message: `Kontext satt till: ${intent.project_name || intent.thread_id}`
        };
    }

    async answerQuestion(question) {
        // Bygg kontext från konversationshistorik
        const contextMessages = this.conversationHistory.slice(-10).map(msg => 
            `${msg.role}: ${msg.content}`
        ).join('\n');

        const systemPrompt = `Du är en hjälpsam assistent integrerad i voice-to-text systemet.
        
${this.activeProject ? `Aktivt projekt: ${this.activeProject.name}` : ''}
${this.currentContext ? `Kontext: ${JSON.stringify(this.currentContext)}` : ''}

Tidigare konversation:
${contextMessages}

Svara kort och koncist på svenska.`;

        const response = await fetch(`${this.llmAPI}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Domain': 'talk.hallengren.fr'
            },
            body: JSON.stringify({
                prompt: `${systemPrompt}\n\nFråga: ${question}`,
                model: 'gpt-4-turbo',
                max_tokens: 500
            })
        });

        const result = await response.json();
        
        // Lägg till i historik
        this.conversationHistory.push({
            role: 'assistant',
            content: result.completion,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            message: result.completion
        };
    }

    async loadThreadHistory(threadId) {
        // Ladda tidigare konversation från en tråd
        try {
            const response = await fetch(`${this.projectsAPI}/threads/${threadId}/history`);
            const history = await response.json();
            this.conversationHistory = history.messages || [];
        } catch (error) {
            console.error('Could not load thread history:', error);
        }
    }

    // Integrera med voice-to-text UI
    displayResponse(response) {
        // Visa svaret i UI
        const responseDiv = document.createElement('div');
        responseDiv.className = 'assistant-response';
        responseDiv.innerHTML = `
            <div class="response-header">
                <span class="response-icon">🤖</span>
                <span class="response-time">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="response-content">${response.message}</div>
            ${response.project ? `<div class="response-meta">Projekt: ${response.project.name}</div>` : ''}
        `;

        // Lägg till i konversationscontainer
        const container = document.querySelector('.conversation-container') || 
                         document.querySelector('.transcription-results');
        if (container) {
            container.appendChild(responseDiv);
            container.scrollTop = container.scrollHeight;
        }

        // Läs upp svaret med TTS om användaren vill
        if (window.speechSynthesis && localStorage.getItem('tts-enabled') === 'true') {
            const utterance = new SpeechSynthesisUtterance(response.message);
            utterance.lang = 'sv-SE';
            speechSynthesis.speak(utterance);
        }
    }
}

// Initiera och exportera
window.assistantMode = new AssistantMode();

// Lyssna på mode changes
window.addEventListener('modeChanged', function(e) {
    if (e.detail.mode === 'assistant') {
        console.log('Assistant mode activated');
        // Visa assistant-specifika UI element
        document.querySelectorAll('.assistant-only').forEach(el => 
            el.style.display = 'block'
        );
    }
});

// Integrera med inspelning
window.addEventListener('recordingComplete', async function(e) {
    const mode = localStorage.getItem('voice-mode') || 'transcribe';
    
    if (mode === 'assistant') {
        // I assistant mode, processar vi kommandot
        const transcription = e.detail.transcription;
        const response = await window.assistantMode.processAssistantCommand(transcription);
        window.assistantMode.displayResponse(response);
    } else {
        // I transcribe mode, bara visa transkriptionen som vanligt
        // Befintlig funktionalitet
    }
});