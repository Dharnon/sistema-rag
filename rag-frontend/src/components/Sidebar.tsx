import { useState, useMemo } from 'react';
import { 
  FileText, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronRight,
  Clock,
  Building2,
  Tag,
  AlertCircle
} from 'lucide-react';
import type { IncidentReport } from '../lib/types';

interface SidebarProps {
  incidents: IncidentReport[];
  selectedIncident: IncidentReport | null;
  onSelectIncident: (incident: IncidentReport | null) => void;
  filters: {
    client: string | null;
    category: string | null;
    severity: string | null;
  };
  onFilterChange: (key: 'client' | 'category' | 'severity', value: string | null) => void;
  loading: boolean;
}

export function Sidebar({
  incidents,
  selectedIncident,
  onSelectIncident,
  filters,
  onFilterChange,
  loading,
}: SidebarProps) {
  const [showFilters, setShowFilters] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    clients: true,
    categories: true,
    severity: true,
  });

  const uniqueClients = useMemo(() => {
    const clients = new Set(incidents.map(i => i.client).filter(Boolean));
    return Array.from(clients).sort();
  }, [incidents]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set(incidents.map(i => i.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [incidents]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const clearFilters = () => {
    onFilterChange('client', null);
    onFilterChange('category', null);
    onFilterChange('severity', null);
  };

  const hasActiveFilters = filters.client || filters.category || filters.severity;

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      if (filters.client && incident.client !== filters.client) return false;
      if (filters.category && incident.category !== filters.category) return false;
      if (filters.severity && incident.severity !== filters.severity) return false;
      return true;
    });
  }, [incidents, filters]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return 'badge-resolved';
      case 'closed': return 'badge-closed';
      case 'in_progress': return 'badge-progress';
      default: return 'badge-open';
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Documentos</h2>
        <div className="sidebar-stats">
          <span>{filteredIncidents.length} de {incidents.length} actas</span>
        </div>
      </div>

      <div className="sidebar-section">
        <button 
          className="section-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          <span>Filtros</span>
          {showFilters ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {showFilters && (
          <div className="filters-panel">
            {/* Clients */}
            <div className="filter-group">
              <button
                className="filter-header"
                onClick={() => toggleSection('clients')}
              >
                <Building2 size={14} />
                <span>Cliente</span>
                {expandedSections.clients ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {expandedSections.clients && (
                <div className="filter-options">
                  {uniqueClients.map(client => client && (
                    <button
                      key={client}
                      className={`filter-option ${filters.client === client ? 'active' : ''}`}
                      onClick={() => onFilterChange('client', filters.client === client ? null : client)}
                    >
                      {client}
                    </button>
                  ))}
                  {uniqueClients.length === 0 && (
                    <span className="empty-filter">Sin datos</span>
                  )}
                </div>
              )}
            </div>

            {/* Categories */}
            <div className="filter-group">
              <button
                className="filter-header"
                onClick={() => toggleSection('categories')}
              >
                <Tag size={14} />
                <span>Categoría</span>
                {expandedSections.categories ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {expandedSections.categories && (
                <div className="filter-options">
                  {uniqueCategories.map(category => (
                    <button
                      key={category}
                      className={`filter-option ${filters.category === category ? 'active' : ''}`}
                      onClick={() => onFilterChange('category', filters.category === category ? null : category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Severity */}
            <div className="filter-group">
              <button
                className="filter-header"
                onClick={() => toggleSection('severity')}
              >
                <AlertCircle size={14} />
                <span>Severidad</span>
                {expandedSections.severity ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {expandedSections.severity && (
                <div className="filter-options">
                  {['critical', 'high', 'medium', 'low'].map(sev => (
                    <button
                      key={sev}
                      className={`filter-option severity-option ${filters.severity === sev ? 'active' : ''}`}
                      onClick={() => onFilterChange('severity', filters.severity === sev ? null : sev)}
                    >
                      <span className={`severity-dot ${sev}`} />
                      <span className="capitalize">{sev}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <button className="clear-filters" onClick={clearFilters}>
                <X size={14} />
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <div className="documents-list">
        {loading ? (
          <div className="loading-state">Cargando...</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="empty-state">
            <FileText size={32} />
            <p>No hay documentos</p>
          </div>
        ) : (
          filteredIncidents.map(incident => (
            <button
              key={incident.id}
              className={`document-item ${selectedIncident?.id === incident.id ? 'selected' : ''}`}
              onClick={() => onSelectIncident(selectedIncident?.id === incident.id ? null : incident)}
            >
              <div className="document-icon">
                <FileText size={18} />
              </div>
              <div className="document-info">
                <span className="document-title">{incident.incidentNumber}</span>
                <span className="document-meta">
                  {incident.client || 'Sin cliente'}
                </span>
                <div className="document-badges">
                  <span className={`badge ${getStatusBadge(incident.status)}`}>
                    {incident.status === 'in_progress' ? 'En proceso' : incident.status}
                  </span>
                  <span className={`severity-badge ${getSeverityColor(incident.severity)}`}>
                    {incident.severity}
                  </span>
                </div>
                {incident.hoursSummary?.total && (
                  <span className="document-hours">
                    <Clock size={12} />
                    {incident.hoursSummary.total}h
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
