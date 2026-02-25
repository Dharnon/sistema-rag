# Plan de Implementacion - Sistema RAG Actas On-Call

**Proyecto:** Sistema de Gestion de Actas de Incidencias On-Call
**Version:** 1.0
**Fecha:** 2026-02-21
**Autor:** MiniMax Agent

---

## Resumen de Fases

| Fase | Descripcion | Tareas | Complejidad Total |
|------|-------------|--------|-------------------|
| 1 | Infraestructura Base | 8 | M |
| 2 | Backend Core | 12 | L |
| 3 | Frontend | 8 | M |
| 4 | Integracion y Testing | 6 | M |
| **Total** | | **34 tareas** | |

**Leyenda de Complejidad:**
- **S** (Small): 1-4 horas
- **M** (Medium): 4-16 horas
- **L** (Large): 16-40 horas

---

## Fase 1: Infraestructura Base

### INF-001: Crear estructura de proyecto base

| Campo | Valor |
|-------|-------|
| **Descripcion** | Crear estructura de directorios, archivos de configuracion base y repositorio Git |
| **Dependencias** | Ninguna |
| **Complejidad** | S |
| **Criterio de Aceptacion** | Estructura de carpetas creada: `/backend`, `/frontend`, `/docker`, `/scripts`, `/docs`. Archivo `.gitignore` y `README.md` presentes. |

**Estructura requerida:**
```
project/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── services/
│   │   └── workers/
│   ├── tests/
│   └── requirements.txt
├── frontend/
├── docker/
├── scripts/
└── docs/
```

---

### INF-002: Configurar Docker Compose base

| Campo | Valor |
|-------|-------|
| **Descripcion** | Crear `docker-compose.yml` con definicion de todos los servicios (sin configuracion detallada) |
| **Dependencias** | INF-001 |
| **Complejidad** | S |
| **Criterio de Aceptacion** | `docker-compose.yml` con servicios declarados: api, worker, frontend, postgres, qdrant, redis, minio, ollama. Comando `docker-compose config` valida sin errores. |

---

### INF-003: Configurar PostgreSQL con esquema inicial

| Campo | Valor |
|-------|-------|
| **Descripcion** | Configurar servicio PostgreSQL en Docker, crear esquema de base de datos con tablas: `incidents`, `incident_systems`, `incident_services`, `resolution_steps`, `incident_tags`, `document_chunks` |
| **Dependencias** | INF-002 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | PostgreSQL accesible en puerto 5432. Todas las tablas creadas con indices definidos. Script de migracion inicial ejecutable. Healthcheck OK. |

**Tablas requeridas (segun arquitectura):**
- `incidents` - Tabla principal
- `incident_systems` - Sistemas afectados (N:M)
- `incident_services` - Servicios afectados
- `resolution_steps` - Pasos de resolucion
- `incident_tags` - Tags para busqueda
- `document_chunks` - Referencia a chunks en Qdrant

---

### INF-004: Configurar Qdrant vector database

| Campo | Valor |
|-------|-------|
| **Descripcion** | Configurar Qdrant en Docker, crear coleccion `incident_chunks` con configuracion de vectores (1024 dims, cosine) y quantization |
| **Dependencias** | INF-002 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Qdrant accesible en puerto 6333. Coleccion `incident_chunks` creada con: vectors size=1024, distance=Cosine, quantization int8. API REST responde correctamente. |

**Configuracion requerida:**
```python
{
    "collection_name": "incident_chunks",
    "vectors_config": {"size": 1024, "distance": "Cosine"},
    "quantization_config": {"scalar": {"type": "int8", "quantile": 0.99}}
}
```

---

### INF-005: Configurar MinIO object storage

| Campo | Valor |
|-------|-------|
| **Descripcion** | Configurar MinIO en Docker, crear buckets para documentos originales y procesados |
| **Dependencias** | INF-002 |
| **Complejidad** | S |
| **Criterio de Aceptacion** | MinIO accesible en puerto 9000 (API) y 9001 (consola). Buckets creados: `incidents-raw`, `incidents-processed`. Credenciales configuradas en variables de entorno. |

---

### INF-006: Configurar Redis para cache y cola

| Campo | Valor |
|-------|-------|
| **Descripcion** | Configurar Redis en Docker para Celery task queue y cache de aplicacion |
| **Dependencias** | INF-002 |
| **Complejidad** | S |
| **Criterio de Aceptacion** | Redis accesible en puerto 6379. Persistencia habilitada (AOF). Test de conexion desde aplicacion exitoso. |

---

