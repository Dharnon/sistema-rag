import { basename } from 'path';
import pdf from 'pdf-parse';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { IncidentReport, Severity, IncidentStatus, Participant, WorkDone, HoursSummary } from '../models/incident.js';

export interface ParsedDocument {
  text: string;
  metadata: {
    filename: string;
    pageCount: number;
    extractedAt: Date;
  };
  structured?: Partial<IncidentReport>;
}

export class PdfParserService {
  async parsePdf(filePath: string): Promise<ParsedDocument> {
    const dataBuffer = readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    const fullText = data.text;
    const structured = this.extractIncidentData(fullText, basename(filePath));

    return {
      text: fullText.trim(),
      metadata: {
        filename: basename(filePath),
        pageCount: data.numpages,
        extractedAt: new Date(),
      },
      structured,
    };
  }

  private extractIncidentData(text: string, filename: string): Partial<IncidentReport> {
    const normalizedText = text.toLowerCase();
    
    const client = this.extractClient(text);
    const project = this.extractProject(text);
    console.log('DEBUG - extractClient:', client);
    console.log('DEBUG - extractProject:', project);
    
    return {
      id: uuidv4(),
      incidentNumber: this.extractIncidentNumber(filename) || this.generateIncidentNumber(),
      reference: this.extractReference(text),
      title: this.extractTitle(text) || filename,
      detectedAt: this.extractDate(normalizedText, text) || new Date(),
      severity: this.extractSeverity(normalizedText),
      status: this.extractStatus(normalizedText),
      category: this.extractCategory(normalizedText) || 'General',
      subcategory: this.extractSubcategory(normalizedText),
      environment: this.extractEnvironment(normalizedText) || 'production',
      
      client: client,
      project: project,
      contract: this.extractContract(text),
      
      summary: this.extractSummary(text) || '',
      description: text,
      problemDescription: this.extractProblemDescription(text),
      rootCause: this.extractRootCause(text),
      impact: this.extractImpact(text),
      
      participants: this.extractParticipants(text),
      worksDone: this.extractWorksDone(text),
      resolutionSteps: this.extractResolutionSteps(text),
      preventiveActions: this.extractPreventiveActions(text),
      
      hoursSummary: this.extractHoursSummary(text),
      billingInfo: this.extractBillingInfo(text),
      
      reportedBy: this.extractReportedBy(text) || 'system',
      assignedTo: this.extractAssignedTo(text),
      
      affectedSystems: this.extractAffectedSystems(normalizedText),
      affectedServices: this.extractAffectedServices(normalizedText),
      tags: this.extractTags(text),
      
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private extractReference(text: string): string | undefined {
    const patterns = [
      /(?:referencia|ref\.?)\s*[:.]?\s*([A-Z0-9-]+)/i,
      /(?:n[°o]?|número)\s*(?:de\s*)?(?:acta|incidencia)?\s*[:.]?\s*([A-Z0-9-]+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const ref = match[1].trim();
        if (ref.length < 30) return ref;
      }
    }
    return undefined;
  }

  private extractClient(text: string): string | undefined {
    // Pattern: Cliente: NAME (followed by Proyecto or Trabajo or end of line)
    // Be careful not to stop at P in "PPG" - need longer lookahead
    const patterns = [
      /Cliente:\s*([^\n]+?)(?=\s*Proyecto:|\s*Trabajo:|\s*Contrato:|$)/i,
      /CLIENTE:\s*([^\n]+?)(?=\s*Proyecto:|\s*Trabajo:|\s*Contrato:|$)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let client = match[1]
          .replace(/:/g, '')
          .replace(/^P{1,2}G\s+/i, 'PPG ') // Fix "PG Valencia" -> "PPG Valencia"
          .trim();
        if (client.length > 2 && client.length < 100) {
          return client;
        }
      }
    }
    
    return undefined;
  }

  private extractProject(text: string): string | undefined {
    // Pattern: Proyecto: NAME (followed by Trabajo or Contrato or end of line)
    // Handle both single/double spaces and cases where project might be empty
    const patterns = [
      /Proyecto:\s*(.+?)(?=\s*Trabajo|\s*Contrato|$)/i,
      /PROYECTO:\s*(.+?)(?=\s*Trabajo|\s*Contrato|$)/i,
      /Proyecto:\s*([^\n]+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let project = match[1].trim();
        // If project is just spaces or empty-looking, skip it
        if (project.length > 2 && !project.match(/^\s*Trabajo/)) {
          return project.substring(0, 150);
        }
      }
    }
    return undefined;
  }

  private extractContract(text: string): string | undefined {
    const patterns = [
      /(?:contrato|contract)[\s:.-]*(?:n[°o]?)?\s*([A-Z0-9-]+)/i,
      /(?:orden\s*de\s*trabajo)[\s:.-]*([A-Z0-9-]+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 50);
      }
    }
    return undefined;
  }

