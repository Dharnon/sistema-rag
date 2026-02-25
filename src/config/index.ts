import dotenv from 'dotenv';
dotenv.config();

console.log('ENV POSTGRES_USER:', process.env.POSTGRES_USER);

export const config = {
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY || '',
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
    chatModel: process.env.MINIMAX_CHAT_MODEL || 'MiniMax-M2.5',
  },
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY || '',
    embeddingModel: process.env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-0.6B',
    embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION || '1024'),
    embeddingTask: process.env.EMBEDDING_TASK || 'Given a web search query, retrieve relevant passages that answer the query',
  },
  postgres: {
    connectionString: process.env.POSTGRES_CONNECTION_STRING || undefined,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'incidents',
  },
  server: {
    host: process.env.SERVER_HOST || '0.0.0.0',
    port: parseInt(process.env.SERVER_PORT || '3001'),
  },
  chunking: {
    size: parseInt(process.env.CHUNK_SIZE || '512'),
    overlap: parseInt(process.env.CHUNK_OVERLAP || '50'),
  },
};