### INF-007: Configurar Ollama con modelos LLM

| Campo | Valor |
|-------|-------|
| **Descripcion** | Configurar Ollama en Docker, descargar y configurar modelo Mistral 7B Instruct |
| **Dependencias** | INF-002 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Ollama accesible en puerto 11434. Modelo `mistral:7b-instruct` descargado y disponible. Endpoint `/api/generate` responde correctamente. GPU detectada (si disponible). |

**Verificacion:**
```bash
curl http://localhost:11434/api/generate -d '{"model":"mistral:7b-instruct","prompt":"test"}'
```

---

### INF-008: Crear script de inicializacion completo

| Campo | Valor |
|-------|-------|
| **Descripcion** | Script `init.sh` que levanta toda la infraestructura, espera healthchecks, y ejecuta migraciones |
| **Dependencias** | INF-003, INF-004, INF-005, INF-006, INF-007 |
| **Complejidad** | S |
| **Criterio de Aceptacion** | Script `./scripts/init.sh` ejecuta `docker-compose up`, espera que todos los servicios esten healthy, ejecuta migraciones de PostgreSQL, crea colecciones en Qdrant, crea buckets en MinIO. Exit code 0 en ejecucion exitosa. |

---

## Fase 2: Backend Core

### API-001: Estructura base FastAPI

| Campo | Valor |
|-------|-------|
| **Descripcion** | Crear aplicacion FastAPI con estructura de routers, middleware, configuracion y health endpoints |
| **Dependencias** | INF-008 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Aplicacion FastAPI iniciable. Endpoints `/health` y `/ready` funcionales. CORS configurado. Documentacion OpenAPI accesible en `/docs`. |

**Estructura:**
```
app/
├── main.py
├── core/
│   ├── config.py      # Settings con Pydantic
│   └── deps.py        # Dependencies injection
├── api/
│   ├── v1/
│   │   ├── router.py
│   │   ├── incidents.py
│   │   ├── search.py
│   │   └── documents.py
```

---

### API-002: Modelos Pydantic y SQLAlchemy

| Campo | Valor |
|-------|-------|
| **Descripcion** | Definir modelos de datos: Pydantic schemas para API, SQLAlchemy models para ORM |
| **Dependencias** | API-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Modelos `IncidentReport`, `DocumentChunk` definidos. Schemas de request/response para todos los endpoints. Validaciones funcionando (severidad, status, campos obligatorios). |

**Modelos requeridos (segun FR-STD-002):**
- `incident_id`, `client`, `project`, `task_date`
- `problem_description`, `solution_description`
- `source_file`, `ingestion_date`

---

### API-003: Sistema de autenticacion JWT

| Campo | Valor |
|-------|-------|
| **Descripcion** | Implementar autenticacion JWT con roles (Technician, Manager, Admin) |
| **Dependencias** | API-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Endpoint `/auth/login` genera JWT. Middleware valida tokens. Roles verificados en endpoints protegidos. Lockout tras 5 intentos fallidos (NFR-SEC-007). |

**Roles (segun NFR-SEC-002):**
- `technician`: search:read, incidents:read, incidents:create
- `manager`: + incidents:update, reports:read
- `admin`: todos los permisos

---

### API-004: CRUD de incidencias

| Campo | Valor |
|-------|-------|
| **Descripcion** | Endpoints REST para crear, leer, actualizar y eliminar incidencias |
| **Dependencias** | API-002, API-003 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Endpoints funcionales: `POST /incidents`, `GET /incidents/{id}`, `PUT /incidents/{id}`, `DELETE /incidents/{id}`. Paginacion en listado. Filtros por cliente/proyecto/fecha. |

---

### DOC-001: Servicio de upload de documentos

| Campo | Valor |
|-------|-------|
| **Descripcion** | Endpoint para upload de documentos PDF/Word a MinIO con validacion |
| **Dependencias** | API-001, INF-005 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Endpoint `POST /documents/upload` acepta PDF y Word. Validacion MIME type. Limite 50MB. Documento guardado en MinIO con path cliente/anio/. Duplicados detectados (FR-ING-008). |

**Requisitos (FR-ING-001, FR-ING-002):**
- Soporte PDF
- Soporte Word (.doc, .docx)
- Preservar estructura carpetas como metadata (FR-ING-003)

---

### DOC-002: Parser de documentos

| Campo | Valor |
|-------|-------|
| **Descripcion** | Servicio para extraer texto de PDF y Word usando `unstructured` |
| **Dependencias** | DOC-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Extraccion de texto de PDF funcional. Extraccion de texto de Word funcional. Preservacion de estructura (titulos, listas). Manejo de errores con logging (FR-ING-007). |

