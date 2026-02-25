# Requisitos del Sistema de Gestión de Actas On-Call

**Proyecto:** Sistema RAG para Incidencias de Mantenimiento
**Versión:** 1.0
**Fecha:** 2026-02-18
**Autor:** MiniMax Agent
**Metodología:** EARS (Easy Approach to Requirements Syntax)

---

## 1. Lenguaje Ubicuo (Ubiquitous Language)

| Término | Definición |
|---------|------------|
| **Acta de Incidencia** | Documento que registra una o más tareas de mantenimiento realizadas durante un servicio On-Call, incluyendo metadatos (fecha, cliente, proyecto) y descripciones de problemas/soluciones. |
| **Incidencia** | Evento o problema técnico que requiere intervención del equipo On-Call, documentado con fecha, descripción del problema y solución aplicada. |
| **Cliente** | Organización externa para la cual se presta el servicio de mantenimiento On-Call. |
| **Proyecto** | Contexto específico dentro de un cliente donde se realiza el mantenimiento. Los nombres de proyecto pueden cambiar anualmente. |
| **Técnico On-Call** | Usuario del sistema que busca soluciones a problemas similares para resolver incidencias actuales. |
| **Manager** | Usuario del sistema que consulta históricos y genera reportes de incidencias. |
| **Documento Fuente** | Archivo original (PDF o Word) que contiene una o más incidencias antes de ser procesado por el sistema. |
| **Documento Estandarizado** | Acta de incidencia convertida al formato normalizado del sistema. |
| **Chunk** | Fragmento de texto extraído de un documento, optimizado para indexación vectorial. |
| **Embedding** | Representación vectorial de un chunk que permite búsqueda semántica. |
| **Base Vectorial** | Almacén de embeddings que permite búsqueda por similitud semántica. |
| **Búsqueda Semántica** | Consulta en lenguaje natural que retorna incidencias similares basándose en significado, no solo palabras clave. |
| **Relevancia** | Medida de similitud entre una consulta y los resultados encontrados. |
| **Corpus Documental** | Conjunto completo de documentos fuente organizados por cliente/año. |

---

## 2. Requisitos Funcionales

### 2.1 Ingesta de Documentos

| ID | Tipo | Requisito |
|----|------|-----------|
| **FR-ING-001** | Ubiquitous | The system shall support ingestion of documents in PDF format. |
| **FR-ING-002** | Ubiquitous | The system shall support ingestion of documents in Word format (.doc, .docx). |
| **FR-ING-003** | Ubiquitous | The system shall preserve the original folder structure (client/year) as metadata during ingestion. |
| **FR-ING-004** | Event-driven | When a new document is added to a monitored folder, the system shall automatically queue it for processing. |
| **FR-ING-005** | Event-driven | When a batch import is initiated, the system shall process documents sequentially to avoid resource exhaustion. |
| **FR-ING-006** | Ubiquitous | The system shall support bulk import of 500-2000 documents in a single operation. |
| **FR-ING-007** | Event-driven | When document ingestion fails, the system shall log the error with document path and failure reason. |
| **FR-ING-008** | Event-driven | When a duplicate document is detected, the system shall skip processing and notify the user. |

### 2.2 Procesamiento y Extracción

| ID | Tipo | Requisito |
|----|------|-----------|
| **FR-PROC-001** | Ubiquitous | The system shall extract header metadata (date, client, project) from each document. |
| **FR-PROC-002** | Ubiquitous | The system shall identify and separate multiple incidents within a single document. |
| **FR-PROC-003** | Event-driven | When processing a document, the system shall extract the task date for each incident entry. |
| **FR-PROC-004** | Event-driven | When processing a document, the system shall extract the problem description for each incident. |
| **FR-PROC-005** | Event-driven | When processing a document, the system shall extract the solution description for each incident. |
| **FR-PROC-006** | Ubiquitous | The system shall normalize extracted text removing formatting artifacts. |
| **FR-PROC-007** | Ubiquitous | The system shall generate chunks optimized for semantic search (300-500 tokens per chunk). |
| **FR-PROC-008** | Event-driven | When a project name change is detected, the system shall maintain historical name mappings. |
| **FR-PROC-009** | Ubiquitous | The system shall generate vector embeddings for each chunk using a local embedding model. |
| **FR-PROC-010** | Event-driven | When processing completes, the system shall store embeddings in the vector database. |

