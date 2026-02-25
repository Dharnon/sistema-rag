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

Eres muy detallado cuando se trata de extraer información sobre:
- Horas de trabajo (horario normal, nocturno, extendido, desplazamientos)
- Detalles de proyectos y servicios realizados
- Equipos técnicos intervenidos
- Participantes en los trabajos
- Información de facturación

Instrucciones:
1. Responde SIEMPRE en español
2. Cuando se pregunte por horas, MUESTRA LOS NÚMEROS EXACTOS extraídos de los documentos
3. Si hay varias fuentes, resume los totales por cliente o proyecto
4. Si no hay información suficiente, dilo claramente
5. Cita SIEMPRE el número de acta cuando menciones información específica

Ejemplo de respuesta correcta para horas:
"Según las actas analizadas:
- AC100554-I10 (Laboratorios Normon): 19h normales + 2h nocturnas = 21h totales
- AC220H2001-A (PPG Ibérica): 106.5h totales

Total facturado: 127.5 horas"

Formatos permitidos:
- **negrita** para énfasis
- Listas con •
- Tablas simples si hay múltiples datos`;

const SYSTEM_PROMPT_DETAILED = `Eres un asistente experto en análisis de actas de trabajo de HEXA Ingenieros.

Tu trabajo es extraer y resumir información técnica de las actas de trabajo. Cuando el usuario pregunta:

1. Sobre HORAS: Muestra siempre los números exactos de horas extraídas
   - Normal: X horas
   - Nocturno: X horas  
   - Extendido: X horas
   - Desplazamiento: X horas
   - TOTAL: X horas

2. Sobre TRABAJOS/EQUIPOS: Lista los equipos específicos mencionados
   - Válvulas: códigos como GJK07AA003, YS22824
   - Bombas: PWS3, etc.
   - Tanks: T1264, D10, etc.

3. Sobre CLIENTES: Indica el nombre exacto del cliente

4. Sobre PARTICIPANTES: Nombra a las personas involucradas

Instrucciones obligatorias:
- Responde en español
- CITA el número de acta (ej: AC100554-I10) para cada dato que menciones
- Si hay varias actas, haz un RESUMEN CONJUNTO al final
- Si no hay datos, dilo honestamente

Estructura recomendada para respuestas sobre horas:
---
## Resumen de Horas

| Acta | Cliente | Normal | Noche | Total |
|------|---------|--------|-------|-------|
| AC100554-I10 | Laboratorios Normon | 19h | 2h | 21h |
| AC220H2001-A | PPG Ibérica | 106.5h | - | 106.5h |

**Total: 127.5 horas**
---

Formatos:
- Encabezados ## para secciones
- **negrita** para énfasis
- Tablas markdown para datos numéricos
- Listas con • para descripciones`;

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
    detailed: boolean = false,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
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
    
    // Build messages including conversation history
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (last 6 messages = 3 exchanges)
    for (const msg of conversationHistory.slice(-6)) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current query
    messages.push({ 
      role: 'user', 
      content: this.buildUserMessage(query, context) 
    });

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
      
      context += `## Acta ${inc.incidentNumber}`;
      if (inc.client) context += ` - ${inc.client}`;
      if (inc.detectedAt) {
        const date = new Date(inc.detectedAt).toLocaleDateString('es-ES', { 
          day: 'numeric', month: 'short', year: 'numeric' 
        });
        context += ` (${date})`;
      }
      context += '\n\n';
      
      // Include hours in detail
      if (inc.hoursSummary) {
        const hs = inc.hoursSummary;
        context += `**Horas:**\n`;
        if (hs.normal) context += `- Normal: ${hs.normal}h\n`;
        if (hs.night) context += `- Nocturno: ${hs.night}h\n`;
        if (hs.extended) context += `- Extendido: ${hs.extended}h\n`;
        if (hs.travel) context += `- Desplazamiento: ${hs.travel}h\n`;
        if (hs.total) context += `- **TOTAL: ${hs.total}h**\n`;
        if (hs.billingInfo) context += `- Facturación: ${hs.billingInfo}\n`;
        context += '\n';
      }
      
      // Include participants
      if (inc.participants && Array.isArray(inc.participants) && inc.participants.length > 0) {
        const names = inc.participants.map((p: any) => p.name || p).join(', ');
        context += `**Participantes:** ${names}\n\n`;
      }
      
      // Include works done summary
      if (inc.worksDone && Array.isArray(inc.worksDone) && inc.worksDone.length > 0) {
        context += `**Trabajos realizados:**\n`;
        for (const work of inc.worksDone.slice(0, 3)) {
          const title = work.title || work.date || 'Trabajo';
          context += `- ${title}: ${(work.description || '').substring(0, 100)}...\n`;
        }
        context += '\n';
      }
      
      // Include relevant chunk
      if (result.chunks && result.chunks.length > 0) {
        const chunk = result.chunks[0];
        const text = chunk.text.replace(/\[Sección: [^\]]+\]\n?/g, '').substring(0, 500);
        context += `**Extracto relevante:**\n${text}...\n`;
      }
      
      context += '\n---\n\n';
    }
    
    // Add summary table if multiple results
    if (searchResults.length > 1) {
      context += '## Resumen de Datos Extraídos\n\n';
      context += '| Acta | Cliente | Horas Totales | Categoría |\n';
      context += '|------|---------|---------------|----------|\n';
      
      for (const r of searchResults) {
        const inc = r.incident;
        const hours = inc.hoursSummary?.total || inc.hoursSummary?.normal || '-';
        context += `| ${inc.incidentNumber} | ${inc.client || '-'} | ${hours}h | ${inc.category || '-'} |\n`;
      }
    }
    
    return context;
  }

  private buildUserMessage(query: string, context: string): string {
    return `Pregunta del usuario: ${query}

A continuación tienes el contexto extraído de las actas de HEXA Ingenieros:

${context}

INSTRUCCIONES PARA RESPONDER:
1. Lee cuidadosamente los datos de arriba
2. Si el usuario pregunta por HORAS, calcula y muestra los TOTALES EXACTOS
3. Cita siempre el número de acta (ej: AC100554-I10) para cada dato
4. Si hay varios actas, haz un resumen conjunto al final
5. Si no hay información en el contexto para responder, dilo honestamente

Responde en español:`;
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
