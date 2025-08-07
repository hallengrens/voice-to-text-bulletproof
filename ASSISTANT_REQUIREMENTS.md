# Assistant Mode - Kravspecifikation

## Vision
Huvudsaklig assistent för hela hallengren.fr arkitekturen med fullständig kännedom om alla tjänster och API:er.

## Kärnfunktionalitet

### 1. API Awareness
- **Måste ha koll på ALLA endpoints** inom hallengren.fr
- Kunna dynamiskt upptäcka vad som krävs för varje endpoint
- Ställa följdfrågor baserat på API-krav
- Exempel: "Skapa projekt" → AI vet vilka fält som krävs → frågar om det som saknas

### 2. Dialogbaserad Interaktion
- **Inte snabbkommandon** - intelligent dialog
- AI ställer följdfrågor för att få komplett information
- Exempel: "Hur ser driften ut?" → AI kollar /api/status → rapporterar → kan starta debug-agent vid behov

### 3. Minneshantering

#### Projektminne
- Kronologisk logg av alla händelser
- Konversationstrådar per projekt (delad mellan teammedlemmar)
- Resurser (länkar, filer, MD-instruktioner)
- Komprimerad projektfil för LLM-kontext

#### Container-baserat minne
- Huvudflödet = ingen historik
- I container = full kontext av allt i containern
- Automatisk komprimering när kontext blir för stor
- Spara unik information (min kompetens) men inte AI-genererat innehåll

#### "Usual Suspects" - Top 10
- Top 10 personer, platser, projekt, entiteter
- Alltid i kontext för snabb access
- Minska latens genom att kolla vanligaste först

### 4. Integrationer
- **Alla hallengren.fr API:er och tjänster**
- Notification Center - skicka notiser
- Email - läsa inkommande, föreslå svar (med godkännande)
- Claude Code agents - trigga debug/utveckling på servrar

### 5. Projekt & Entity Management
- Skapa/uppdatera projekt via röstkommandon
- Research som sparas till projekt
- Versionshantering på all data
- Audit log - vem gjorde vad (assistent vs människa)

### 6. Use Cases

#### Upwork Workflow
1. Container för Upwork-ansökningar med persistent kontext
2. Spara unik info om min kompetens/erfarenhet
3. Hitta relevanta tidigare projekt som case
4. Generera anpassade ansökningar
5. INTE spara genererade ansökningar (bara källmaterial)

#### Email Assistant
- Läsa inkommande mail
- Kolla projektstatus för relevanta förfrågningar
- Föreslå svar baserat på projektinfo
- Vänta på godkännande innan utskick

## Tekniska Val

### LLM
- **Gemini 2.0 Flash** för allt initialt (kostnadseffektivt)
- Alla LLM-anrop via vårt LLM API (token tracking)
- Kanske separat `/api/assistant/*` endpoints

### localStorage Problem (AKUT!)
- Chunks är 3.3MB men localStorage blir full efter 2-3 min
- Måste lösas innan vi kan fortsätta
- Popups varje minut är oacceptabelt

## Implementation Approach

### Fas 1: Research & Design
1. Mappa alla befintliga API endpoints
2. Designa assistant API struktur
3. Lösa localStorage-problemet

### Fas 2: Core Assistant
1. API awareness system
2. Dialog manager med följdfrågor
3. Container-baserat minne

### Fas 3: Integrationer
1. Projekt/Entity management
2. Email integration
3. Agent triggering

## Nästa Session
- Fortsätt med localStorage fix
- Börja implementation av API awareness
- Dokumentera alla endpoints som assistenten behöver känna till