---

### DOC-003: Extractor de metadatos

| Campo | Valor |
|-------|-------|
| **Descripcion** | Servicio para extraer metadatos (fecha, cliente, proyecto, problema, solucion) de documentos |
| **Dependencias** | DOC-002 |
| **Complejidad** | L |
| **Criterio de Aceptacion** | Extraccion de: fecha incidencia (FR-PROC-003), descripcion problema (FR-PROC-004), descripcion solucion (FR-PROC-005). Separacion de multiples incidencias por documento (FR-PROC-002). Normalizacion de texto (FR-PROC-006). |

---

### DOC-004: Servicio de chunking

| Campo | Valor |
|-------|-------|
| **Descripcion** | Dividir documentos en chunks optimizados para busqueda semantica |
| **Dependencias** | DOC-003 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Chunks de 300-500 tokens (FR-PROC-007). Overlap de 128 tokens. Respeto de limites de seccion. Chunks almacenados en PostgreSQL con referencia a documento origen. |

---

### EMB-001: Servicio de embeddings

| Campo | Valor |
|-------|-------|
| **Descripcion** | Servicio para generar embeddings usando `multilingual-e5-large` con sentence-transformers |
| **Dependencias** | DOC-004 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Modelo `multilingual-e5-large` cargado. Generacion de embeddings 1024 dims. Rendimiento >= 100 chunks/minuto (NFR-PERF-004). Embeddings almacenados en Qdrant con payload de metadatos (FR-PROC-010). |

---

### RAG-001: Servicio de busqueda semantica

| Campo | Valor |
|-------|-------|
| **Descripcion** | Implementar busqueda vectorial en Qdrant con filtros de metadatos |
| **Dependencias** | EMB-001, INF-004 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Endpoint `POST /search` acepta query en lenguaje natural. Resultados rankeados por relevancia (FR-SRCH-002). Filtros por cliente/proyecto/fecha (FR-SRCH-004). Top 10 resultados por defecto (FR-SRCH-008). Latencia < 3 segundos (NFR-PERF-002). |

---

### RAG-002: Reranking y generacion de respuestas

| Campo | Valor |
|-------|-------|
| **Descripcion** | Implementar cross-encoder reranking y generacion de respuestas con Ollama |
| **Dependencias** | RAG-001, INF-007 |
| **Complejidad** | L |
| **Criterio de Aceptacion** | Reranking de top-20 a top-5 con cross-encoder. Contexto construido para LLM. Respuesta generada con Mistral 7B. Fuentes citadas en respuesta. Highlight de texto matching (FR-SRCH-005). |

---

### WRK-001: Worker Celery para procesamiento async

| Campo | Valor |
|-------|-------|
| **Descripcion** | Configurar Celery con Redis para tareas de ingesta en background |
| **Dependencias** | INF-006, DOC-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Worker Celery conectado a Redis. Tasks definidas: `process_document`, `generate_embeddings`, `reindex_collection`. Procesamiento secuencial para evitar agotamiento de recursos (FR-ING-005). Rendimiento >= 50 docs/hora (NFR-PERF-001). |

---

## Fase 3: Frontend

### UI-001: Setup proyecto React

| Campo | Valor |
|-------|-------|
| **Descripcion** | Crear proyecto React con Vite, configurar TailwindCSS, router y estado global |
| **Dependencias** | API-001 |
| **Complejidad** | S |
| **Criterio de Aceptacion** | Proyecto React con Vite creado. TailwindCSS configurado. React Router instalado. Zustand para estado global. Axios configurado con interceptors para auth. Interfaz en espanol (NFR-USB-001). |

---

### UI-002: Layout y navegacion base

| Campo | Valor |
|-------|-------|
| **Descripcion** | Crear layout principal con sidebar, header y sistema de navegacion |
| **Dependencias** | UI-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Layout responsive. Sidebar con menu de navegacion. Header con usuario/logout. Breadcrumbs. Compatible con Chrome, Firefox, Edge (NFR-USB-002). |

---

### UI-003: Pagina de login

| Campo | Valor |
|-------|-------|
| **Descripcion** | Formulario de autenticacion con manejo de errores |
| **Dependencias** | UI-002, API-003 |
| **Complejidad** | S |
| **Criterio de Aceptacion** | Formulario login funcional. Almacenamiento JWT en localStorage. Redireccion post-login. Mensajes de error amigables (NFR-USB-003). Indicador de cuenta bloqueada. |

