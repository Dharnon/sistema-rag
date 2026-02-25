# Arquitectura del Sistema de Gestión de Actas de Incidencias On-Call

## 1. Visión General

Sistema RAG (Retrieval-Augmented Generation) on-premise para gestión y búsqueda semántica de actas de incidencias del servicio On-Call.

**Características principales:**
- Despliegue 100% on-premise (sin dependencias cloud)
- Búsqueda en lenguaje natural sobre 500-2000 documentos
- Procesamiento de PDF y Word
- Generación de actas estandarizadas

---

## 2. Diagrama de Arquitectura

```mermaid
flowchart TB
    subgraph Frontend["Frontend Layer"]
        UI[Web UI - React/Vue]
        Search[Interfaz de Búsqueda]
        Creator[Creador de Actas]
    end

    subgraph API["API Layer"]
        Gateway[API Gateway - FastAPI]
        Auth[Autenticación]
        RateLimit[Rate Limiting]
    end

    subgraph Processing["Document Processing"]
        Ingestion[Pipeline de Ingesta]
        Parser[Document Parser - Unstructured]
        Chunker[Text Chunker]
        Extractor[Metadata Extractor]
    end

    subgraph RAG["RAG Engine"]
        Embedder[Embedding Model - sentence-transformers]
        Retriever[Vector Retriever]
        Reranker[Cross-Encoder Reranker]
        Generator[LLM Generator - Ollama]
    end

    subgraph Storage["Storage Layer"]
        VectorDB[(Qdrant - Vector Store)]
        PostgreSQL[(PostgreSQL - Metadata)]
        FileStore[(MinIO - Document Store)]
    end

    subgraph Infra["Infrastructure"]
        Queue[Redis - Task Queue]
        Cache[Redis - Cache]
        Monitor[Prometheus + Grafana]
    end

    UI --> Gateway
    Search --> Gateway
    Creator --> Gateway

    Gateway --> Auth
    Gateway --> RateLimit
    Gateway --> Ingestion
    Gateway --> Retriever

    Ingestion --> Parser
    Parser --> Chunker
    Chunker --> Extractor
    Extractor --> Embedder

    Embedder --> VectorDB
    Extractor --> PostgreSQL
    Parser --> FileStore

    Retriever --> VectorDB
    Retriever --> Reranker
    Reranker --> Generator
    Generator --> Gateway

    Ingestion --> Queue
    Gateway --> Cache
```

---

## 3. Stack Tecnológico Recomendado

### 3.1 Base de Datos Vectorial

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| **Vector Store** | **Qdrant** | Open source, alto rendimiento, filtering avanzado, on-premise nativo, API REST/gRPC |
| Alternativa | Milvus | Mayor escalabilidad pero más complejo de operar |
| Alternativa | Chroma | Más simple pero menos features para producción |

**Configuración Qdrant recomendada:**
```yaml
storage:
  storage_path: /data/qdrant
  optimizers:
    default_segment_number: 2
    max_segment_size: 200000
  quantization:
    scalar:
      type: int8
      quantile: 0.99
```

### 3.2 Modelos de Embeddings (On-Premise)

| Modelo | Dimensiones | Idioma | Uso |
|--------|-------------|--------|-----|
| **multilingual-e5-large** | 1024 | Multi (ES) | Recomendado - mejor balance |
| bge-m3 | 1024 | Multi | Alternativa con sparse vectors |
| paraphrase-multilingual-mpnet | 768 | Multi | Ligero, menor calidad |

**Implementación:** `sentence-transformers` con GPU o CPU optimizado

### 3.3 LLM Local para RAG

| Modelo | Parámetros | VRAM | Uso |
|--------|------------|------|-----|
| **Mistral 7B Instruct** | 7B | 8GB | Balance calidad/recursos |
| Llama 3.1 8B | 8B | 10GB | Mayor capacidad |
| Phi-3 Medium | 14B | 16GB | Mejor razonamiento |
| Qwen2.5 7B | 7B | 8GB | Buen soporte multilingüe |

**Servidor LLM:** Ollama (simple) o vLLM (alto rendimiento)

### 3.4 Backend/API

```
Framework:     FastAPI (Python 3.11+)
Task Queue:    Celery + Redis
ORM:           SQLAlchemy 2.0
Validación:    Pydantic v2
Auth:          JWT + LDAP/AD integration
```

### 3.5 Frontend

