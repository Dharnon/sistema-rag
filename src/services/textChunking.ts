import { config } from '../config/index.js';

export interface Chunk {
  text: string;
  index: number;
  startIndex: number;
  endIndex: number;
}

export class TextChunkingService {
  private chunkSize: number;
  private overlap: number;

  constructor() {
    this.chunkSize = config.chunking.size;
    this.overlap = config.chunking.overlap;
  }

  chunkText(text: string): Chunk[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: Chunk[] = [];
    
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      if (currentChunk.length + trimmed.length > this.chunkSize && currentChunk.length > 100) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex,
          startIndex: currentStart,
          endIndex: currentStart + currentChunk.length,
        });
        
        chunkIndex++;
        const overlapText = currentChunk.slice(-this.overlap);
        currentChunk = overlapText + ' ' + trimmed;
        currentStart = currentStart + currentChunk.length - overlapText.length;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }

    if (currentChunk.trim() && currentChunk.trim().length > 50) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        startIndex: currentStart,
        endIndex: currentStart + currentChunk.length,
      });
    }

    return chunks;
  }

  chunkBySentences(text: string): Chunk[] {
    const sentences = this.splitIntoSentences(text);
    const chunks: Chunk[] = [];
    
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 50) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex,
          startIndex: currentStart,
          endIndex: currentStart + currentChunk.length,
        });
        
        chunkIndex++;
        const overlapText = currentChunk.slice(-this.overlap);
        currentChunk = overlapText + ' ' + sentence;
        currentStart = currentStart + currentChunk.length - overlapText.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim() && currentChunk.trim().length > 50) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        startIndex: currentStart,
        endIndex: currentStart + currentChunk.length,
      });
    }

    return chunks;
  }

  chunkForIncidentReports(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    
    const sections = this.extractSections(text);
    
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;
    let sectionContext = '';

    for (const section of sections) {
      const sectionText = section.title ? `${section.title}: ${section.content}` : section.content;
      
      if (section.title) {
        sectionContext = section.title;
      }

      if (currentChunk.length + sectionText.length > this.chunkSize && currentChunk.length > 100) {
        if (currentChunk.trim()) {
          chunks.push({
            text: `[Sección: ${sectionContext}]\n${currentChunk.trim()}`,
            index: chunkIndex,
            startIndex: currentStart,
            endIndex: currentStart + currentChunk.length,
          });
          chunkIndex++;
        }
        
        const overlapText = currentChunk.slice(-this.overlap);
        currentChunk = overlapText + '\n\n' + sectionText;
        currentStart = currentStart + currentChunk.length - overlapText.length;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + sectionText;
      }
    }

    if (currentChunk.trim() && currentChunk.trim().length > 50) {
      chunks.push({
        text: `[Sección: ${sectionContext}]\n${currentChunk.trim()}`,
        index: chunkIndex,
        startIndex: currentStart,
        endIndex: currentStart + currentChunk.length,
      });
    }

    return chunks;
  }

  private extractSections(text: string): { title?: string; content: string }[] {
    const sections: { title?: string; content: string }[] = [];
    
    const sectionPatterns = [
      /^(?:INCIDENCIA|ACTA|REPORTE|ON-?CALL|MANTENIMIENTO|PREVENTIVO|CORRECTIVO)[\s:.-]*/gim,
      /^(?:DESCRIPCIÓN|DESCRIPCION|SUMMARY|RESUMEN)[\s:.-]*/gim,
      /^(?:AFECTADOS?|IMPACTO|IMPACT)[\s:.-]*/gim,
      /^(?:RESOLUCIÓN|RESOLUCION|RESOLUTION|SEGUIMIENTO)[\s:.-]*/gim,
      /^(?:CAUSA|ROOT\s*CAUSE|ORIGEN)[\s:.-]*/gim,
      /^(?:ACCIONES?|ACTIONS)[\s:.-]*/gim,
      /^(?:FECHA|HORA|DATE|TIME)[\s:.-]*/gim,
      /^(?:SISTEMA|SERVER|ENVIRONMENT|ENTORNO)[\s:.-]*/gim,
    ];

    const lines = text.split('\n');
    let currentTitle = '';
    let currentContent = '';

    for (const line of lines) {
      const trimmed = line.trim();
      const isSectionHeader = sectionPatterns.some(p => p.test(trimmed));
      
      if (isSectionHeader && trimmed.length < 50) {
        if (currentContent) {
          sections.push({ title: currentTitle, content: currentContent.trim() });
        }
        currentTitle = trimmed.replace(/[:.-]+$/, '').trim();
        currentContent = '';
      } else {
        currentContent += (currentContent ? '\n' : '') + trimmed;
      }
    }

    if (currentContent) {
      sections.push({ title: currentTitle, content: currentContent.trim() });
    }

    if (sections.length === 0) {
      sections.push({ content: text });
    }

    return sections;
  }

  private splitIntoSentences(text: string): string[] {
    const sentenceEndings = /[.!?]+[\s\n]+/g;
    const sentences = text.split(sentenceEndings);
    
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