### 2.3 Estandarización de Formato

| ID | Tipo | Requisito |
|----|------|-----------|
| **FR-STD-001** | Ubiquitous | The system shall convert all ingested documents to a standardized JSON schema. |
| **FR-STD-002** | Ubiquitous | The system shall include the following mandatory fields in standardized documents: incident_id, client, project, task_date, problem_description, solution_description, source_file, ingestion_date. |
| **FR-STD-003** | Optional | Where the original document contains images, the system shall extract and reference them in the standardized format. |
| **FR-STD-004** | Event-driven | When standardization completes, the system shall generate a PDF version of the standardized document. |
| **FR-STD-005** | Ubiquitous | The system shall maintain bidirectional traceability between standardized documents and source files. |

### 2.4 Búsqueda Semántica

| ID | Tipo | Requisito |
|----|------|-----------|
| **FR-SRCH-001** | Ubiquitous | The system shall provide a natural language search interface. |
| **FR-SRCH-002** | Event-driven | When a search query is submitted, the system shall return semantically similar incidents ranked by relevance. |
| **FR-SRCH-003** | Ubiquitous | The system shall display search results with relevance score, client, project, date, and problem/solution summary. |
| **FR-SRCH-004** | Optional | Where filters are applied (client, project, date range), the system shall constrain search results accordingly. |
| **FR-SRCH-005** | Event-driven | When a search returns results, the system shall highlight matching text segments. |
| **FR-SRCH-006** | Ubiquitous | The system shall support searching across all historical project names for a given client. |
| **FR-SRCH-007** | Event-driven | When no relevant results are found, the system shall suggest alternative search terms. |
| **FR-SRCH-008** | Ubiquitous | The system shall return top 10 results by default with pagination support. |

### 2.5 Visualización e Interfaz

| ID | Tipo | Requisito |
|----|------|-----------|
| **FR-UI-001** | Ubiquitous | The system shall provide a web-based user interface accessible via browser. |
| **FR-UI-002** | Event-driven | When a result is selected, the system shall display the full standardized incident document. |
| **FR-UI-003** | Event-driven | When viewing an incident, the system shall provide a link to the original source document. |
| **FR-UI-004** | Ubiquitous | The system shall provide a dashboard showing ingestion statistics (total documents, processed, pending, errors). |
| **FR-UI-005** | Optional | Where the user is a Manager, the system shall provide report generation capabilities. |
| **FR-UI-006** | Event-driven | When a report is requested, the system shall generate statistics by client, project, date range, or incident type. |
| **FR-UI-007** | Ubiquitous | The system shall support exporting search results to CSV format. |
| **FR-UI-008** | Ubiquitous | The system shall provide document browsing organized by client and year hierarchy. |

### 2.6 Gestión de Datos

| ID | Tipo | Requisito |
|----|------|-----------|
| **FR-DATA-001** | Ubiquitous | The system shall store all data on-premise without external cloud dependencies. |
| **FR-DATA-002** | Event-driven | When a document is deleted, the system shall remove associated embeddings from the vector database. |
| **FR-DATA-003** | Event-driven | When project name mapping is updated, the system shall reindex affected documents. |
| **FR-DATA-004** | Ubiquitous | The system shall support manual correction of extracted metadata. |
| **FR-DATA-005** | Event-driven | When metadata is manually corrected, the system shall regenerate affected embeddings. |

---

## 3. Requisitos No Funcionales

### 3.1 Rendimiento

