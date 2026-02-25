# Incident RAG Service

Microservicio RAG para gestión y búsqueda semántica de actas de incidencias On-Call.

## Características

- **Ingesta de PDFs**: Extrae texto y metadatos de actas en PDF
- **Búsqueda semántica**: Busca en lenguaje natural usando embeddings de MiniMax
- **Base de datos vectorial**: Almacena embeddings en ChromaDB
- **API REST**: Endpoints para crear, buscar y gestionar incidencias

## Requisitos

- Node.js 20+
- npm o yarn
- API Key de MiniMax

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu API key de MiniMax
```

## Configuración

Editar `.env`:

```env
MINIMAX_API_KEY=tu_api_key_aqui
MINIMAX_BASE_URL=https://api.minimax.chat/v1
SERVER_PORT=3001
CHUNK_SIZE=512
CHUNK_OVERLAP=50
```

## Uso

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## Endpoints API

### Health Check
```
GET /health
```

### Listar incidencias
```
GET /incidents
```

### Obtener incidencia por ID
```
GET /incidents/:id
```

### Crear incidencia
```
POST /incidents
```

### Ingestar PDF individual
```
POST /incidents/ingest-pdf
Body: { "filePath": "/ruta/al/archivo.pdf" }
```

### Ingestar carpeta de PDFs
```
POST /incidents/ingest-folder
Body: { "folderPath": "/ruta/a/carpeta" }
```

### Buscar
```
POST /search
Body: {
  "query": "consulta en lenguaje natural",
  "filters": {
    "severity": ["critical", "high"],
    "category": "On-Call"
  },
  "limit": 10
}
```

### Estadísticas
```
GET /stats
```

## Ejemplo de búsqueda

```bash
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "incidencias de SAP que pasaron en mayo",
    "filters": {
      "severity": ["critical", "high"]
    }
  }'
```

## Estructura del proyecto

```
src/
├── api/              # Rutas de la API
├── config/           # Configuración
├── models/           # Tipos y modelos de datos
├── services/         # Lógica de negocio
│   ├── embedding.ts      # Servicio de embeddings
│   ├── incidentService.ts
│   ├── pdfParser.ts
│   ├── textChunking.ts
│   └── vectorStore.ts
└── index.ts          # Punto de entrada
```

## Integración con warp-time-planner

Para integrar con tu aplicación principal:

```typescript
// Frontend - Llamada a la API
const response = await fetch('http://localhost:3001/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'búsqueda en lenguaje natural',
    filters: { severity: ['critical'] }
  })
});
const results = await response.json();
```

## Tecnologías

- **Runtime**: Node.js
- **API**: Fastify
- **Embeddings**: MiniMax API
- **Vector DB**: ChromaDB
- **PDF**: pdfplumber
- **TypeScript**: Full type safety