  private extractProblemDescription(text: string): string | undefined {
    const patterns = [
      /(?:descripción|del problema|problema|problem)[\s:.-]*([^\n]{50,300})/i,
      /(?:se\s+(?:recibe|solicita|detecta|observa))([^\n]{50,200})/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 500);
      }
    }
    return undefined;
  }

  private extractParticipants(text: string): Participant[] {
    const participants: Participant[] = [];
    const lines = text.split('\n');
    
    const bulletPattern = /(?:•|▸|-|▪|⊙)\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)\s*(?:\(([^)]+)\))?/g;
    const knownRoles = ['HEXA Ingenieros', 'Hexa Ingenieros', 'cliente', 'client', 'soporte', 'support'];
    
    for (const line of lines) {
      const matches = line.matchAll(bulletPattern);
      for (const match of matches) {
        const name = match[1]?.trim();
        const org = match[2]?.trim();
        
        if (name && name.length > 3) {
          let organization: string | undefined;
          let role: string | undefined;
          
          if (org) {
            const orgLower = org.toLowerCase();
            if (knownRoles.some(r => orgLower.includes(r.toLowerCase()))) {
              organization = org;
            } else {
              role = org;
            }
          }
          
          if (!participants.find(p => p.name === name)) {
            participants.push({ name, role, organization });
          }
        }
      }
    }
    
    return participants.slice(0, 15);
  }

  private extractWorksDone(text: string): WorkDone[] {
    const works: WorkDone[] = [];
    
    // Find the TRABAJOS REALIZADOS section
    const worksSectionMatch = text.match(/TRABAJOS REALIZADOS[\s\S]{0,8000}/i);
    if (!worksSectionMatch) return works;
    
    const worksText = worksSectionMatch[0];
    
    // Split by day patterns: "Lunes", "Martes", etc. or "Día" or date patterns
    const dayPattern = /(?:^|\n)(?:Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo|Lunes\s+\d+|Martes\s+\d+|Miércoles\s+\d+|Jueves\s+\d+|Viernes\s+\d+|Sábado\s+\d+|Domingo\s+\d+|(?:\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)))(?:\s+de\s+\d{4})?/gi;
    
    const dayMatches = worksText.match(dayPattern);
    
    if (!dayMatches || dayMatches.length === 0) {
      // Fallback: try bullet points
      return this.extractWorksFromBullets(worksText);
    }
    
    // Split by day entries
    let lastIndex = 0;
    const entries: { day: string; text: string }[] = [];
    
    for (const dayMatch of dayMatches) {
      const dayIndex = worksText.indexOf(dayMatch, lastIndex);
      if (dayIndex === -1) continue;
      
      if (lastIndex > 0) {
        entries.push({
          day: dayMatches[entries.length] || '',
          text: worksText.substring(lastIndex, dayIndex).trim()
        });
      }
      lastIndex = dayIndex + dayMatch.length;
    }
    
    // Add last entry
    if (lastIndex < worksText.length) {
      entries.push({
        day: dayMatches[dayMatches.length - 1] || '',
        text: worksText.substring(lastIndex).split('RESUMEN')[0].trim()
      });
    }
    
    // Parse each day entry
    for (const entry of entries) {
      const parsed = this.parseDayEntry(entry.text, entry.day);
      if (parsed) {
        works.push(parsed);
      }
    }
    
    return works.slice(0, 30); // Limit to 30 work entries
  }

  private extractWorksFromBullets(text: string): WorkDone[] {
    const works: WorkDone[] = [];
    const bulletPattern = /[•▸\-\*]\s*([^\n]+)/g;
    let match;
    
    while ((match = bulletPattern.exec(text)) !== null) {
      const description = match[1].trim();
      if (description.length > 10) {
        works.push({
          description: description.substring(0, 500),
          equipment: this.extractEquipmentNames(description),
          action: this.extractAction(description),
          status: this.extractStatus(description),
        });
      }
    }
    
    return works;
  }

  private parseDayEntry(text: string, dayHeader: string): WorkDone | null {
    if (!text || text.length < 20) return null;
    
    // Extract title (usually first line after date, or in bold/marked format)
    const lines = text.split('\n').filter(l => l.trim().length > 5);
    let title = '';
    let description = text;
    
    // Try to find title - often in the first few lines
    for (const line of lines.slice(0, 5)) {
      const clean = line.trim();
      if (clean.length > 10 && clean.length < 200 && !clean.match(/^se\s+/i)) {
        // This might be a title
        if (!title) {
          title = clean;
          description = text.replace(line, '').trim();
        }
      }
    }
    
    // Extract equipment and actions from full text
    const equipment = this.extractEquipmentNames(text);
    const action = this.extractAction(text);
    const status = this.extractStatus(text);
    const duration = this.extractDuration(text);
    
    // Clean up the day header
    const date = dayHeader.replace(/^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s*/i, '').trim();
    
    return {
      date: date || dayHeader,
      title: title || undefined,
      description: description.substring(0, 1000),
      equipment: equipment.length > 0 ? equipment : undefined,
      action: action || undefined,
      status: status || undefined,
      duration: duration || undefined,
    };
  }

  private extractEquipmentNames(text: string): string[] {
    const equipment: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Equipment patterns
    const patterns = [
      // Valves: GJK07AA003, YS22824, etc.
      /\b[A-Z]{2,3}\d{2,4}[A-Z]{2,3}\d{3}\b/g,
      /\bYS\d{5}\b/gi,
      /\bGJK\d{2}[A-Z]{2}\d{3}\b/gi,
      // Tanks: T1264, D10, etc.
      /\b[TD]\d{4,5}\b/g,
      // Pumps: PWS3, etc.
      /\bP\w{2,3}\d{1,2}\b/g,
      // PLCs: CLX1, etc.
      /\bCLX\d\b/gi,
      // Servers
      /\b(server|PC)\s*\d{3}\b/gi,
      // Lines
      /\blínea?\s*\w+/gi,
      // Destilador
      /\bdestilador\s*\w+/gi,
      // CIP
      /\bCIP\s*\w*/gi,
      // SCADA
      /\bSCADA\d?\b/gi,
    ];
    
    const found = new Set<string>();
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          if (m.length > 2) {
            found.add(m.toUpperCase());
          }
        }
      }
    }
    
    return Array.from(found).slice(0, 10);
  }

  private extractAction(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    
    const actionPatterns = [
      { pattern: /se\s+(soluciona|resuelve|arregla|repara|implementa|programa|realiza|configura)/i, label: 'solucionado' },
      { pattern: /queda\s+pendiente/i, label: 'pendiente' },
      { pattern: /se\s+realizan\s+pruebas/i, label: 'pruebas realizadas' },
      { pattern: /se\s+informa/i, label: 'informado' },
      { pattern: /se\s+revisa/i, label: 'revisado' },
      { pattern: /se\s+detecta/i, label: 'detectado' },
      { pattern: /se\s+solicita/i, label: 'solicitado' },
      { pattern: /se\s+recibe\s+una\s+llamada/i, label: 'llamada recibida' },
      { pattern: /se\s+conecta/i, label: 'conectado' },
      { pattern: /se\s+sube\s+el\s+tiempo/i, label: 'configuración modificada' },
      { pattern: /se\s+realiza\s+la\s+programación/i, label: 'programación realizada' },
    ];
    
    for (const { pattern, label } of actionPatterns) {
      if (pattern.test(lowerText)) {
        return label;
      }
    }
    
    return undefined;
  }

  private extractDuration(text: string): string | undefined {
    // Look for hour patterns: "2 horas", "1h", etc.
    const hourPattern = /(\d+(?:\.\d+)?)\s*(?:horas?|h|hours?)\b/i;
    const match = text.match(hourPattern);
    if (match) {
      return `${match[1]}h`;
    }
    return undefined;
  }

  private extractHoursSummary(text: string): HoursSummary | undefined {
    const result: HoursSummary = {
      normal: 0,
      extended: 0,
      night: 0,
      travel: 0,
      documentation: 0,
      total: 0,
      byDay: {},
      meals: 0,
      trips: 0,
    };

    // Find the hours section - look for multiple possible patterns
    const hoursSectionPatterns = [
      /(?:RESUMEN\s*DE\s*HORAS|HORAS\s*POR\s*FACTURAR|TOTAL\s*DE\s*HORAS|HORAS\s*NORMALES)[\s\S]{0,3000}/i,
      /Horas[\s\n]*Normales[\s\S]{0,1000}/i,
      /Total\s+de\s+horas[\s\S]{0,500}/i,
    ];
    
    let section = '';
    for (const pattern of hoursSectionPatterns) {
      const match = text.match(pattern);
      if (match && match[0].length > 50) {
        section = match[0];
        break;
      }
    }
    
    if (!section) {
      // Try finding any section with numeric hours
      const allHoursMatch = text.match(/(\d+)\s*horas?\s*(?:normal|total)/i);
      if (allHoursMatch) {
        result.total = parseInt(allHoursMatch[1]);
        result.normal = result.total;
        return result.total > 0 ? result : undefined;
      }
      return undefined;
    }
    
    // Method 1: Day-based format (AC100554-I10 style: "Horario Normal 1 0 2 8 8 19")
    const dayHeaderMatch = section.match(/([MLXJVSND]?\s*\d{1,2}\/\d{2})/gi);
    if (dayHeaderMatch && dayHeaderMatch.length > 0) {
      const days = dayHeaderMatch.map(d => d.trim());
      const lines = section.split('\n');
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('horario normal') || lowerLine.includes('normal')) {
          const nums = line.match(/\d+/g);
          if (nums && nums.length > 0) {
            result.normal = parseInt(nums[nums.length - 1]) || 0;
          }
        }
        
        if (lowerLine.includes('horario extendido') || lowerLine.includes('horario extended')) {
          const nums = line.match(/\d+/g);
          if (nums && nums.length > 0) {
            result.extended = parseInt(nums[nums.length - 1]) || 0;
          }
        }
        
        if (lowerLine.includes('horario noct') || lowerLine.includes('noct-festivo') || lowerLine.includes('nocturno')) {
          const nums = line.match(/\d+/g);
          if (nums && nums.length > 0) {
            result.night = parseInt(nums[nums.length - 1]) || 0;
          }
        }
        
        if (lowerLine.includes('desplazamiento')) {
          const nums = line.match(/\d+/g);
          if (nums && nums.length > 0) {
            result.travel = parseInt(nums[nums.length - 1]) || 0;
          }
        }
      }
    }
    
    // Method 2: Participant-based format (AC220H2001-A style: "CFP67000", "Total1060.500")
    // This format has lines like: NameNumberNumber (no spaces)
    const participantLines = section.match(/([A-Z]{2,5})(\d{2,5})(\d{3})/g);
    if (participantLines) {
      let participantTotal = 0;
      for (const pLine of participantLines) {
        const pMatch = pLine.match(/([A-Z]{2,5})(\d{2,5})(\d{3})/);
        if (pMatch) {
          const hours = parseInt(pMatch[2]) || 0;
          participantTotal += hours;
        }
      }
      if (participantTotal > 0) {
        result.normal = participantTotal;
      }
    }
    
    // Look for specific patterns for total
    // Also search in the full text for explicit hour mentions like "Total de horas invertidas (CFP): 67 horas"
    const explicitHours = text.match(/Total\s+de\s+horas\s+invertidas[^:]*:\s*(\d+)\s*horas?/gi);
    if (explicitHours && explicitHours.length > 0) {
      let sum = 0;
      for (const hourText of explicitHours) {
        const hourMatch = hourText.match(/(\d+)\s*horas?/);
        if (hourMatch) {
          sum += parseInt(hourMatch[1]);
        }
      }
      if (sum > 0 && (!result.total || result.total < sum)) {
        result.total = sum;
        result.normal = sum;
      }
    }
    
    // Pattern: "Total 106" or "Total106" or "TOTAL: 106" or "Total1060.500" (where 0.500 is displacement)
    const totalPatterns = [
      /Total[\s:.-]*(\d{2,5})[\s,.]*(\d{3})?/i,
      /TOTAL[\s:.-]*(\d{2,5})[\s,.]*(\d{3})?/i,
      /total[\s:.-]*(\d+[\.,]?\d*)\s*horas?/i,
    ];
    
    for (const pattern of totalPatterns) {
      const match = section.match(pattern);
      if (match && match[1]) {
        let total = 0;
        const hours = parseInt(match[1]);
        if (match[2]) {
          // Format: 1060.500 -> 106 hours + 0.500 travel
          // OR format: 1065 -> 106 hours + 5 travel
          if (match[1].length >= 3 && match[2].length === 3) {
            // Likely format: 1060.500 - split the first part
            const displacement = parseFloat('0.' + match[2]);
            total = hours + displacement;
          } else {
            total = parseFloat('0.' + match[2]);
          }
        } else {
          // No decimal - could be "Total106" or "Total1065"
          if (match[1].length > 3) {
            // Format: 1065 -> 106 hours + 5 displacement
            const displacement = parseInt(match[1].slice(-2));
            const normalHours = parseInt(match[1].slice(0, -2));
            total = normalHours + (displacement > 0 ? displacement : 0);
          } else {
            total = hours;
          }
        }
        if (total > 0) {
          result.total = total;
          break;
        }
      }
    }
    
    // If no total found, sum up
    if (!result.total || result.total === 0) {
      result.total = (result.normal || 0) + (result.extended || 0) + (result.night || 0);
    }
    
    // Look for billing info in full text
    const billingPatterns = [
      /horas?\s*por\s*facturar[\s\S]{0,500}/i,
      /(\d+)\s*horas?\s*normal/i,
      /facturaci[óó]n[\s\S]{0,200}/i,
    ];
    
    for (const pattern of billingPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.billingInfo = match[0].substring(0, 500);
        break;
      }
    }

    // Only return if we found some hours
    if (result.total && result.total > 0) {
      return result;
    }
    
    // Final fallback: look for any hour mentions
    const hourMentions = text.match(/(\d+)\s*horas?\s*(?:normal|nocturna|total)/gi);
    if (hourMentions && hourMentions.length > 0) {
      const hours = hourMentions.map(h => parseInt(h.match(/\d+/)?.[0] || '0'));
      const maxHours = Math.max(...hours);
      if (maxHours > 0) {
        result.total = maxHours;
        result.normal = maxHours;
        return result;
      }
    }
    
    return undefined;
  }

  private extractBillingInfo(text: string): string | undefined {
    const patterns = [
      /(?:facturación|billing|facturar)[\s:.-]*([^\n]{10,200})/i,
      /(?:modo\s*de\s*facturación)[\s\S]{10,300}/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 300);
      }
    }
    return undefined;
  }

  private extractAffectedServices(text: string): string[] {
    const services: string[] = [];
    const knownServices = [
      { pattern: /\b(scada)\b/gi, name: 'SCADA' },
      { pattern: /\b(plc|automata|autómata)\b/gi, name: 'PLC' },
      { pattern: /\b(oracle)\b/gi, name: 'Oracle' },
      { pattern: /\b(sql|mysql|postgresql)\b/gi, name: 'SQL' },
      { pattern: /\b(ifix|intouch|wincc)\b/gi, name: 'HMI/SCADA' },
      { pattern: /\b(mes)\b/gi, name: 'MES' },
      { pattern: /\b(erp)\b/gi, name: 'ERP' },
      { pattern: /\b(cim)\b/gi, name: 'CIM' },
    ];

    for (const service of knownServices) {
      if (service.pattern.test(text)) {
        services.push(service.name);
      }
    }

    return [...new Set(services)];
  }

  private extractSeverity(text: string): Severity {
    if (text.includes('crítico') || text.includes('critico') || text.includes('critical') || text.includes('p1') || text.includes('p01') || text.includes('emergencia') || text.includes('urgente')) {
      return 'critical';
    }
    if (text.includes('alto') || text.includes('high') || text.includes('p2') || text.includes('p02') || text.includes('grave')) {
      return 'high';
    }
    if (text.includes('medio') || text.includes('medium') || text.includes('p3') || text.includes('p03') || text.includes('moderado')) {
      return 'medium';
    }
    return 'low';
  }

  private extractStatus(text: string): IncidentStatus {
    if (text.includes('resuelto') || text.includes('resolved') || text.includes('cerrado') || text.includes('closed') || text.includes('finalizado') || text.includes('completado') || text.includes('aceptado')) {
      return 'resolved';
    }
    if (text.includes('progreso') || text.includes('in progress') || text.includes('en curso') || text.includes('trabajando') || text.includes('procesando')) {
      return 'in_progress';
    }
    return 'open';
  }

  private extractSubcategory(text: string): string | undefined {
    if (text.includes('finalización') || text.includes('finalizacion')) return 'Finalización';
    if (text.includes('puesta en marcha')) return 'Puesta en Marcha';
    if (text.includes('intervención') || text.includes('intervencion')) return 'Intervención';
    if (text.includes('mantenimiento') && text.includes('preventivo')) return 'Mantenimiento Preventivo';
    if (text.includes('mantenimiento') && text.includes('correctivo')) return 'Mantenimiento Correctivo';
    if (text.includes('oncall') || text.includes('on-call')) return 'On-Call';
    return undefined;
  }

  private extractDate(text: string, originalText: string): Date | undefined {
    // First try to find the date at the beginning of the document (in the header)
    // Format: "Fecha 31/07/2024" or "Fecha: 31/07/2024" or "31/07/2024"
    const headerPatterns = [
      /(?:fecha[\s:.-]*)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
      /(?:fecha[\s:.-]*)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/i,
    ];

    // Look at the first 500 chars (where the header usually is)
    const headerText = originalText.substring(0, Math.min(500, originalText.length));
    
    for (const pattern of headerPatterns) {
      const match = headerText.match(pattern);
      if (match) {
        // Determine the format based on match length
        let day: number, month: number, year: number;
        
        if (match[3].length === 4) {
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
        } else {
          // DD/MM/YY format
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = 2000 + parseInt(match[3]);
        }
        
        // Validate
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year > 2000 && year < 2100) {
          const parsed = new Date(year, month - 1, day);
          if (!isNaN(parsed.getTime())) {
            return parsed;
          }
        }
      }
    }
    
    // Try Spanish month format
    const monthNames = [
      { name: 'enero', num: 1 }, { name: 'febrero', num: 2 }, { name: 'marzo', num: 3 },
      { name: 'abril', num: 4 }, { name: 'mayo', num: 5 }, { name: 'junio', num: 6 },
      { name: 'julio', num: 7 }, { name: 'agosto', num: 8 }, { name: 'septiembre', num: 9 },
      { name: 'octubre', num: 10 }, { name: 'noviembre', num: 11 }, { name: 'diciembre', num: 12 }
    ];
    
    for (const { name, num } of monthNames) {
      const pattern = new RegExp(`(?:fecha\\s*(?:de\\s*)?)?(\\d{1,2})\\s+de\\s+${name}(?:\\s+de\\s+)?(\\d{4})`, 'i');
      const match = headerText.match(pattern);
      if (match) {
        const day = parseInt(match[1]);
        const year = parseInt(match[2]);
        if (day >= 1 && day <= 31 && year > 2000 && year < 2100) {
          return new Date(year, num - 1, day);
        }
      }
    }
    
    return undefined;
  }

  private extractIncidentNumber(filename: string): string | undefined {
    const match = filename.match(/AC\d+[A-Z]?\d*[-_]?[A-Z]?\d*/i);
    return match ? match[0].toUpperCase() : undefined;
  }

  private generateIncidentNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `INC-${year}-${random}`;
  }

  private extractTitle(text: string): string | undefined {
    const lines = text.split('\n').filter(l => l.trim().length > 5 && l.trim().length < 200);
    const titleLine = lines.find(l => !l.includes(':') && l.length > 10 && !l.match(/^\d+\s+\w+/));
    return titleLine?.substring(0, 200);
  }

  private extractAffectedSystems(text: string): string[] {
    const systems: string[] = [];
    const knownSystems = [
      { pattern: /\b(sap|erp)\b/gi, name: 'SAP' },
      { pattern: /\b(crm)\b/gi, name: 'CRM' },
      { pattern: /\b(database|bbdd|base\s*de\s*datos)\b/gi, name: 'Database' },
      { pattern: /\b(servidor|server|host)\b/gi, name: 'Servidor' },
      { pattern: /\b(red|network|lan|wan)\b/gi, name: 'Red' },
      { pattern: /\b(aplicación|application|app)\b/gi, name: 'Aplicación' },
      { pattern: /\b(web|http|https)\b/gi, name: 'Web' },
      { pattern: /\b(email|correo|outlook)\b/gi, name: 'Email' },
      { pattern: /\b(storage|almacenamiento|disco)\b/gi, name: 'Storage' },
      { pattern: /\b(backup|respaldo)\b/gi, name: 'Backup' },
      { pattern: /\b(dns|dhcp|ldap)\b/gi, name: 'Infraestructura' },
      { pattern: /\b(firewall|seguridad)\b/gi, name: 'Seguridad' },
      { pattern: /\b(api|webservice)\b/gi, name: 'API' },
      { pattern: /\b(linux|windows|unix)\b/gi, name: 'SO' },
    ];

    for (const system of knownSystems) {
      if (system.pattern.test(text)) {
        systems.push(system.name);
      }
    }

    return [...new Set(systems)];
  }

  private extractCategory(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('incidencia') || lowerText.includes('inciden')) return 'Incidencia';
    if (lowerText.includes('oncall') || lowerText.includes('on-call') || lowerText.includes('on call')) return 'On-Call';
    if (lowerText.includes('acta')) return 'Acta';
    if (lowerText.includes('preventivo') && lowerText.includes('mantenimiento')) return 'Mantenimiento Preventivo';
    if (lowerText.includes('correctivo') && lowerText.includes('mantenimiento')) return 'Mantenimiento Correctivo';
    if (lowerText.includes('mantenimiento')) return 'Mantenimiento';
    if (lowerText.includes('mejora') || lowerText.includes('enhancement')) return 'Mejora';
    return undefined;
  }

  private extractEnvironment(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('producción') || lowerText.includes('production') || lowerText.includes('prod')) return 'production';
    if (lowerText.includes('preproducción') || lowerText.includes('preproduction') || lowerText.includes('pre-prod')) return 'preproduction';
    if (lowerText.includes('staging') || lowerText.includes('preprod')) return 'staging';
    if (lowerText.includes('desarrollo') || lowerText.includes('development') || lowerText.includes('dev')) return 'development';
    if (lowerText.includes('testing') || lowerText.includes('test') || lowerText.includes('qa')) return 'testing';
    return 'production';
  }

  private extractSummary(text: string): string {
    const lines = text.split('\n').filter(l => l.trim().length > 20);
    return lines.slice(0, 3).join(' ').substring(0, 500);
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];
    
    const severity = this.extractSeverity(text.toLowerCase());
    tags.push(severity);

    const category = this.extractCategory(text);
    if (category) tags.push(category);

    const subcategory = this.extractSubcategory(text.toLowerCase());
    if (subcategory) tags.push(subcategory);

    const environment = this.extractEnvironment(text.toLowerCase());
    if (environment) tags.push(environment);

    const systems = this.extractAffectedSystems(text);
    tags.push(...systems);

    const services = this.extractAffectedServices(text);
    tags.push(...services);

    const client = this.extractClient(text);
    if (client) tags.push(client.substring(0, 30));

    return [...new Set(tags)];
  }

  private extractResolutionSteps(text: string): string[] {
    const steps: string[] = [];
    const lines = text.split('\n');
    
    const resolutionKeywords = ['resolución', 'resolucion', 'solución', 'solucion', 'steps', 'acciones', 'procedimiento', 'actuación'];
    let inResolutionSection = false;
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (resolutionKeywords.some(kw => lowerLine.includes(kw))) {
        inResolutionSection = true;
        continue;
      }
      
      if (inResolutionSection && line.trim()) {
        const cleaned = line.trim().replace(/^[\d\.\)\-\*]+\s*/, '');
        if (cleaned.length > 10 && cleaned.length < 300) {
          steps.push(cleaned.substring(0, 300));
        }
      }
      
      if (line.trim() === '' && steps.length > 0) {
        inResolutionSection = false;
      }
    }
    
    return steps.slice(0, 10);
  }

  private extractRootCause(text: string): string | undefined {
    const patterns = [
      /(?:causa\s*raíz|causa\s*root|origen|root\s*cause)[\s:.-]*([^\n]{10,200})/i,
      /(?:motivo|razón|reason)[\s:.-]*([^\n]{10,200})/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].substring(0, 500).trim();
      }
    }
    return undefined;
  }

  private extractImpact(text: string): string | undefined {
    const patterns = [
      /(?:impacto|impact|afectación|afectado)[\s:.-]*([^\n]{10,300})/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].substring(0, 500).trim();
      }
    }
    return undefined;
  }

  private extractPreventiveActions(text: string): string[] {
    const actions: string[] = [];
    const patterns = [
      /(?:prevenir|preventivo|prevention|acciones\s*preventivas?|mejora|mejoras)[\s:.-]*([^\n]{10,200})/gi,
    ];
    
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          actions.push(match[1].substring(0, 200).trim());
        }
      }
    }
    
    return actions.slice(0, 5);
  }

  private extractAssignedTo(text: string): string | undefined {
    const patterns = [
      /(?:asignado|assigned|responsable|technician|ingeniero|soporte)[\s:.-]*([^\n]{3,50})/i,
      /(?:técnico|tecnico|tech)[\s:.-]*([^\n]{3,50})/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/[,:\.]+$/, '').trim();
      }
    }
    return undefined;
  }

  private extractReportedBy(text: string): string | undefined {
    const patterns = [
      /(?:reportado|reported|creado|created\s*by|autor|author)[\s:.-]*([^\n]{3,50})/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/[,:\.]+$/, '').trim();
      }
    }
    return undefined;
  }
}