| ID | Tipo | Requisito |
|----|------|-----------|
| **NFR-PERF-001** | State-driven | While processing documents, the system shall process at least 50 documents per hour. |
| **NFR-PERF-002** | Event-driven | When a search query is submitted, the system shall return results within 3 seconds. |
| **NFR-PERF-003** | Ubiquitous | The system shall support a corpus of up to 10,000 documents without performance degradation. |
| **NFR-PERF-004** | Event-driven | When generating embeddings, the system shall process at least 100 chunks per minute. |
| **NFR-PERF-005** | Ubiquitous | The system shall support 10 concurrent users without performance degradation. |

### 3.2 Seguridad

| ID | Tipo | Requisito |
|----|------|-----------|
| **NFR-SEC-001** | Ubiquitous | The system shall require user authentication before access. |
| **NFR-SEC-002** | Ubiquitous | The system shall support role-based access control (Technician, Manager, Admin). |
| **NFR-SEC-003** | Optional | Where client data is sensitive, the system shall restrict access by client assignment. |
| **NFR-SEC-004** | Ubiquitous | The system shall log all user actions with timestamp and user identifier. |
| **NFR-SEC-005** | Ubiquitous | The system shall encrypt stored documents at rest. |
| **NFR-SEC-006** | Ubiquitous | The system shall transmit data over HTTPS only. |
| **NFR-SEC-007** | Event-driven | When authentication fails 5 consecutive times, the system shall lock the user account for 15 minutes. |

### 3.3 Disponibilidad y Confiabilidad

| ID | Tipo | Requisito |
|----|------|-----------|
| **NFR-AVL-001** | Ubiquitous | The system shall maintain 99% availability during business hours (8:00-20:00). |
| **NFR-AVL-002** | Event-driven | When a system component fails, the system shall continue operating in degraded mode. |
| **NFR-AVL-003** | Ubiquitous | The system shall perform automatic daily backups of the database and vector store. |
| **NFR-AVL-004** | Event-driven | When backup fails, the system shall notify administrators via email. |
| **NFR-AVL-005** | Ubiquitous | The system shall support recovery point objective (RPO) of 24 hours. |
| **NFR-AVL-006** | Ubiquitous | The system shall support recovery time objective (RTO) of 4 hours. |

### 3.4 Mantenibilidad

| ID | Tipo | Requisito |
|----|------|-----------|
| **NFR-MNT-001** | Ubiquitous | The system shall provide administrative interface for system configuration. |
| **NFR-MNT-002** | Ubiquitous | The system shall support updating embedding models without data loss. |
| **NFR-MNT-003** | Event-driven | When a new embedding model is deployed, the system shall support batch re-embedding of existing documents. |
| **NFR-MNT-004** | Ubiquitous | The system shall expose health check endpoints for monitoring. |
| **NFR-MNT-005** | Ubiquitous | The system shall log errors with sufficient context for debugging. |

### 3.5 Escalabilidad

| ID | Tipo | Requisito |
|----|------|-----------|
| **NFR-SCL-001** | Ubiquitous | The system shall support horizontal scaling of the search component. |
| **NFR-SCL-002** | Ubiquitous | The system shall support adding storage capacity without system downtime. |
| **NFR-SCL-003** | State-driven | While the document corpus exceeds 5,000 documents, the system shall automatically optimize index structures. |

### 3.6 Usabilidad

| ID | Tipo | Requisito |
|----|------|-----------|
| **NFR-USB-001** | Ubiquitous | The system shall provide interface in Spanish language. |
| **NFR-USB-002** | Ubiquitous | The system shall be accessible from modern browsers (Chrome, Firefox, Edge - last 2 versions). |
| **NFR-USB-003** | Event-driven | When an error occurs, the system shall display user-friendly error messages. |
| **NFR-USB-004** | Ubiquitous | The system shall provide contextual help for search syntax. |

### 3.7 Compatibilidad e Integración

| ID | Tipo | Requisito |
|----|------|-----------|
| **NFR-CMP-001** | Ubiquitous | The system shall run on Linux-based servers (Ubuntu 20.04+, RHEL 8+). |
| **NFR-CMP-002** | Ubiquitous | The system shall operate without internet connectivity (air-gapped deployment). |
| **NFR-CMP-003** | Ubiquitous | The system shall provide REST API for external integrations. |
| **NFR-CMP-004** | Ubiquitous | The system shall use open-source embedding models compatible with on-premise deployment. |