```
Framework:     React 18 / Vue 3
UI Library:    Shadcn/ui o Vuetify
State:         Zustand / Pinia
HTTP Client:   Axios / TanStack Query
```

### 3.6 Procesamiento de Documentos

| Tarea | Librería |
|-------|----------|
| Parsing universal | `unstructured` |
| PDF extraction | `pypdf2` + `pdfplumber` |
| Word extraction | `python-docx` |
| OCR (opcional) | `tesseract` + `pytesseract` |
| Text chunking | `langchain.text_splitter` |

---

## 4. Flujos de Datos

### 4.1 Pipeline de Ingesta

```mermaid
flowchart LR
    subgraph Input
        PDF[PDF Files]
        DOCX[Word Files]
    end

    subgraph Stage1["1. Parsing"]
        Upload[Upload Handler]
        Validator[File Validator]
        Parser[Document Parser]
    end

    subgraph Stage2["2. Processing"]
        Cleaner[Text Cleaner]
        Chunker[Semantic Chunker]
        MetaExtract[Metadata Extractor]
    end

    subgraph Stage3["3. Vectorization"]
        Embedder[Embedding Model]
        Indexer[Vector Indexer]
    end

    subgraph Storage
        VDB[(Qdrant)]
        PG[(PostgreSQL)]
        S3[(MinIO)]
    end

    PDF --> Upload
    DOCX --> Upload
    Upload --> Validator
    Validator --> Parser
    Parser --> Cleaner
    Parser -->|Original| S3
    Cleaner --> Chunker
    Chunker --> MetaExtract
    MetaExtract -->|Metadata| PG
    MetaExtract --> Embedder
    Embedder --> Indexer
    Indexer --> VDB
```

**Proceso detallado:**

1. **Upload & Validación**
   - Validar tipo MIME y extensión
   - Verificar tamaño máximo (50MB)
   - Escaneo antivirus (ClamAV)

2. **Parsing**
   - Extraer texto con `unstructured`
   - Preservar estructura (títulos, listas, tablas)
   - OCR para PDFs escaneados

3. **Chunking Semántico**
   - Tamaño: 512-1024 tokens
   - Overlap: 128 tokens
   - Respetar límites de sección

4. **Extracción de Metadatos**
   - Fecha de incidencia
   - Sistemas afectados
   - Severidad
   - Técnico responsable
   - Estado de resolución

5. **Vectorización**
   - Generar embeddings por chunk
   - Almacenar en Qdrant con payload de metadatos

### 4.2 Pipeline de Búsqueda RAG

```mermaid
flowchart LR
    subgraph Input
        Query[Consulta Usuario]
    end

    subgraph Retrieval["1. Retrieval"]
        QueryEmbed[Query Embedding]
        VectorSearch[Vector Search]
        MetaFilter[Metadata Filtering]
        Rerank[Cross-Encoder Rerank]
    end

    subgraph Augmentation["2. Augmentation"]
        ContextBuilder[Context Builder]
        PromptTemplate[Prompt Template]
    end

    subgraph Generation["3. Generation"]
        LLM[Mistral 7B]
        PostProcess[Post-Processor]
    end

    subgraph Output
        Response[Respuesta + Fuentes]
    end

    Query --> QueryEmbed
    QueryEmbed --> VectorSearch
    VectorSearch --> MetaFilter
    MetaFilter --> Rerank
    Rerank -->|Top-K docs| ContextBuilder
    ContextBuilder --> PromptTemplate
    PromptTemplate --> LLM
    LLM --> PostProcess
    PostProcess --> Response
```

**Configuración de búsqueda:**

```python
SEARCH_CONFIG = {
    "initial_retrieval": 20,      # Documentos iniciales
    "rerank_top_k": 5,            # Tras reranking
    "similarity_threshold": 0.7,   # Score mínimo
    "max_context_tokens": 4096,   # Contexto para LLM
}
```

### 4.3 Flujo de Creación de Nuevas Actas

```mermaid
flowchart TB
    subgraph UI["Interfaz de Creación"]
        Form[Formulario Estructurado]
        Preview[Vista Previa]
    end

    subgraph Processing["Procesamiento"]
        Validator[Validador de Campos]
        Template[Motor de Templates]
        Enricher[Enriquecedor - Similar Incidents]
    end

    subgraph Generation["Generación"]
        DocGen[Generador de Documento]
        PDFExport[Exportador PDF]
    end

    subgraph Storage["Almacenamiento"]
        Save[Guardar Acta]
        Index[Indexar para RAG]
    end

    Form --> Validator
    Validator --> Template
    Template --> Enricher
    Enricher -->|Incidencias similares| Preview
    Preview -->|Confirmar| DocGen
    DocGen --> PDFExport
    DocGen --> Save
    Save --> Index
```

