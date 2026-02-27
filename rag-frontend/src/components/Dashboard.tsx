import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Clock, 
  Users, 
  TrendingUp,
  AlertCircle,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { EnhancedStats } from '../lib/types';

interface DashboardProps {
  stats: EnhancedStats | null;
  loading: boolean;
  onFilterByClient?: (client: string) => void;
}

export function Dashboard({ stats, loading, onFilterByClient }: DashboardProps) {
  const [showExplorer, setShowExplorer] = useState(false);
  const [filters, setFilters] = useState({
    client: '',
    project: '',
    workType: '',
    dateFrom: '',
    dateTo: '',
  });
  const [sortField, setSortField] = useState<string>('detectedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  useEffect(() => {
  }, [stats, loading]);

  if (loading || !stats) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Cargando estadísticas...</p>
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };

  const categoryLabels: Record<string, string> = {
    Acta: 'Actas',
    Incidencia: 'Incidencias',
    'On-Call': 'On-Call',
    'Mantenimiento': 'Mantenimiento',
    'Mantenimiento Preventivo': 'Mant. Preventivo',
    'Mantenimiento Correctivo': 'Mant. Correctivo',
  };

  const clientEntries = Object.entries(stats.byClient || {}).sort((a, b) => b[1] - a[1]);
  const categoryEntries = Object.entries(stats.byCategory || {}).sort((a, b) => b[1] - a[1]);
  const severityEntries = Object.entries(stats.bySeverity || {}).sort((a, b) => {
    const order = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  });
  
  const workTypeEntries = Object.entries(stats.byWorkType || {}).sort((a, b) => b[1] - a[1]);
  
  const workTypeColors: Record<string, string> = {
    'On-Call': '#8b5cf6',
    'Preventivo': '#10b981',
    'Correctivo': '#f97316',
    'Predictivo': '#06b6d4',
    'Instalación': '#f59e0b',
    'Auditoría': '#6366f1',
    'Sin clasificar': '#9ca3af',
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p>Resumen de documentos y actividad</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalIncidents}</span>
            <span className="stat-label">Documentos</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalHours}h</span>
            <span className="stat-label">Horas Totales</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.topParticipants?.length || 0}</span>
            <span className="stat-label">Participantes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <BarChart3 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalChunks}</span>
            <span className="stat-label">Chunks</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>
            <TrendingUp size={18} />
            Por Cliente
          </h3>
          {clientEntries.length > 0 ? (
            <div className="chart-container">
              {clientEntries.map(([client, count]) => (
                <div 
                  key={client} 
                  className="chart-bar-row"
                  onClick={() => onFilterByClient?.(client)}
                >
                  <span className="chart-label">{client}</span>
                  <div className="chart-bar-container">
                    <div 
                      className="chart-bar" 
                      style={{ 
                        width: `${(count / stats.totalIncidents) * 100}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                      }}
                    ></div>
                  </div>
                  <span className="chart-value">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">No hay datos de clientes</p>
          )}
        </div>

        <div className="dashboard-card">
          <h3>
            <AlertCircle size={18} />
            Por Severidad
          </h3>
          <div className="severity-chart">
            {severityEntries.map(([severity, count]) => (
              <div key={severity} className="severity-row">
                <div className="severity-info">
                  <span 
                    className="severity-dot" 
                    style={{ background: severityColors[severity] || '#6b7280' }}
                  ></span>
                  <span className="severity-label capitalize">{severity}</span>
                </div>
                <div className="severity-bar-container">
                  <div 
                    className="severity-bar" 
                    style={{ 
                      width: `${(count / stats.totalIncidents) * 100}%`,
                      background: severityColors[severity] || '#6b7280'
                    }}
                  ></div>
                </div>
                <span className="severity-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>
            <FileText size={18} />
            Por Categoría
          </h3>
          {categoryEntries.length > 0 ? (
            <div className="category-list">
              {categoryEntries.map(([category, count]) => (
                <div key={category} className="category-row">
                  <span className="category-name">
                    {categoryLabels[category] || category}
                  </span>
                  <span className="category-count">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">No hay categorías</p>
          )}
        </div>

        <div className="dashboard-card">
          <h3>
            <AlertCircle size={18} />
            Por Tipo de Trabajo
          </h3>
          {workTypeEntries.length > 0 ? (
            <div className="severity-chart">
              {workTypeEntries.map(([workType, count]) => (
                <div key={workType} className="severity-row">
                  <div className="severity-info">
                    <span 
                      className="severity-dot" 
                      style={{ background: workTypeColors[workType] || '#6b7280' }}
                    ></span>
                    <span className="severity-label">{workType}</span>
                  </div>
                  <div className="severity-bar-container">
                    <div 
                      className="severity-bar" 
                      style={{ 
                        width: `${(count / stats.totalIncidents) * 100}%`,
                        background: workTypeColors[workType] || '#6b7280'
                      }}
                    ></div>
                  </div>
                  <span className="severity-value">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">No hay tipos de trabajo</p>
          )}
        </div>

        <div className="dashboard-card">
          <h3>
            <Users size={18} />
            Top Participantes
          </h3>
          {stats.topParticipants && stats.topParticipants.length > 0 ? (
            <div className="participants-list">
              {stats.topParticipants.map((p, idx) => (
                <div key={p.name} className="participant-row">
                  <span className="participant-rank">#{idx + 1}</span>
                  <span className="participant-name">{p.name}</span>
                  <span className="participant-count">{p.count} docs</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">No hay participantes</p>
          )}
        </div>
      </div>

      <div className="dashboard-card full-width">
        <h3>
          <Calendar size={18} />
          Actividad Reciente
        </h3>
        {stats.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="recent-activity">
            {stats.recentActivity.map((item) => (
              <div key={item.id} className="activity-item">
                <div className="activity-icon">
                  <FileText size={16} />
                </div>
                <div className="activity-content">
                  <span className="activity-number">{item.incidentNumber}</span>
                  <span className="activity-client">{item.client || 'Sin cliente'}</span>
                </div>
                <div className="activity-meta">
                  <span className="activity-category">{item.category}</span>
                  <span className="activity-date">
                    {new Date(item.detectedAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-message">No hay actividad reciente</p>
        )}
      </div>

      <div className="hours-summary">
        <div className="hours-card">
          <h4>Desglose de Horas</h4>
          <div className="hours-grid">
            <div className="hours-item">
              <span className="hours-label">Horario Normal</span>
              <span className="hours-value">{stats.normalHours || 0}h</span>
            </div>
            <div className="hours-item">
              <span className="hours-label">Horario Nocturno</span>
              <span className="hours-value">{stats.nightHours || 0}h</span>
            </div>
            <div className="hours-item">
              <span className="hours-label">Horario Extendido</span>
              <span className="hours-value">{stats.extendedHours || 0}h</span>
            </div>
            <div className="hours-item total">
              <span className="hours-label">Total</span>
              <span className="hours-value">{stats.totalHours || 0}h</span>
            </div>
          </div>
        </div>
      </div>

      <div className="explorer-toggle">
        <button 
          className="toggle-btn"
          onClick={() => setShowExplorer(!showExplorer)}
        >
          <BarChart3 size={18} />
          {showExplorer ? 'Ocultar' : 'Explorador de Datos'}
          {showExplorer ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {showExplorer && stats.allIncidents && (
        <div className="data-explorer">
          <div className="explorer-filters">
            <div className="filter-group">
              <label>Cliente</label>
              <select 
                value={filters.client}
                onChange={(e) => setFilters({...filters, client: e.target.value})}
              >
                <option value="">Todos</option>
                {Object.keys(stats.byClient || {}).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Tipo de Trabajo</label>
              <select 
                value={filters.workType}
                onChange={(e) => setFilters({...filters, workType: e.target.value})}
              >
                <option value="">Todos</option>
                {Object.keys(stats.byWorkType || {}).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Desde</label>
              <input 
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              />
            </div>
            <div className="filter-group">
              <label>Hasta</label>
              <input 
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              />
            </div>
            <button 
              className="clear-btn"
              onClick={() => setFilters({client: '', project: '', workType: '', dateFrom: '', dateTo: ''})}
            >
              Limpiar
            </button>
          </div>

          {(() => {
            let filtered = [...(stats.allIncidents || [])];
            
            if (filters.client) {
              filtered = filtered.filter(i => i.client === filters.client);
            }
            if (filters.workType) {
              filtered = filtered.filter(i => i.workType === filters.workType);
            }
            if (filters.dateFrom) {
              filtered = filtered.filter(i => new Date(i.detectedAt) >= new Date(filters.dateFrom));
            }
            if (filters.dateTo) {
              filtered = filtered.filter(i => new Date(i.detectedAt) <= new Date(filters.dateTo));
            }
            
            const totalHoras = filtered.reduce((sum, i) => sum + (i.hoursSummary?.total || 0), 0);
            const totalNormal = filtered.reduce((sum, i) => sum + (i.hoursSummary?.normal || 0), 0);
            const totalNoche = filtered.reduce((sum, i) => sum + (i.hoursSummary?.night || 0), 0);
            
            const sorted = filtered.sort((a, b) => {
              let aVal: any, bVal: any;
              if (sortField === 'detectedAt') {
                aVal = new Date(a.detectedAt).getTime();
                bVal = new Date(b.detectedAt).getTime();
              } else if (sortField === 'hours') {
                aVal = a.hoursSummary?.total || 0;
                bVal = b.hoursSummary?.total || 0;
              } else if (sortField === 'client') {
                aVal = a.client || '';
                bVal = b.client || '';
              } else {
                aVal = (a as any)[sortField] || '';
                bVal = (b as any)[sortField] || '';
              }
              if (sortDir === 'asc') {
                return aVal > bVal ? 1 : -1;
              }
              return aVal < bVal ? 1 : -1;
            });

            return (
              <>
                <div className="explorer-summary">
                  <span><strong>{filtered.length}</strong> documentos</span>
                  <span><strong>{totalHoras}h</strong> totales</span>
                  <span>(Normal: {totalNormal}h | Noche: {totalNoche}h)</span>
                </div>
                
                <div className="explorer-table-container">
                  <table className="explorer-table">
                    <thead>
                      <tr>
                        <th onClick={() => { setSortField('incidentNumber'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                          Acta {sortField === 'incidentNumber' && (sortDir === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => { setSortField('client'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                          Cliente {sortField === 'client' && (sortDir === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => { setSortField('detectedAt'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                          Fecha {sortField === 'detectedAt' && (sortDir === 'asc' ? '▲' : '▼')}
                        </th>
                        <th>Tipo</th>
                        <th onClick={() => { setSortField('hours'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                          Horas {sortField === 'hours' && (sortDir === 'asc' ? '▲' : '▼')}
                        </th>
                        <th>Participantes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(inc => (
                        <React.Fragment key={inc.id}>
                          <tr 
                            className={expandedRow === inc.id ? 'expanded' : ''}
                            onClick={() => setExpandedRow(expandedRow === inc.id ? null : inc.id)}
                          >
                            <td className="cell-number">{inc.incidentNumber}</td>
                            <td>{inc.client || '-'}</td>
                            <td>{new Date(inc.detectedAt).toLocaleDateString('es-ES')}</td>
                            <td>
                              <span className={`type-badge type-${inc.workType || 'default'}`}>
                                {inc.workType || 'General'}
                              </span>
                            </td>
                            <td className="cell-hours">
                              {inc.hoursSummary?.total || 0}h
                              {(inc.hoursSummary?.normal || inc.hoursSummary?.night) && (
                                <span className="hours-detail">
                                  (N:{inc.hoursSummary.normal || 0} No:{inc.hoursSummary.night || 0})
                                </span>
                              )}
                            </td>
                            <td className="cell-participants">
                              {inc.participants?.map((p: any) => p.name).join(', ') || '-'}
                            </td>
                          </tr>
                          {expandedRow === inc.id && (
                            <tr className="expanded-row">
                              <td colSpan={6}>
                                <div className="expanded-content">
                                  <div className="exp-section">
                                    <strong>Proyecto:</strong> {inc.project || '-'}
                                  </div>
                                  <div className="exp-section">
                                    <strong>Título:</strong> {inc.title}
                                  </div>
                                  <div className="exp-section">
                                    <strong>Desglose horas:</strong> Normal: {inc.hoursSummary?.normal || 0}h | 
                                    Noche: {inc.hoursSummary?.night || 0}h | 
                                    Extendido: {inc.hoursSummary?.extended || 0}h | 
                                    Desplazamiento: {inc.hoursSummary?.travel || 0}h
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
