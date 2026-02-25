import { X, User, Building2, FileText, Calendar, Tag } from 'lucide-react';
import type { IncidentReport } from '../lib/types';

interface IncidentDetailProps {
  incident: IncidentReport;
  onClose: () => void;
}

export function IncidentDetail({ incident, onClose }: IncidentDetailProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'high': return 'severity-high';
      case 'medium': return 'severity-medium';
      case 'low': return 'severity-low';
      default: return '';
    }
  };

  return (
    <div className="incident-detail">
      <div className="detail-header">
        <h2>{incident.incidentNumber}</h2>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h3>Información General</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <Tag size={14} />
              <span className="label">Título:</span>
              <span className="value">{incident.title}</span>
            </div>
            <div className="detail-item">
              <Building2 size={14} />
              <span className="label">Cliente:</span>
              <span className="value">{incident.client || '-'}</span>
            </div>
            <div className="detail-item">
              <FileText size={14} />
              <span className="label">Proyecto:</span>
              <span className="value">{incident.project || '-'}</span>
            </div>
            <div className="detail-item">
              <Calendar size={14} />
              <span className="label">Fecha:</span>
              <span className="value">
                {incident.detectedAt ? new Date(incident.detectedAt).toLocaleDateString('es-ES') : '-'}
              </span>
            </div>
            <div className="detail-item">
              <span className={`severity-badge ${getSeverityColor(incident.severity)}`}>
                {incident.severity}
              </span>
            </div>
            <div className="detail-item">
              <span className="status-badge">{incident.status}</span>
            </div>
          </div>
        </div>

        {incident.hoursSummary && (
          <div className="detail-section">
            <h3>Horas</h3>
            <div className="hours-grid">
              {incident.hoursSummary.normal !== undefined && incident.hoursSummary.normal > 0 && (
                <div className="hour-item">
                  <span className="hour-type">Normal</span>
                  <span className="hour-value">{incident.hoursSummary.normal}h</span>
                </div>
              )}
              {incident.hoursSummary.extended !== undefined && incident.hoursSummary.extended > 0 && (
                <div className="hour-item">
                  <span className="hour-type">Extendido</span>
                  <span className="hour-value">{incident.hoursSummary.extended}h</span>
                </div>
              )}
              {incident.hoursSummary.night !== undefined && incident.hoursSummary.night > 0 && (
                <div className="hour-item">
                  <span className="hour-type">Nocturno</span>
                  <span className="hour-value">{incident.hoursSummary.night}h</span>
                </div>
              )}
              {incident.hoursSummary.travel !== undefined && incident.hoursSummary.travel > 0 && (
                <div className="hour-item">
                  <span className="hour-type">Desplazamiento</span>
                  <span className="hour-value">{incident.hoursSummary.travel}h</span>
                </div>
              )}
              {incident.hoursSummary.documentation !== undefined && incident.hoursSummary.documentation > 0 && (
                <div className="hour-item">
                  <span className="hour-type">Documentación</span>
                  <span className="hour-value">{incident.hoursSummary.documentation}h</span>
                </div>
              )}
              {incident.hoursSummary.total !== undefined && incident.hoursSummary.total > 0 && (
                <div className="hour-item total">
                  <span className="hour-type">Total</span>
                  <span className="hour-value">{incident.hoursSummary.total}h</span>
                </div>
              )}
            </div>
          </div>
        )}

        {incident.participants && incident.participants.length > 0 && (
          <div className="detail-section">
            <h3>Participantes</h3>
            <div className="participants-list">
              {incident.participants.map((p, i) => (
                <div key={i} className="participant">
                  <User size={14} />
                  <span className="participant-name">{p.name}</span>
                  {p.role && <span className="participant-role">{p.role}</span>}
                  {p.organization && <span className="participant-org">{p.organization}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {incident.description && (
          <div className="detail-section">
            <h3>Descripción</h3>
            <div className="description-text">
              {incident.description.substring(0, 1000)}
              {incident.description.length > 1000 && '...'}
            </div>
          </div>
        )}

        {incident.tags && incident.tags.length > 0 && (
          <div className="detail-section">
            <h3>Etiquetas</h3>
            <div className="tags-list">
              {incident.tags.map((tag, i) => (
                <span key={i} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
