import { v4 as uuidv4 } from 'uuid';
import type { IncidentReport, CreateIncidentRequest, SearchQuery, SearchResult } from '../models/incident.js';
import { PdfParserService, type ParsedDocument } from './pdfParser.js';
import { EmbeddingService } from './embedding.js';
import { VectorStoreService, type ChromaDocument } from './vectorStore.js';
import { TextChunkingService } from './textChunking.js';

export class IncidentService {
  private incidents: Map<string, IncidentReport> = new Map();
  private pdfParser: PdfParserService;
  private embeddingService: EmbeddingService;
  public vectorStore: VectorStoreService;
  private textChunking: TextChunkingService;

  constructor() {
    this.pdfParser = new PdfParserService();
    this.embeddingService = new EmbeddingService();
    this.vectorStore = new VectorStoreService();
    this.textChunking = new TextChunkingService();
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.embeddingService.initialize();
    
    // Load existing incidents from database
    await this.loadIncidentsFromDatabase();
  }
  
  async loadIncidentsFromDatabase(): Promise<void> {
    try {
      const incidents = await this.vectorStore.loadAllIncidents();
      for (const incident of incidents) {
        this.incidents.set(incident.id, incident);
      }
      console.log(`Loaded ${incidents.length} incidents from database`);
    } catch (error) {
      console.error('Error loading incidents from database:', error);
    }
  }

  async ingestPdf(filePath: string): Promise<IncidentReport> {
    const parsed = await this.pdfParser.parsePdf(filePath);
    const incident = this.createIncidentFromParsed(parsed);
    
    // Remove existing incident if exists (to re-index with new data)
    const existingId = Array.from(this.incidents.keys()).find(
      k => this.incidents.get(k)?.incidentNumber === incident.incidentNumber
    );
    if (existingId) {
      this.incidents.delete(existingId);
    }
    
    this.incidents.set(incident.id, incident);
    
    // Save to database for persistence
    await this.vectorStore.deleteIncident(incident.incidentNumber);
    await this.vectorStore.saveIncident(incident);
    
    await this.indexIncident(incident, parsed.text);
    
    return incident;
  }