---

## 5. Esquema de Datos

### 5.1 Estructura Estandarizada de Actas

```python
from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional, List

class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class IncidentStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

class IncidentReport(BaseModel):
    # Identificación
    id: str                           # UUID
    incident_number: str              # INC-2024-001234
    title: str                        # Título descriptivo

    # Temporalidad
    detected_at: datetime             # Fecha/hora detección
    resolved_at: Optional[datetime]   # Fecha/hora resolución
    created_at: datetime              # Fecha creación del acta

    # Clasificación
    severity: Severity
    status: IncidentStatus
    category: str                     # Categoría principal
    subcategory: Optional[str]        # Subcategoría

    # Sistemas afectados
    affected_systems: List[str]       # ["SAP", "CRM", "Email"]
    affected_services: List[str]      # ["Facturación", "Pedidos"]
    environment: str                  # "production", "staging"

    # Descripción
    summary: str                      # Resumen ejecutivo
    description: str                  # Descripción detallada
    root_cause: Optional[str]         # Causa raíz identificada
    impact: str                       # Impacto en el negocio

    # Resolución
    resolution_steps: List[str]       # Pasos de resolución
    workaround: Optional[str]         # Workaround aplicado
    preventive_actions: List[str]     # Acciones preventivas

    # Responsables
    reported_by: str                  # Usuario que reportó
    assigned_to: str                  # Técnico asignado
    resolved_by: Optional[str]        # Técnico que resolvió

    # Métricas
    ttd_minutes: Optional[int]        # Time to Detect
    ttr_minutes: Optional[int]        # Time to Resolve

    # Referencias
    related_incidents: List[str]      # IDs de incidencias relacionadas
    external_tickets: List[str]       # Tickets externos (ServiceNow, etc.)
    attachments: List[str]            # Rutas a archivos adjuntos

    # Metadatos
    tags: List[str]                   # Etiquetas para búsqueda
    version: int                      # Versión del documento
```

### 5.2 Esquema PostgreSQL - Metadatos

```sql
-- Tabla principal de incidencias
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_number VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,

    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),

    environment VARCHAR(50) NOT NULL,
    summary TEXT NOT NULL,
    description TEXT,
    root_cause TEXT,
    impact TEXT,
    workaround TEXT,

    reported_by VARCHAR(100) NOT NULL,
    assigned_to VARCHAR(100),
    resolved_by VARCHAR(100),

    ttd_minutes INTEGER,
    ttr_minutes INTEGER,

    document_path VARCHAR(500),  -- Ruta en MinIO

    -- Índices para búsqueda
    search_vector TSVECTOR,

    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'))
);

-- Sistemas afectados (relación N:M)
CREATE TABLE incident_systems (
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    system_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (incident_id, system_name)
);

-- Servicios afectados
CREATE TABLE incident_services (
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (incident_id, service_name)
);

-- Pasos de resolución
CREATE TABLE resolution_steps (
    id SERIAL PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    description TEXT NOT NULL
);

-- Tags para búsqueda
CREATE TABLE incident_tags (
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    PRIMARY KEY (incident_id, tag)
);

-- Chunks para RAG (referencia a Qdrant)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    token_count INTEGER,
    qdrant_point_id UUID,  -- ID en Qdrant
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at DESC);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_category ON incidents(category);
CREATE INDEX idx_incidents_search ON incidents USING GIN(search_vector);
CREATE INDEX idx_chunks_incident ON document_chunks(incident_id);
```

### 5.3 Schema de Vectores (Qdrant)

```python
# Configuración de colección Qdrant
COLLECTION_CONFIG = {
    "collection_name": "incident_chunks",
    "vectors_config": {
        "size": 1024,  # multilingual-e5-large
        "distance": "Cosine"
    },
    "optimizers_config": {
        "default_segment_number": 2,
        "indexing_threshold": 20000
    },
    "quantization_config": {
        "scalar": {
            "type": "int8",
            "quantile": 0.99,
            "always_ram": True
        }
    }
}

# Estructura del payload por punto
POINT_PAYLOAD_SCHEMA = {
    # Identificadores
    "incident_id": "uuid",
    "incident_number": "string",
    "chunk_id": "uuid",
    "chunk_index": "integer",

    # Metadatos para filtering
    "severity": "keyword",           # Filtrable
    "status": "keyword",             # Filtrable
    "category": "keyword",           # Filtrable
    "environment": "keyword",        # Filtrable
    "detected_at": "datetime",       # Filtrable por rango

    # Arrays para filtering
    "affected_systems": ["keyword"], # Filtro IN
    "tags": ["keyword"],             # Filtro IN

    # Texto para contexto
    "title": "text",
    "chunk_text": "text",

    # Métricas
    "ttr_minutes": "integer"
}
```

