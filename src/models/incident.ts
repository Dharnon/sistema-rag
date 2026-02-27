export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type WorkType = 'preventivo' | 'correctivo' | 'predictivo' | 'oncall' | 'instalacion' | 'auditoria';

export interface Participant {
  name: string;
  role?: string;
  organization?: string;
}

export interface WorkDone {
  date?: string;
  title?: string;
  description: string;
  duration?: string;
  equipment?: string[];
  action?: string;
  status?: string;
}

export interface HoursSummary {
  normal?: number;
  extended?: number;
  night?: number;
  travel?: number;
  documentation?: number;
  total?: number;
  byDay?: { [key: string]: number };
  details?: string;
  billingInfo?: string;
  meals?: number;
  trips?: number;
}

export interface IncidentReport {
  id: string;
  incidentNumber: string;
  reference?: string;
  title: string;
  detectedAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  severity: Severity;
  status: IncidentStatus;
  category: string;
  subcategory?: string;
  environment: string;
  
  client?: string;
  project?: string;
  contract?: string;
  
  summary: string;
  description?: string;
  
  participants?: Participant[];
  problemDescription?: string;
  rootCause?: string;
  impact?: string;
  diagnosis?: string;
  solution?: string;
  
  workType?: WorkType;
  equipment?: string[];
  materials?: string[];
  
  worksDone?: WorkDone[];
  resolutionSteps: string[];
  workaround?: string;
  preventiveActions: string[];
  
  hoursSummary?: HoursSummary;
  billingInfo?: string;
  
  reportedBy: string;
  assignedTo?: string;
  resolvedBy?: string;
  
  ttdMinutes?: number;
  ttrMinutes?: number;
  documentPath?: string;
  
  affectedSystems: string[];
  affectedServices: string[];
  tags: string[];
  
  version: number;
}

export interface DocumentChunk {
  id: string;
  incidentId: string;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  qdrantPointId?: string;
  createdAt: Date;
}

export interface SearchResult {
  incident: IncidentReport;
  chunks: {
    text: string;
    score: number;
  }[];
  totalScore: number;
}

export interface CreateIncidentRequest {
  title: string;
  detectedAt: string;
  severity: Severity;
  category: string;
  subcategory?: string;
  environment: string;
  summary: string;
  description?: string;
  rootCause?: string;
  impact?: string;
  resolutionSteps?: string[];
  workaround?: string;
  preventiveActions?: string[];
  reportedBy: string;
  assignedTo?: string;
  affectedSystems?: string[];
  affectedServices?: string[];
  tags?: string[];
  documentPdf?: string;
}

export interface SearchQuery {
  query: string;
  filters?: {
    severity?: Severity[];
    status?: IncidentStatus[];
    category?: string;
    environment?: string;
    dateFrom?: string;
    dateTo?: string;
    affectedSystems?: string[];
    tags?: string[];
    client?: string;
  };
  limit?: number;
}
