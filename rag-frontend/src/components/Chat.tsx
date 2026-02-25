import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import type { Message } from '../lib/types';

interface ChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  loading: boolean;
}

export function Chat({ messages, onSendMessage, loading }: ChatProps) {
  const [input, setInput] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !loading) {
      onSendMessage(input.trim());
      setInput('');
    }
  }, [input, loading, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const toggleSource = (id: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'text-gray-500';
    }
  };

  const exampleQueries = [
    '¿Qué trabajos se realizaron en Laboratorios Normon?',
    '¿Qué incidencias hubo con válvulas?',
    '¿Cuántas horas de mantenimiento se facturaron?',
  ];

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div style={{ 
              width: 64, 
              height: 64, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              boxShadow: 'var(--shadow-md)'
            }}>
              <Sparkles size={28} color="white" />
            </div>
            <h3>Asistente de Actas</h3>
            <p>Pregunta sobre los documentos de HEXA Ingenieros</p>
            <div className="example-queries">
              <p>Ejemplos:</p>
              {exampleQueries.map((query, idx) => (
                <button key={idx} onClick={() => setInput(query)}>
                  "{query}"
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(message => (
          <div key={message.id} className={`message message-${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              
              {message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <div className="sources-header">
                    <FileText size={14} />
                    <span>{message.sources.length} fuente{message.sources.length > 1 ? 's' : ''}</span>
                  </div>
                  
                  {message.sources.map((source, idx) => {
                    const sourceId = `${message.id}-${idx}`;
                    const isExpanded = expandedSources.has(sourceId);
                    
                    return (
                      <div key={idx} className="source-card">
                        <button 
                          className="source-header"
                          onClick={() => toggleSource(sourceId)}
                        >
                          <div className="source-info">
                            <span className="source-number">#{idx + 1}</span>
                            <span className="source-title">
                              {source.incident.incidentNumber}
                            </span>
                            <span className={`source-severity ${getSeverityColor(source.incident.severity)}`}>
                              {source.incident.severity}
                            </span>
                            {source.incident.client && (
                              <span className="source-client">
                                {source.incident.client}
                              </span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        
                        {isExpanded && (
                          <div className="source-content">
                            <div className="source-chunks">
                              {(source.chunks || source.relevantText ? [{
                                text: source.relevantText || '',
                                score: source.score || 0
                              }] : []).map((chunk, chunkIdx) => (
                                <div key={chunkIdx} className="chunk">
                                  <div className="chunk-text">
                                    {chunk.text.substring(0, 300)}
                                    {chunk.text.length > 300 && '...'}
                                  </div>
                                  <div className="chunk-meta">
                                    <span className="chunk-score">
                                      Relevancia: {Math.round(chunk.score * 100)}%
                                    </span>
                                    <button 
                                      className="copy-btn"
                                      onClick={() => copyToClipboard(chunk.text, `${sourceId}-${chunkIdx}`)}
                                    >
                                      {copiedId === `${sourceId}-${chunkIdx}` ? (
                                        <Check size={12} />
                                      ) : (
                                        <Copy size={12} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {source.incident.hoursSummary && (
                              <div className="source-hours">
                                <strong>Horas:</strong>
                                {source.incident.hoursSummary.normal && (
                                  <span>Normal: {source.incident.hoursSummary.normal}h</span>
                                )}
                                {source.incident.hoursSummary.night && (
                                  <span>Nocturno: {source.incident.hoursSummary.night}h</span>
                                )}
                                {source.incident.hoursSummary.total && (
                                  <span>Total: {source.incident.hoursSummary.total}h</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="message message-assistant">
            <div className="message-avatar">
              <Bot size={20} />
            </div>
            <div className="message-content">
              <div className="message-typing">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          <Send size={18} />
          <span>Enviar</span>
        </button>
      </form>
    </div>
  );
}
