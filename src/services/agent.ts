import { config } from '../config/index.js';
import type { IncidentReport, SearchResult } from '../models/incident.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MiniMaxChatResponse {
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
  choices?: {
    message: ChatMessage;
    index?: number;
    finish_reason?: string;
  }[];
}

export interface AgentResponse {
  answer: string;
  sources: {
    incident: IncidentReport;
    relevantText: string;
    relevance: number;
  }[];
  suggestedFollowUp?: string[];
}

const SYSTEM_PROMPT_SHORT = `Eres un asistente experto en análisis de actas de trabajo de HEXA Ingenieros.

Instrucciones:
1. Responde en español de forma clara y concisa
2. Máximo 2-3 párrafos cortos
3. Si no hay información suficiente, dilo claramente
4. Cita el número de acta cuando menciones información específica

formatos:
- **negrita** para énfasis
- Listas con •
`;

const SYSTEM_PROMPT_DETAILED = `Eres un asistente experto en análisis de actas de trabajo de HEXA Ingenieros.

Instrucciones:
1. Responde en español de forma detallada
2. Estructura tu respuesta con secciones claras
3. Incluye todos los detalles relevantes de los documentos
4. Cita el número de acta cuando menciones información específica
5. Si no hay información suficiente, dilo claramente

formatos:
- Encabezados ## para secciones
- **negrita** para énfasis
- Listas con • o números
`;

export class AgentService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = config.minimax.apiKey;
    this.model = config.minimax.chatModel;
  }

  async generateResponse(
    query: string,
    searchResults: SearchResult[],
    detailed: boolean = false
  ): Promise<AgentResponse> {
    // Guard against invalid input
    if (!searchResults) {
      console.error('searchResults is undefined or null');
      throw new Error('searchResults is undefined - internal error');
    }
    
    const resultsArray = Array.isArray(searchResults) ? searchResults : [];
    
    if (!this.apiKey) {
      throw new Error('MiniMax API key not configured');
    }

    if (resultsArray.length === 0) {
      return {
        answer: 'No he encontrado información relevante en las actas para responder a tu pregunta. ¿Podrías reformular la pregunta o añadir más documentos al sistema?',
        sources: [],
      };
    }

    const context = this.buildContext(resultsArray);
    const systemPrompt = detailed ? SYSTEM_PROMPT_DETAILED : SYSTEM_PROMPT_SHORT;
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: this.buildUserMessage(query, context) 
      },
    ];

    try {
      const response = await fetch(`${config.minimax.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: 0.3,
          max_tokens: detailed ? 2000 : 500,
        }),
      });

      console.log('MiniMax response status:', response.status);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('MiniMax error response:', error);
        throw new Error(`MiniMax API error: ${error}`);
      }

      const data: MiniMaxChatResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        console.error('MiniMax response invalid:', JSON.stringify(data).substring(0, 200));
        throw new Error('No response from MiniMax API - invalid response format');
      }

      const rawAnswer = data.choices[0].message.content;
      
      let answer = rawAnswer;
      
      // Simple think block removal - only if there's a clear pattern
      // Look for "El usuario pregunta... Debo responder" pattern and take everything AFTER it
      const thinkMatch = answer.match(/(?:El usuario pregunta|Basándome en|According to)[\s\S]{10,300}?(?:responder|responder\.|Debo responder|answer)/i);
      if (thinkMatch && thinkMatch.index !== undefined && thinkMatch.index < 100) {
        const afterThink = answer.substring(thinkMatch.index + thinkMatch[0].length);
        // Make sure we have enough content after
        if (afterThink.length > 30) {
          answer = afterThink.trim();
        }
      }
      
      // Pattern 2: If starts with numbers or common thinking patterns, skip them
      if (answer.match(/^[\n\s]*(?:\d+[\.\)]\s*)?El usuario pregunta|^[\n\s]*\d+[-\.]\s*$/m)) {
        // Find first actual paragraph starting with capital letter after a newline
        const firstPara = answer.match(/\n\n([A-Z][^.!?]{20,})/);
        if (firstPara && firstPara.index !== undefined) {
          answer = firstPara[1].trim();
        }
      }
      
      // Generate follow-up questions
      const suggestedFollowUp = this.generateFollowUpQuestions(query, resultsArray);

      return {
        answer,
        sources: resultsArray.map(r => ({
          incident: r.incident,
          relevantText: (r.chunks || []).map(c => (c.text || '').substring(0, 200)).join('\n\n'),
          relevance: r.chunks?.length ? r.totalScore / r.chunks.length : 0,
        })),
        suggestedFollowUp,
      };
    } catch (error) {
      console.error('Agent error:', error);
      throw error;
    }
  }

  private buildContext(searchResults: SearchResult[]): string {
    let context = '';
    
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      const inc = result.incident;
      
      context += `**Acta ${inc.incidentNumber}**`;
      if (inc.client) context += ` - ${inc.client}`;
      if (inc.detectedAt) {
        const date = new Date(inc.detectedAt).toLocaleDateString('es-ES', { 
          day: 'numeric', month: 'short', year: 'numeric' 
        });
        context += ` (${date})`;
      }
      context += '\n';
      
      // Include hours
      if (inc.hoursSummary) {
        const hours = [];
        if (inc.hoursSummary.normal) hours.push(`${inc.hoursSummary.normal}h normal`);
        if (inc.hoursSummary.night) hours.push(`${inc.hoursSummary.night}h nocturno`);
        if (inc.hoursSummary.total) hours.push(`${inc.hoursSummary.total}h total`);
        if (hours.length > 0) {
          context += `Horas: ${hours.join(', ')}\n`;
        }
      }
      
      // Include most relevant chunk only (shorter)
      if (result.chunks && result.chunks.length > 0) {
        const chunk = result.chunks[0];
        const text = chunk.text.replace(/\[Sección: [^\]]+\]\n?/g, '').substring(0, 300);
        context += `Extracto: ${text}...\n`;
      }
      
      context += '\n';
    }
    
    return context;
  }

  private buildUserMessage(query: string, context: string): string {
    return `Pregunta: ${query}

Contexto:
${context}

Responde de forma concisa. Cita el número de acta cuando menciones información.`;
  }

  private generateFollowUpQuestions(query: string, results: SearchResult[]): string[] {
    const questions: string[] = [];
    const clients = [...new Set(results.map(r => r.incident.client).filter(Boolean))];
    const hasHours = results.some(r => r.incident.hoursSummary?.total);
    
    if (clients.length > 0) {
      questions.push(`¿Qué otros trabajos se realizaron en ${clients[0]}?`);
    }
    
    if (hasHours) {
      questions.push('¿Cuál es el desglose de horas por tipo?');
    }
    
    const hasWorks = results.some(r => r.incident.worksDone && r.incident.worksDone.length > 0);
    if (hasWorks) {
      questions.push('¿Qué equipos fueron intervenidos?');
    }
    
    return questions.slice(0, 3);
  }
}