**Ejemplo de query con filtros:**

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, Range

# Búsqueda con filtros
results = client.search(
    collection_name="incident_chunks",
    query_vector=query_embedding,
    query_filter=Filter(
        must=[
            FieldCondition(
                key="severity",
                match=MatchValue(value="critical")
            ),
            FieldCondition(
                key="detected_at",
                range=Range(gte="2024-01-01T00:00:00Z")
            )
        ],
        should=[
            FieldCondition(
                key="affected_systems",
                match=MatchValue(value="SAP")
            )
        ]
    ),
    limit=20,
    with_payload=True
)
```

---

## 6. Consideraciones de Infraestructura

### 6.1 Requisitos de Hardware

#### Configuración Mínima (500-1000 docs)

| Componente | Especificación |
|------------|----------------|
| **CPU** | 8 cores (Intel Xeon / AMD EPYC) |
| **RAM** | 32 GB |
| **GPU** | NVIDIA RTX 3060 12GB (opcional pero recomendado) |
| **Almacenamiento** | 500 GB SSD NVMe |
| **Red** | 1 Gbps |

#### Configuración Recomendada (1000-2000 docs)

| Componente | Especificación |
|------------|----------------|
| **CPU** | 16 cores |
| **RAM** | 64 GB |
| **GPU** | NVIDIA RTX 4070 12GB o T4 16GB |
| **Almacenamiento** | 1 TB SSD NVMe + 2 TB HDD backup |
| **Red** | 10 Gbps |

#### Distribución de Recursos

```
┌─────────────────────────────────────────────────────────────┐
│                    Servidor Principal                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   FastAPI   │  │   Celery    │  │   Redis     │         │
│  │   4 GB RAM  │  │   4 GB RAM  │  │   2 GB RAM  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Qdrant    │  │ PostgreSQL  │  │   MinIO     │         │
│  │   8 GB RAM  │  │   4 GB RAM  │  │   2 GB RAM  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │              Ollama (Mistral 7B)                 │       │
│  │              8-12 GB VRAM / 16 GB RAM CPU        │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │           Embedding Model (e5-large)             │       │
│  │              4 GB VRAM / 8 GB RAM CPU            │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Arquitectura de Despliegue

```yaml
# docker-compose.yml (producción)
version: '3.8'

services:
  # API Backend
  api:
    image: incident-rag-api:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/incidents
      - QDRANT_HOST=qdrant
      - REDIS_URL=redis://redis:6379
      - OLLAMA_HOST=ollama:11434
    depends_on:
      - postgres
      - qdrant
      - redis
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '4'

  # Worker para procesamiento async
  worker:
    image: incident-rag-api:latest
    command: celery -A app.worker worker -l info -c 4
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/incidents
      - QDRANT_HOST=qdrant
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - postgres
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: '4'

  # Frontend
  frontend:
    image: incident-rag-frontend:latest
    ports:
      - "80:80"
    depends_on:
      - api

  # Base de datos vectorial
  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant_data:/qdrant/storage
    ports:
      - "6333:6333"
    deploy:
      resources:
        limits:
          memory: 8G

  # Base de datos relacional
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=incidents
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 4G

  # Cache y cola
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 2G

  # Object storage
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  # LLM Server
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  qdrant_data:
  postgres_data:
  redis_data:
  minio_data:
  ollama_data:
```

### 6.3 Escalabilidad

#### Escalado Horizontal

```
Fase 1: Monolito (500-1000 docs)
├── 1x Servidor todo-en-uno
└── Suficiente para ~10 usuarios concurrentes

Fase 2: Separación (1000-2000 docs)
├── 1x Servidor API + Workers
├── 1x Servidor DB (PostgreSQL + Qdrant)
└── 1x Servidor LLM (Ollama)

Fase 3: Alta Disponibilidad (2000+ docs)
├── 2x API Servers (load balanced)
├── 3x Workers (Celery)
├── 1x PostgreSQL Primary + 1x Replica
├── 3x Qdrant cluster nodes
└── 2x LLM Servers
```