  async createIncident(data: CreateIncidentRequest): Promise<IncidentReport> {
    const incident: IncidentReport = {
      id: uuidv4(),
      incidentNumber: this.generateIncidentNumber(),
      title: data.title,
      detectedAt: new Date(data.detectedAt),
      severity: data.severity,
      status: 'open',
      category: data.category,
      subcategory: data.subcategory,
      environment: data.environment,
      summary: data.summary,
      description: data.description,
      rootCause: data.rootCause,
      impact: data.impact,
      resolutionSteps: data.resolutionSteps || [],
      workaround: data.workaround,
      preventiveActions: data.preventiveActions || [],
      reportedBy: data.reportedBy,
      assignedTo: data.assignedTo,
      affectedSystems: data.affectedSystems || [],
      affectedServices: data.affectedServices || [],
      tags: data.tags || [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.incidents.set(incident.id, incident);
    
    const textContent = this.incidentToText(incident);
    await this.indexIncident(incident, textContent);
    
    return incident;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const embeddingResult = await this.embeddingService.embedText(query.query);
    
    const results = await this.vectorStore.search(
      embeddingResult.embedding,
      query.filters,
      query.limit || 10
    );

    const incidentMap = new Map<string, SearchResult>();
    
    for (const result of results) {
      const incidentId = result.metadata.incidentId;
      const incident = this.incidents.get(incidentId);
      
      if (!incident) continue;
      
      if (!incidentMap.has(incidentId)) {
        incidentMap.set(incidentId, {
          incident,
          chunks: [],
          totalScore: 0,
        });
      }
      
      const searchResult = incidentMap.get(incidentId)!;
      searchResult.chunks.push({
        text: result.metadata.text,
        score: 1 - result.distance,
      });
      searchResult.totalScore += (1 - result.distance);
    }

    return Array.from(incidentMap.values())
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  getIncident(id: string): IncidentReport | undefined {
    return this.incidents.get(id);
  }

  getAllIncidents(): IncidentReport[] {
    return Array.from(this.incidents.values());
  }

  async getStats() {
    const incidents = this.getAllIncidents();
    const vectorCount = await this.vectorStore.getCollectionCount();
    
    // Calculate total hours
    let totalHours = 0;
    let normalHours = 0;
    let nightHours = 0;
    let extendedHours = 0;
    
    for (const inc of incidents) {
      if (inc.hoursSummary) {
        totalHours += inc.hoursSummary.normal || 0;
        totalHours += inc.hoursSummary.night || 0;
        totalHours += inc.hoursSummary.extended || 0;
        normalHours += inc.hoursSummary.normal || 0;
        nightHours += inc.hoursSummary.night || 0;
        extendedHours += inc.hoursSummary.extended || 0;
      }
    }
    
    // Get top participants
    const participantCounts: Record<string, number> = {};
    for (const inc of incidents) {
      if (inc.participants && Array.isArray(inc.participants)) {
        for (const p of inc.participants) {
          const name = typeof p === 'string' ? p : (p as any).name;
          if (name && typeof name === 'string') {
            participantCounts[name] = (participantCounts[name] || 0) + 1;
          }
        }
      }
    }
    
    const topParticipants = Object.entries(participantCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    // Recent activity
    const recentIncidents = [...incidents]
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, 5)
      .map(inc => ({
        id: inc.id,
        incidentNumber: inc.incidentNumber,
        client: inc.client,
        category: inc.category,
        detectedAt: inc.detectedAt,
      }));
    
    // By client
    const byClient: Record<string, number> = {};
    for (const inc of incidents) {
      const client = inc.client || 'Sin cliente';
      byClient[client] = (byClient[client] || 0) + 1;
    }
    
    return {
      totalIncidents: incidents.length,
      totalChunks: vectorCount,
      totalHours,
      normalHours,
      nightHours,
      extendedHours,
      bySeverity: incidents.reduce((acc, inc) => {
        acc[inc.severity] = (acc[inc.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byStatus: incidents.reduce((acc, inc) => {
        acc[inc.status] = (acc[inc.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: incidents.reduce((acc, inc) => {
        acc[inc.category] = (acc[inc.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byClient,
      topParticipants,
      recentActivity: recentIncidents,
    };
  }

  private createIncidentFromParsed(parsed: ParsedDocument): IncidentReport {
    const structured = parsed.structured || {};
    
    return {
      id: structured.id || uuidv4(),
      incidentNumber: structured.incidentNumber || this.generateIncidentNumber(),
      title: structured.title || parsed.metadata.filename,
      reference: structured.reference,
      detectedAt: structured.detectedAt || new Date(),
      severity: structured.severity || 'medium',
      status: structured.status || 'open',
      category: structured.category || 'General',
      subcategory: structured.subcategory,
      environment: structured.environment || 'production',
      client: structured.client,
      project: structured.project,
      contract: structured.contract,
      summary: structured.summary || '',
      description: parsed.text,
      problemDescription: structured.problemDescription,
      rootCause: structured.rootCause,
      impact: structured.impact,
      participants: structured.participants || [],
      worksDone: structured.worksDone || [],
      hoursSummary: structured.hoursSummary,
      billingInfo: structured.billingInfo,
      affectedSystems: structured.affectedSystems || [],
      affectedServices: structured.affectedServices || [],
      tags: structured.tags || [],
      resolutionSteps: [],
      preventiveActions: [],
      reportedBy: 'system',
      assignedTo: structured.assignedTo,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async indexIncident(incident: IncidentReport, text: string): Promise<void> {
    const chunks = this.textChunking.chunkForIncidentReports(text);
    const texts = chunks.map(c => c.text);
    
    const embeddings = await this.embeddingService.embedBatch(texts);
    
    const documents: ChromaDocument[] = chunks.map((chunk, index) => ({
      id: `${incident.id}-chunk-${index}`,
      embedding: embeddings[index].embedding,
      metadata: {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        chunkIndex: index,
        text: chunk.text,
        severity: incident.severity,
        status: incident.status,
        category: incident.category,
        environment: incident.environment,
        detectedAt: incident.detectedAt?.toISOString(),
        affectedSystems: incident.affectedSystems?.join(','),
        tags: incident.tags?.join(','),
        client: incident.client,
        participant: (incident.participants as any[])?.map(p => p.name).join(', '),
      },
    }));

    await this.vectorStore.addDocuments(documents);
  }

  private incidentToText(incident: IncidentReport): string {
    return `
${incident.title}

Número de incidencia: ${incident.incidentNumber}
Fecha: ${incident.detectedAt.toISOString()}
Severidad: ${incident.severity}
Estado: ${incident.status}
Categoría: ${incident.category}
Entorno: ${incident.environment}

Resumen: ${incident.summary}

Descripción: ${incident.description || ''}

Causa raíz: ${incident.rootCause || ''}
Impacto: ${incident.impact || ''}

Sistemas afectados: ${incident.affectedSystems.join(', ')}
Servicios afectados: ${incident.affectedServices.join(', ')}

Pasos de resolución:
${incident.resolutionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Workaround: ${incident.workaround || ''}

Acciones preventivas:
${incident.preventiveActions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Etiquetas: ${incident.tags.join(', ')}
    `.trim();
  }

  private generateIncidentNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `INC-${year}-${random}`;
  }
}
