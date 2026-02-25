import { VectorStoreService } from './vectorStore.js';
import { v4 as uuidv4 } from 'uuid';

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any;
  createdAt: Date;
}

export class ConversationService {
  private vectorStore: VectorStoreService;
  private MAX_MESSAGES_PER_CONVERSATION = 20;

  constructor(vectorStore: VectorStoreService) {
    this.vectorStore = vectorStore;
  }

  async createConversation(title?: string): Promise<Conversation> {
    const id = uuidv4();
    const now = new Date();
    
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO conversations (id, title, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
        [id, title || 'Nueva conversación', now, now]
      );
      
      return {
        id,
        title: title || 'Nueva conversación',
        createdAt: now,
        updatedAt: now,
      };
    } finally {
      client.release();
    }
  }

  async getAllConversations(): Promise<Conversation[]> {
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC`
      );
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } finally {
      client.release();
    }
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      client.release();
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, conversation_id, role, content, sources, created_at 
         FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`,
        [conversationId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        sources: row.sources,
        createdAt: row.created_at,
      }));
    } finally {
      client.release();
    }
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    sources?: any
  ): Promise<Message> {
    const id = uuidv4();
    const now = new Date();
    
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO messages (id, conversation_id, role, content, sources, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, conversationId, role, content, sources ? JSON.stringify(sources) : null, now]
      );
      
      // Update conversation timestamp
      await client.query(
        `UPDATE conversations SET updated_at = $1 WHERE id = $2`,
        [now, conversationId]
      );
      
      // Clean up old messages if exceeding limit
      await this.cleanupOldMessages(conversationId);
      
      return {
        id,
        conversationId,
        role,
        content,
        sources,
        createdAt: now,
      };
    } finally {
      client.release();
    }
  }

  private async cleanupOldMessages(conversationId: string): Promise<void> {
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      // Delete old messages beyond the limit
      await client.query(
        `DELETE FROM messages 
         WHERE conversation_id = $1 
         AND id NOT IN (
           SELECT id FROM messages 
           WHERE conversation_id = $1 
           ORDER BY created_at DESC 
           LIMIT $2
         )`,
        [conversationId, this.MAX_MESSAGES_PER_CONVERSATION]
      );
    } finally {
      client.release();
    }
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
        [title, id]
      );
    } finally {
      client.release();
    }
  }

  async deleteConversation(id: string): Promise<void> {
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      // Messages will be deleted automatically due to CASCADE
      await client.query(`DELETE FROM conversations WHERE id = $1`, [id]);
    } finally {
      client.release();
    }
  }

  async getRecentMessages(conversationId: string, limit: number = 6): Promise<Message[]> {
    const pool = (this.vectorStore as any).pool;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, conversation_id, role, content, sources, created_at 
         FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC
         LIMIT $2`,
        [conversationId, limit]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        sources: row.sources,
        createdAt: row.created_at,
      })).reverse(); // Return in chronological order
    } finally {
      client.release();
    }
  }
}