---

### UI-004: Interfaz de busqueda semantica

| Campo | Valor |
|-------|-------|
| **Descripcion** | Pagina principal de busqueda con campo de texto natural, filtros y resultados |
| **Dependencias** | UI-002, RAG-001 |
| **Complejidad** | L |
| **Criterio de Aceptacion** | Campo de busqueda en lenguaje natural (FR-SRCH-001). Filtros: cliente, proyecto, rango fechas, severidad. Resultados con score, cliente, proyecto, fecha, resumen (FR-SRCH-003). Paginacion. Highlight de matches. Ayuda contextual para sintaxis (NFR-USB-004). |

---

### UI-005: Visor de actas/incidencias

| Campo | Valor |
|-------|-------|
| **Descripcion** | Pagina de detalle de incidencia con toda la informacion estructurada |
| **Dependencias** | UI-002, API-004 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Vista completa de incidencia (FR-UI-002). Seccion metadatos (fecha, cliente, severidad). Descripcion problema y solucion. Link a documento fuente (FR-UI-003). Incidencias relacionadas. Boton exportar. |

---

### UI-006: Formulario nueva acta

| Campo | Valor |
|-------|-------|
| **Descripcion** | Formulario para crear nuevas actas de incidencia con validacion |
| **Dependencias** | UI-002, API-004 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Formulario con todos los campos requeridos. Validacion client-side. Seleccion de sistemas/servicios afectados. Upload de archivos adjuntos. Preview antes de guardar. Sugerencias de incidencias similares al escribir. |

---

### UI-007: Dashboard de estadisticas

| Campo | Valor |
|-------|-------|
| **Descripcion** | Dashboard con metricas de ingesta, documentos procesados, estadisticas por cliente |
| **Dependencias** | UI-002, API-004 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | KPIs: total documentos, procesados, pendientes, errores (FR-UI-004). Grafico incidencias por fecha. Desglose por cliente. Desglose por severidad. Solo visible para rol Manager (FR-UI-005). |

---

### UI-008: Navegador de documentos

| Campo | Valor |
|-------|-------|
| **Descripcion** | Vista de arbol para navegar documentos por cliente y anio |
| **Dependencias** | UI-002, DOC-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Arbol de carpetas cliente/anio (FR-UI-008). Listado de documentos por carpeta. Preview de documento. Boton de descarga. Estado de procesamiento (procesado/pendiente/error). |

---

## Fase 4: Integracion y Testing

### TST-001: Tests unitarios backend

| Campo | Valor |
|-------|-------|
| **Descripcion** | Tests pytest para servicios de backend: parsing, chunking, embeddings |
| **Dependencias** | DOC-004, EMB-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Cobertura >= 80% en servicios core. Tests para: extraccion PDF, extraccion Word, chunking, generacion embeddings. Mocks para servicios externos (Qdrant, MinIO). CI ejecuta tests automaticamente. |

---

### TST-002: Tests de integracion API

| Campo | Valor |
|-------|-------|
| **Descripcion** | Tests de integracion para endpoints API con base de datos de test |
| **Dependencias** | TST-001, API-004, RAG-001 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Tests para: autenticacion, CRUD incidencias, busqueda, upload documentos. DB PostgreSQL de test. Fixtures con datos de ejemplo. Tests ejecutables en CI. |

---

### TST-003: Tests E2E frontend

| Campo | Valor |
|-------|-------|
| **Descripcion** | Tests end-to-end con Playwright para flujos criticos de usuario |
| **Dependencias** | TST-002, UI-004, UI-005 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | Tests para: login, busqueda de incidencias, ver detalle, crear nueva acta. Ejecucion headless en CI. Screenshots en fallos. |

---

### MIG-001: Script migracion datos legacy

| Campo | Valor |
|-------|-------|
| **Descripcion** | Script para importar corpus documental existente (500-2000 documentos) |
| **Dependencias** | WRK-001, DOC-003 |
| **Complejidad** | L |
| **Criterio de Aceptacion** | Script lee estructura carpetas cliente/anio. Importacion por lotes (FR-ING-006). Logging de errores con path y razon (FR-ING-007). Reporte de progreso. Tiempo estimado: 500 docs = ~10 horas. |

---

### DOC-DOC-001: Documentacion tecnica

| Campo | Valor |
|-------|-------|
| **Descripcion** | Documentacion de instalacion, configuracion, API y operaciones |
| **Dependencias** | TST-003 |
| **Complejidad** | M |
| **Criterio de Aceptacion** | README con instrucciones de instalacion. Documentacion API (OpenAPI exportado). Guia de operaciones (backup, restore, monitoring). Guia de troubleshooting. |

