-- Projects & Entities Database Schema for Focus System
-- Designed för intelligent todo-orkestrerare och assistant mode

-- ===============================================
-- ENTITIES (Företag, Restauranger, Platser, etc)
-- ===============================================
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- 'company', 'restaurant', 'store', 'place', 'service'
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- 'client', 'vendor', 'favorite', 'to_visit', 'frequent'
    status VARCHAR(50), -- 'active', 'prospect', 'visited', 'must_visit', 'archived'
    
    -- Kontaktinfo och plats
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    coordinates JSONB, -- {"lat": 41.3851, "lng": 2.1734}
    
    -- Relationer och metadata
    parent_entity_id UUID REFERENCES entities(id), -- För sub-entities
    owner_id UUID REFERENCES users(id),
    tags TEXT[], -- ['vegetarian', 'trending', 'barcelona', 'upwork_client']
    metadata JSONB, -- Flexibel data {"wifi_password": "...", "opening_hours": {...}}
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_visited_at TIMESTAMPTZ,
    
    -- Search
    search_vector tsvector
);

-- ===============================================
-- PEOPLE (Personer kopplade till användare/familj)
-- ===============================================
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    email VARCHAR(255),
    phone VARCHAR(50),
    
    -- Relationer
    relationship VARCHAR(100), -- 'family', 'friend', 'colleague', 'client_contact'
    entity_id UUID REFERENCES entities(id), -- Koppling till företag
    user_id UUID REFERENCES users(id), -- Om personen har ett konto
    
    -- Metadata
    birthday DATE,
    notes TEXT,
    tags TEXT[],
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- PROJECTS (Livsprojekt med målsättningar)
-- ===============================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    life_area VARCHAR(100), -- 'work', 'family', 'renovation', 'hobby', 'health'
    
    -- Status och prioritet
    status VARCHAR(50) DEFAULT 'active', -- 'planning', 'active', 'on_hold', 'completed', 'archived'
    priority INTEGER DEFAULT 50, -- 0-100
    
    -- Ägare och deltagare
    owner_id UUID REFERENCES users(id),
    participants UUID[], -- Array av user IDs
    
    -- Kopplingar
    client_entity_id UUID REFERENCES entities(id), -- Om det är ett kundprojekt
    related_entities UUID[], -- Andra relaterade entiteter
    
    -- Timing
    start_date DATE,
    target_date DATE,
    completed_at TIMESTAMPTZ,
    
    -- AI och automation
    ai_summary TEXT, -- AI-genererad sammanfattning
    ai_next_steps TEXT[], -- AI-föreslagna nästa steg
    last_ai_analysis TIMESTAMPTZ,
    
    -- Data och historik
    notes JSONB DEFAULT '[]'::jsonb, -- Array av noter med timestamps
    attachments JSONB DEFAULT '[]'::jsonb, -- Filer, länkar, etc
    research_data JSONB DEFAULT '{}'::jsonb, -- Samlad research
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- GOALS (Målsättningar - globala och projekt-specifika)
-- ===============================================
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50), -- 'life_goal', 'yearly', 'quarterly', 'project_milestone'
    
    -- Kopplingar
    project_id UUID REFERENCES projects(id),
    parent_goal_id UUID REFERENCES goals(id), -- För sub-goals
    owner_id UUID REFERENCES users(id),
    
    -- Mätning och progress
    target_date DATE,
    target_value NUMERIC, -- Om det är mätbart
    current_value NUMERIC,
    unit VARCHAR(50), -- 'kr', 'kg', 'items', etc
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'achieved', 'failed', 'paused'
    achieved_at TIMESTAMPTZ,
    
    -- AI-assistans
    ai_suggestions TEXT[],
    ai_progress_analysis TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- TODOS (Uppgifter med AI-prioritering)
-- ===============================================
CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL,
    description TEXT,
    
    -- Kopplingar
    project_id UUID REFERENCES projects(id),
    goal_id UUID REFERENCES goals(id),
    parent_todo_id UUID REFERENCES todos(id), -- För sub-tasks
    
    -- Personer
    assigned_to UUID REFERENCES users(id),
    delegated_from UUID REFERENCES users(id),
    assigned_to_person UUID REFERENCES people(id), -- Om det inte är en användare
    
    -- Entiteter och personer
    related_entities UUID[], -- Array av entity IDs
    related_people UUID[], -- Array av people IDs
    
    -- Status och blockering
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled', 'blocked'
    blocked_by UUID REFERENCES todos(id),
    blocking_reason TEXT,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    scheduled_for DATE,
    completed_at TIMESTAMPTZ,
    
    -- AI Prioritering (körs varje natt)
    ai_priority_score FLOAT, -- 0-100
    ai_reasoning TEXT,
    ai_suggested_time VARCHAR(50), -- 'morning', 'afternoon', 'evening', 'weekend'
    last_prioritized_at TIMESTAMPTZ,
    
    -- Kontext
    life_area VARCHAR(100),
    context_mode VARCHAR(100), -- 'deep_work', 'quick_tasks', 'meetings'
    location_context VARCHAR(100), -- 'home', 'office', 'commute'
    energy_level VARCHAR(50), -- 'high', 'medium', 'low' - för att matcha med användarens energi
    
    -- Tracking
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    
    -- Metadata
    tags TEXT[],
    metadata JSONB,
    created_via VARCHAR(50), -- 'voice', 'manual', 'email', 'api'
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- THREADS (Konversationstrådar med kontext)
-- ===============================================
CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    type VARCHAR(50), -- 'research', 'project_discussion', 'brainstorm'
    
    -- Kopplingar
    project_id UUID REFERENCES projects(id),
    owner_id UUID REFERENCES users(id),
    
    -- Kontext som AI:n ska komma ihåg
    context JSONB DEFAULT '{}'::jsonb,
    system_prompt TEXT, -- Custom instructions för denna tråd
    
    -- Historik
    messages JSONB DEFAULT '[]'::jsonb, -- Array av meddelanden
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

-- ===============================================
-- RESEARCH (Sparad research kopplad till projekt)
-- ===============================================
CREATE TABLE research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    type VARCHAR(50), -- 'news', 'academic', 'market', 'competitor'
    
    -- Kopplingar
    project_id UUID REFERENCES projects(id),
    thread_id UUID REFERENCES threads(id),
    requested_by UUID REFERENCES users(id),
    
    -- Resultat
    results JSONB,
    summary TEXT,
    sources JSONB,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ===============================================
-- INDEXES för performance
-- ===============================================
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_category ON entities(category);
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_entities_owner ON entities(owner_id);
CREATE INDEX idx_entities_search ON entities USING GIN(search_vector);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_life_area ON projects(life_area);

CREATE INDEX idx_todos_assigned ON todos(assigned_to);
CREATE INDEX idx_todos_project ON todos(project_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_ai_priority ON todos(ai_priority_score DESC);
CREATE INDEX idx_todos_due_date ON todos(due_date);

CREATE INDEX idx_threads_project ON threads(project_id);
CREATE INDEX idx_research_project ON research(project_id);

-- ===============================================
-- TRIGGERS för updated_at
-- ===============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();