#### Métricas de Capacidad

| Métrica | Valor Esperado |
|---------|----------------|
| Latencia búsqueda (P95) | < 2 segundos |
| Latencia ingesta/documento | 10-30 segundos |
| Throughput búsquedas | 50 req/min |
| Documentos concurrentes ingesta | 5 |
| Usuarios concurrentes | 20-50 |

### 6.4 Backup y Recovery

#### Estrategia de Backup

```bash
#!/bin/bash
# backup.sh - Ejecutar diariamente

BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 1. PostgreSQL
pg_dump -h localhost -U user incidents | gzip > $BACKUP_DIR/postgres.sql.gz

# 2. Qdrant snapshots
curl -X POST "http://localhost:6333/collections/incident_chunks/snapshots"

# 3. MinIO (documentos originales)
mc mirror minio/incidents $BACKUP_DIR/documents/

# 4. Configuraciones
cp -r /etc/incident-rag/ $BACKUP_DIR/config/

# Retención: 30 días
find /backup -type d -mtime +30 -exec rm -rf {} \;
```

#### Plan de Recovery

| Escenario | RTO | RPO | Procedimiento |
|-----------|-----|-----|---------------|
| Fallo de API | 5 min | 0 | Restart container |
| Corrupción PostgreSQL | 30 min | 24h | Restore from backup |
| Pérdida Qdrant | 1h | 24h | Restore snapshot + re-index |
| Fallo total servidor | 4h | 24h | Restore en nuevo hardware |

#### Procedimiento de Restore

```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1  # Ej: 20240115

# 1. Restaurar PostgreSQL
gunzip -c /backup/$BACKUP_DATE/postgres.sql.gz | psql -h localhost -U user incidents

# 2. Restaurar Qdrant
curl -X PUT "http://localhost:6333/collections/incident_chunks/snapshots/recover" \
  -H "Content-Type: application/json" \
  -d "{\"location\": \"/backup/$BACKUP_DATE/qdrant_snapshot\"}"

# 3. Restaurar documentos
mc mirror /backup/$BACKUP_DATE/documents/ minio/incidents
```

---

## 7. Seguridad

### 7.1 Autenticación y Autorización

```python
# Roles y permisos
ROLES = {
    "technician": [
        "search:read",
        "incidents:read",
        "incidents:create"
    ],
    "manager": [
        "search:read",
        "incidents:read",
        "incidents:create",
        "incidents:update",
        "reports:read"
    ],
    "admin": [
        "*"  # Todos los permisos
    ]
}
```

### 7.2 Checklist de Seguridad

- [ ] HTTPS obligatorio (TLS 1.3)
- [ ] Integración LDAP/Active Directory
- [ ] Rate limiting por usuario
- [ ] Logs de auditoría
- [ ] Sanitización de inputs
- [ ] Escaneo antivirus en uploads
- [ ] Backup encriptado (AES-256)
- [ ] Segmentación de red

---

## 8. Restricciones Arquitectónicas

### 8.1 Obligatorias

| Restricción | Descripción |
|-------------|-------------|
| **On-Premise Only** | Sin dependencias de servicios cloud |
| **Sin OpenAI/APIs externas** | LLM y embeddings locales |
| **Air-gapped compatible** | Debe funcionar sin internet |
| **Datos en territorio** | Cumplimiento GDPR/LOPD |

### 8.2 Stack Prohibido

- OpenAI API, Azure OpenAI, AWS Bedrock
- Pinecone, Weaviate Cloud
- Firebase, Supabase
- Cualquier SaaS con datos fuera de la organización

### 8.3 Stack Permitido

- Modelos open source (Mistral, Llama, Qwen)
- Bases de datos self-hosted
- Frameworks open source
- Contenedores Docker/Podman

---

## 9. Próximos Pasos

1. **Validación de infraestructura** - Confirmar disponibilidad de hardware
2. **PoC de embeddings** - Evaluar modelos con documentos reales
3. **PoC de LLM** - Test de calidad de respuestas con Mistral vs Llama
4. **Diseño de UI/UX** - Wireframes de interfaz de búsqueda
5. **Pipeline CI/CD** - Configurar GitLab CI para despliegue
6. **Plan de migración** - Estrategia para ingesta inicial de documentos

---

*Documento generado: 2026-02-20*
*Versión: 1.0*
*Autor: MiniMax Agent*
