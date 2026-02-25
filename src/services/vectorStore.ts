import { Pool, PoolConfig } from 'pg';
import { promisify } from 'util';
import * as dns from 'dns';
import { config } from '../config/index.js';

const resolve6Async = promisify(dns.resolve6);

async function getResolvedPoolConfig(): Promise<PoolConfig> {
  let poolConfig: PoolConfig;

  if (config.postgres.connectionString) {
    const url = new URL(config.postgres.connectionString);
    const hostname = url.hostname;
    
    try {
      const addresses = await resolve6Async(hostname);
      if (addresses && addresses.length > 0) {
        url.hostname = `[${addresses[0]}]`;
        console.log(`Resolved ${hostname} to ${addresses[0]}`);
      }
    } catch (e) {
      console.log(`Failed to resolve ${hostname}:`, e);
    }
    
    poolConfig = { connectionString: url.toString() };
  } else {
    poolConfig = {
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
    };
  }
  
  poolConfig.ssl = { rejectUnauthorized: false };
  return poolConfig;
}

export interface ChromaDocument {
  id: string;
  embedding: number[];
  metadata: {
    incidentId: string;
    incidentNumber: string;
    chunkIndex: number;
    text: string;
    severity?: string;
    status?: string;
    category?: string;
    environment?: string;
    detectedAt?: string;
    affectedSystems?: string;
    tags?: string;
    client?: string;
    participant?: string;
  };
}

export class VectorStoreService {
  private pool: Pool | null = null;

  constructor() {
  }

