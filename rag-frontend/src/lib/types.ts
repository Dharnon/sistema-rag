export interface IncidentReport {
  id: string;
  incidentNumber: string;
  reference?: string;
  title: string;
  detectedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
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
  worksDone?: WorkDone[];
  resolutionSteps: string[];
  workaround?: string;
  preventiveActions: string[];
  hoursSummary?: HoursSummary;
  billingInfo?: string;
  reportedBy?: string;
  assignedTo?: string;
  affectedSystems?: string[];
  affectedServices?: string[];
  tags?: string[];
  version: number;
}

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
  byDay?: Record<string, number>;
  details?: string;
  billingInfo?: string;
  meals?: number;
  trips?: number;
}

export interface SearchResult {
  incident: IncidentReport;
  chunks: {
    text: string;
    score: number;
  }[];
  totalScore: number;
}

export interface SearchQuery {
  query: string;
  limit?: number;
  filters?: {
    severity?: string[];
    status?: string[];
    category?: string;
    environment?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface Stats {
  totalIncidents: number;
  totalChunks: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    incident: IncidentReport;
    relevantText?: string;
    score?: number;
    chunks?: { text: string; score: number }[];
  }[];
  timestamp: Date;
}

export interface AgentSource {
  incident: IncidentReport;
  relevantText: string;
  relevance: number;
}

export interface AgentResponse {
  answer: string;
  sources: AgentSource[];
  suggestedFollowUp?: string[];
}
