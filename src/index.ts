import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { config } from './config/index.js';
import { IncidentService } from './services/incidentService.js';
import { AgentService } from './services/agent.js';

const fastify = Fastify({
  logger: true,
});

const incidentService = new IncidentService();
const agentService = new AgentService();

async function start() {
  await fastify.register(cors);
  
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Incident RAG API',
        description: 'API for managing and searching incident reports with RAG',
        version: '1.0.0',
      },
    },
  });
  
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });

  await incidentService.initialize();

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/test-embedding', async (request: any) => {
    const { embeddingService } = await import('./services/embedding.js');
    await embeddingService.initialize();
    const result = await embeddingService.embedText('test');
    return { dimension: result.embedding.length, sample: result.embedding.slice(0, 5) };
  });

  fastify.get('/incidents', async (request) => {
    return incidentService.getAllIncidents();
  });

  fastify.get('/incidents/:id', async (request: any) => {
    const incident = incidentService.getIncident(request.params.id);
    if (!incident) {
      throw new Error('Incident not found');
    }
    return incident;
  });

  fastify.post('/incidents', async (request: any, reply) => {
    const incident = await incidentService.createIncident(request.body);
    return reply.code(201).send(incident);
  });

  fastify.post('/incidents/ingest-pdf', async (request: any, reply) => {
    const { filePath } = request.body;
    if (!filePath) {
      return reply.code(400).send({ error: 'filePath is required' });
    }
    const incident = await incidentService.ingestPdf(filePath);
    return reply.code(201).send(incident);
  });

  fastify.post('/incidents/ingest-folder', async (request: any, reply) => {
    const { folderPath } = request.body;
    if (!folderPath) {
      return reply.code(400).send({ error: 'folderPath is required' });
    }
    
    const files = await readdir(folderPath);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    const results = [];
    for (const file of pdfFiles) {
      try {
        const incident = await incidentService.ingestPdf(join(folderPath, file));
        results.push({ file, success: true, incident });
      } catch (error: any) {
        results.push({ file, success: false, error: error.message });
      }
    }
    
    return results;
  });

  fastify.post('/search', async (request: any) => {
    const results = await incidentService.search(request.body);
    return results;
  });

  // AI Agent endpoint for conversational responses
  fastify.post('/agent/query', async (request: any) => {
    try {
      const { query, detailed = false, limit = 5 } = request.body;
      
      if (!query) {
        throw new Error('query is required');
      }
      
      // Search for relevant documents
      const searchResults = await incidentService.search({ query, limit });
      
      // Generate AI response
      const response = await agentService.generateResponse(query, searchResults, detailed);
      
      return response;
    } catch (err: any) {
      console.error('Agent endpoint error:', err);
      throw err;
    }
  });

  fastify.get('/stats', async () => {
    return incidentService.getStats();
  });

  try {
    await fastify.listen({ port: config.server.port, host: config.server.host });
    console.log(`Server running at http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