  async initialize(): Promise<void> {
    const poolConfig = await getResolvedPoolConfig();
    console.log('Pool config:', { ...poolConfig, password: poolConfig.password ? '***' : undefined, connectionString: poolConfig.connectionString ? '***' : undefined });
    this.pool = new Pool(poolConfig);
    
    const client = await this.pool.connect();
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      
      // Don't drop tables - just create if not exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS incidents (
          id VARCHAR(255) PRIMARY KEY,
          incident_number VARCHAR(100) UNIQUE NOT NULL,
          title VARCHAR(500),
          reference VARCHAR(255),
          detected_at TIMESTAMP,
          severity VARCHAR(50),
          status VARCHAR(50),
          category VARCHAR(100),
          subcategory VARCHAR(100),
          environment VARCHAR(50),
          client VARCHAR(255),
          project VARCHAR(500),
          contract VARCHAR(255),
          summary TEXT,
          description TEXT,
          problem_description TEXT,
          root_cause TEXT,
          impact TEXT,
          participants JSONB,
          works_done JSONB,
          hours_summary JSONB,
          billing_info JSONB,
          reported_by VARCHAR(255),
          assigned_to VARCHAR(255),
          affected_systems TEXT[],
          affected_services TEXT[],
          tags TEXT[],
          version INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Table for chunks with embeddings
      await client.query(`
        CREATE TABLE IF NOT EXISTS incident_chunks (
          id VARCHAR(255) PRIMARY KEY,
          incident_id VARCHAR(255) NOT NULL,
          incident_number VARCHAR(100) NOT NULL,
          chunk_index INTEGER NOT NULL,
          text TEXT NOT NULL,
          embedding vector(384),
          severity VARCHAR(50),
          status VARCHAR(50),
          category VARCHAR(100),
          environment VARCHAR(50),
          detected_at TIMESTAMP,
          affected_systems TEXT,
          tags TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_incident_chunks_incident_id ON incident_chunks(incident_id)
      `);
      
      // Conversations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(500) DEFAULT 'Nueva conversación',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          conversation_id VARCHAR(255) REFERENCES conversations(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          sources JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)
      `);
      
      console.log('PostgreSQL with pgvector initialized');
    } finally {
      client.release();
    }
  }

  async saveIncident(incident: any): Promise<void> {
    console.log('DEBUG saveIncident - client:', incident.client, 'project:', incident.project);
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO incidents (id, incident_number, title, reference, detected_at, severity, status, category, subcategory, environment, client, project, contract, summary, description, problem_description, root_cause, impact, participants, works_done, hours_summary, billing_info, reported_by, assigned_to, affected_systems, affected_services, tags, version, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            updated_at = NOW()`,
        [
          incident.id,
          incident.incidentNumber,
          incident.title,
          incident.reference,
          incident.detectedAt ? new Date(incident.detectedAt) : null,
          incident.severity,
          incident.status,
          incident.category,
          incident.subcategory,
          incident.environment,
          incident.client,
          incident.project,
          incident.contract,
          incident.summary,
          incident.description,
          incident.problemDescription,
          incident.rootCause,
          incident.impact,
          JSON.stringify(incident.participants || []),
          JSON.stringify(incident.worksDone || []),
          JSON.stringify(incident.hoursSummary || {}),
          JSON.stringify(incident.billingInfo || {}),
          incident.reportedBy,
          incident.assignedTo,
          incident.affectedSystems || [],
          incident.affectedServices || [],
          incident.tags || [],
          incident.version || 1,
          incident.createdAt ? new Date(incident.createdAt) : new Date(),
          new Date()
        ]
      );
    } finally {
      client.release();
    }
  }

  async deleteIncident(incidentNumber: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM incidents WHERE incident_number = $1', [incidentNumber]);
      await client.query('DELETE FROM incident_chunks WHERE incident_number = $1', [incidentNumber]);
    } finally {
      client.release();
    }
  }

  async loadAllIncidents(): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM incidents ORDER BY detected_at DESC');
      return result.rows.map(row => ({
        id: row.id,
        incidentNumber: row.incident_number,
        title: row.title,
        reference: row.reference,
        detectedAt: row.detected_at,
        severity: row.severity,
        status: row.status,
        category: row.category,
        subcategory: row.subcategory,
        environment: row.environment,
        client: row.client,
        project: row.project,
        contract: row.contract,
        summary: row.summary,
        description: row.description,
        problemDescription: row.problem_description,
        rootCause: row.root_cause,
        impact: row.impact,
        participants: row.participants,
        worksDone: row.works_done,
        hoursSummary: row.hours_summary,
        billingInfo: row.billing_info,
        reportedBy: row.reported_by,
        assignedTo: row.assigned_to,
        affectedSystems: row.affected_systems,
        affectedServices: row.affected_services,
        tags: row.tags,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } finally {
      client.release();
    }
  }

  async loadChunksByIncidentId(incidentId: string): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM incident_chunks WHERE incident_id = $1 ORDER BY chunk_index',
        [incidentId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async addDocuments(docs: ChromaDocument[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      for (const doc of docs) {
        await client.query(
          `INSERT INTO incident_chunks (id, incident_id, incident_number, chunk_index, text, embedding, severity, status, category, environment, detected_at, affected_systems, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
              text = EXCLUDED.text,
              embedding = EXCLUDED.embedding`,
          [
            doc.id,
            doc.metadata.incidentId,
            doc.metadata.incidentNumber,
            doc.metadata.chunkIndex,
            doc.metadata.text,
            `[${doc.embedding.join(',')}]`,
            doc.metadata.severity,
            doc.metadata.status,
            doc.metadata.category,
            doc.metadata.environment,
            doc.metadata.detectedAt ? new Date(doc.metadata.detectedAt) : null,
            doc.metadata.affectedSystems,
            doc.metadata.tags,
          ]
        );
      }
      console.log(`Indexed ${docs.length} chunks`);
    } finally {
      client.release();
    }
  }

  async search(
    queryEmbedding: number[],
    filter?: {
      severity?: string[];
      status?: string[];
      category?: string;
      environment?: string;
      dateFrom?: string;
      dateTo?: string;
      tags?: string[];
      client?: string;
    },
    limit: number = 10
  ): Promise<{ id: string; metadata: any; distance: number }[]> {
    const client = await this.pool.connect();
    try {
      let whereClause = '1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter?.severity && filter.severity.length > 0) {
        whereClause += ` AND severity = ANY($${paramIndex++})`;
        params.push(filter.severity);
      }
      if (filter?.status && filter.status.length > 0) {
        whereClause += ` AND status = ANY($${paramIndex++})`;
        params.push(filter.status);
      }
      if (filter?.category) {
        whereClause += ` AND category = $${paramIndex++}`;
        params.push(filter.category);
      }
      if (filter?.environment) {
        whereClause += ` AND environment = $${paramIndex++}`;
        params.push(filter.environment);
      }
      if (filter?.tags && filter.tags.length > 0) {
        whereClause += ` AND tags && $${paramIndex++}::text[]`;
        params.push(filter.tags);
      }

      params.push(`[${queryEmbedding.join(',')}]`);

      const query = `
        SELECT id, 
               incident_id as "incidentId", 
               incident_number as "incidentNumber", 
               chunk_index as "chunkIndex", 
               text, 
               severity, 
               status, 
               category, 
               environment, 
               detected_at as "detectedAt", 
               affected_systems as "affectedSystems", 
               tags,
               1 - (embedding <=> $${paramIndex}) as distance
        FROM incident_chunks
        WHERE ${whereClause}
        ORDER BY embedding <=> $${paramIndex}
        LIMIT ${limit}
      `;

      const result = await client.query(query, params);

      return result.rows.map((row: any) => ({
        id: row.id,
        metadata: {
          incidentId: row.incidentId,
          incidentNumber: row.incidentNumber,
          chunkIndex: row.chunkIndex,
          text: row.text,
          severity: row.severity,
          status: row.status,
          category: row.category,
          environment: row.environment,
          detectedAt: row.detectedAt?.toISOString(),
          affectedSystems: row.affectedSystems,
          tags: row.tags,
        },
        distance: row.distance,
      }));
    } finally {
      client.release();
    }
  }

  async deleteCollection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DROP TABLE IF EXISTS incident_chunks');
    } finally {
      client.release();
    }
  }

  async getCollectionCount(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT COUNT(*) as count FROM incident_chunks');
      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
