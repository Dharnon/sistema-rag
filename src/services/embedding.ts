import { pipeline } from '@xenova/transformers';
import { config } from '../config/index.js';

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export class EmbeddingService {
  private initialized: boolean = false;
  private extractor: any = null;
  private model: string;
  private dimension: number = 384;

  constructor() {
    this.model = 'Xenova/all-MiniLM-L6-v2';
    this.dimension = 384;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('Initializing local embedding model:', this.model);
    
    this.extractor = await pipeline('feature-extraction', this.model);
    
    this.initialized = true;
    console.log('Embedding model initialized');
  }

  async embedText(text: string): Promise<EmbeddingResult> {
    await this.initialize();
    
    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }
    
    try {
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });
      
      const embedding: number[] = Array.from(output.data);
      
      return {
        embedding,
        tokens: Math.ceil(text.length / 4),
      };
    } catch (error) {
      console.error('Embedding error:', error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    await this.initialize();
    
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      const result = await this.embedText(text);
      results.push(result);
    }
    
    return results;
  }

  async embedQuery(text: string): Promise<number[]> {
    const result = await this.embedText(text);
    return result.embedding;
  }

  async embedDocument(text: string): Promise<number[]> {
    const result = await this.embedText(text);
    return result.embedding;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.embedText('test');
      return true;
    } catch (error) {
      console.error('Embedding service test failed:', error);
      return false;
    }
  }
}

export const embeddingService = new EmbeddingService();