---

## 4. Requisitos Complejos (Multi-condición)

| ID | Requisito |
|----|-----------|
| **CR-001** | If the document format is unrecognized while processing is active when a file is submitted, the system shall quarantine the file and notify the administrator. |
| **CR-002** | If relevance score is below 0.5 while search filters are not applied when results are displayed, the system shall show a warning about low confidence matches. |
| **CR-003** | If the user is a Technician while viewing sensitive client data when export is requested, the system shall apply data masking rules. |
| **CR-004** | If disk space falls below 10% while document ingestion is active when a new batch is submitted, the system shall pause ingestion and alert administrators. |
| **CR-005** | If a project name mapping exists while searching when the user queries by old project name, the system shall automatically include results from the current project name. |

---

## 5. Matriz de Trazabilidad

| Categoría | Requisitos | Usuarios Afectados |
|-----------|------------|-------------------|
| Ingesta | FR-ING-001 a FR-ING-008 | Admin |
| Procesamiento | FR-PROC-001 a FR-PROC-010 | Sistema |
| Estandarización | FR-STD-001 a FR-STD-005 | Sistema, Manager |
| Búsqueda | FR-SRCH-001 a FR-SRCH-008 | Técnico On-Call, Manager |
| Interfaz | FR-UI-001 a FR-UI-008 | Técnico On-Call, Manager |
| Gestión de Datos | FR-DATA-001 a FR-DATA-005 | Admin |
| Rendimiento | NFR-PERF-001 a NFR-PERF-005 | Todos |
| Seguridad | NFR-SEC-001 a NFR-SEC-007 | Todos |
| Disponibilidad | NFR-AVL-001 a NFR-AVL-006 | Todos |

---

## 6. Priorización (MoSCoW)

### Must Have
- FR-ING-001, FR-ING-002, FR-ING-006
- FR-PROC-001 a FR-PROC-005, FR-PROC-009, FR-PROC-010
- FR-SRCH-001, FR-SRCH-002, FR-SRCH-003
- FR-UI-001, FR-UI-002
- NFR-SEC-001, NFR-SEC-002
- NFR-PERF-002

### Should Have
- FR-ING-003, FR-ING-004, FR-ING-007
- FR-PROC-006, FR-PROC-007, FR-PROC-008
- FR-STD-001, FR-STD-002, FR-STD-005
- FR-SRCH-004, FR-SRCH-005, FR-SRCH-006
- FR-UI-003, FR-UI-004, FR-UI-008
- NFR-AVL-003, NFR-PERF-001

### Could Have
- FR-ING-005, FR-ING-008
- FR-STD-003, FR-STD-004
- FR-SRCH-007, FR-SRCH-008
- FR-UI-005, FR-UI-006, FR-UI-007
- FR-DATA-003, FR-DATA-004, FR-DATA-005
- NFR-SCL-001, NFR-SCL-002

### Won't Have (this release)
- CR-003 (data masking)
- NFR-SCL-003 (auto-optimization)

---

## 7. Supuestos y Restricciones

### Supuestos
1. Los documentos fuente contienen texto extraíble (no son imágenes escaneadas sin OCR).
2. Existe una estructura consistente identificable en los documentos (header + contenido).
3. Los técnicos tienen conocimiento básico del dominio para formular consultas efectivas.
4. La infraestructura on-premise cuenta con recursos mínimos: 16GB RAM, 4 cores, 500GB storage.

### Restricciones
1. No se permite almacenamiento en cloud ni uso de APIs externas.
2. Los modelos de embedding deben ser open-source y ejecutables localmente.
3. El sistema debe operar en español como idioma principal.
4. Presupuesto limitado para hardware adicional.

---

*Documento generado siguiendo metodología EARS (Easy Approach to Requirements Syntax)*