---

### DOC-DOC-002: Documentacion de usuario

| Campo | Valor |
|-------|-------|
| **Descripcion** | Manual de usuario para tecnicos y managers |
| **Dependencias** | UI-008 |
| **Complejidad** | S |
| **Criterio de Aceptacion** | Guia de busqueda semantica. Guia de creacion de actas. Guia de navegacion. FAQ. En espanol. |

---

## Diagrama de Dependencias

```
Fase 1: Infraestructura
INF-001 ─┬─► INF-002 ─┬─► INF-003 ─────┐
         │            ├─► INF-004 ─────┤
         │            ├─► INF-005 ─────┼─► INF-008
         │            ├─► INF-006 ─────┤
         │            └─► INF-007 ─────┘
         │
Fase 2: Backend                         │
         └──────────────────────────────┴─► API-001 ─┬─► API-002 ─┬─► API-004
                                                     ├─► API-003 ─┘
                                                     └─► DOC-001 ─► DOC-002 ─► DOC-003 ─► DOC-004 ─► EMB-001 ─► RAG-001 ─► RAG-002
                                                                                                                      │
Fase 3: Frontend                                                                                                      │
         API-001 ─► UI-001 ─► UI-002 ─┬─► UI-003                                                                     │
                                      ├─► UI-004 ◄────────────────────────────────────────────────────────────────────┘
                                      ├─► UI-005
                                      ├─► UI-006
                                      ├─► UI-007
                                      └─► UI-008

Fase 4: Testing & Docs
         EMB-001 ─► TST-001 ─► TST-002 ─► TST-003 ─► DOC-DOC-001
         UI-008 ─► DOC-DOC-002
         WRK-001 ─► MIG-001
```

---

## Orden de Implementacion Recomendado

### Sprint 1: Infraestructura (Semana 1)
1. INF-001: Estructura proyecto
2. INF-002: Docker Compose base
3. INF-003: PostgreSQL
4. INF-004: Qdrant
5. INF-005: MinIO
6. INF-006: Redis
7. INF-007: Ollama
8. INF-008: Script inicializacion

### Sprint 2: Backend Base (Semana 2)
1. API-001: FastAPI estructura
2. API-002: Modelos Pydantic/SQLAlchemy
3. API-003: Autenticacion JWT
4. API-004: CRUD incidencias

### Sprint 3: Pipeline Documentos (Semana 3)
1. DOC-001: Upload documentos
2. DOC-002: Parser documentos
3. DOC-003: Extractor metadatos
4. DOC-004: Chunking
5. WRK-001: Worker Celery

### Sprint 4: RAG Engine (Semana 4)
1. EMB-001: Servicio embeddings
2. RAG-001: Busqueda semantica
3. RAG-002: Reranking y generacion

### Sprint 5: Frontend Base (Semana 5)
1. UI-001: Setup React
2. UI-002: Layout
3. UI-003: Login
4. UI-004: Busqueda

### Sprint 6: Frontend Completo (Semana 6)
1. UI-005: Visor actas
2. UI-006: Formulario nueva acta
3. UI-007: Dashboard
4. UI-008: Navegador documentos

### Sprint 7: Testing y Migracion (Semana 7)
1. TST-001: Tests unitarios
2. TST-002: Tests integracion
3. TST-003: Tests E2E
4. MIG-001: Migracion legacy

### Sprint 8: Documentacion y Cierre (Semana 8)
1. DOC-DOC-001: Documentacion tecnica
2. DOC-DOC-002: Documentacion usuario
3. Revision final y deploy

---

## Resumen de Requisitos Cubiertos

| Requisito | Tarea(s) |
|-----------|----------|
| FR-ING-001, FR-ING-002 | DOC-001, DOC-002 |
| FR-ING-003 | DOC-001 |
| FR-ING-006, FR-ING-007 | WRK-001, MIG-001 |
| FR-PROC-001 a FR-PROC-010 | DOC-002, DOC-003, DOC-004, EMB-001 |
| FR-SRCH-001 a FR-SRCH-008 | RAG-001, RAG-002, UI-004 |
| FR-UI-001 a FR-UI-008 | UI-002 a UI-008 |
| NFR-SEC-001, NFR-SEC-002 | API-003 |
| NFR-PERF-001 a NFR-PERF-004 | WRK-001, EMB-001, RAG-001 |

---

*Documento generado: 2026-02-21*
*Total de tareas: 34*
