import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { config } from './config/index.js';
import { IncidentService } from './services/incidentService.js';
import { AgentService } from './services/agent.js';
import { ConversationService } from './services/conversationService.js';

const fastify = Fastify({
  logger: true,
});

const incidentService = new IncidentService();
const agentService = new AgentService();
const conversationService = new ConversationService(incidentService.vectorStore);

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

  fastify.get('/stats', async () => {
    return incidentService.getStats();
  });

  // Conversation endpoints
  fastify.get('/conversations', async () => {
    return conversationService.getAllConversations();
  });

  fastify.post('/conversations', async (request: any, reply) => {
    const { title } = request.body || {};
    const conversation = await conversationService.createConversation(title);
    return reply.code(201).send(conversation);
  });

  fastify.get('/conversations/:id', async (request: any) => {
    const conversation = await conversationService.getConversation(request.params.id);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  });

  fastify.delete('/conversations/:id', async (request: any) => {
    await conversationService.deleteConversation(request.params.id);
    return { success: true };
  });

  fastify.get('/conversations/:id/messages', async (request: any) => {
    return conversationService.getMessages(request.params.id);
  });

  fastify.put('/conversations/:id', async (request: any) => {
    const { title } = request.body;
    await conversationService.updateConversationTitle(request.params.id, title);
    return { success: true };
  });

  // AI Agent endpoint for conversational responses with conversation context
  fastify.post('/agent/query', async (request: any) => {
    try {
      const { query, detailed = false, limit = 5, conversationId } = request.body;
      
      if (!query) {
        throw new Error('query is required');
      }
      
      // Get conversation history if provided
      let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      let currentConversationId = conversationId;

      if (conversationId) {
        const recentMessages = await conversationService.getRecentMessages(conversationId, 6);
        conversationHistory = recentMessages.map(m => ({
          role: m.role,
          content: m.content,
        }));
      } else if (query) {
        // Create new conversation if none provided
        const newConversation = await conversationService.createConversation(
          query.substring(0, 50) + (query.length > 50 ? '...' : '')
        );
        currentConversationId = newConversation.id;
      }
      
      // Search for relevant documents
      const searchResults = await incidentService.search({ query, limit });
      
      // Generate AI response with conversation history
      const response = await agentService.generateResponse(
        query, 
        searchResults, 
        detailed,
        conversationHistory
      );

      // Save user message
      if (currentConversationId) {
        await conversationService.addMessage(currentConversationId, 'user', query);
        
        // Save assistant response
        await conversationService.addMessage(
          currentConversationId, 
          'assistant', 
          response.answer,
          response.sources
        );
      }
      
      return {
        ...response,
        conversationId: currentConversationId,
      };
    } catch (err: any) {
      console.error('Agent endpoint error:', err);
      throw err;
    }
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
