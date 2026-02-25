import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Chat } from './components/Chat';
import { FileUploader } from './components/FileUploader';
import { IncidentDetail } from './components/IncidentDetail';
import { useRag } from './hooks/useRag';
import { MessageSquare, Upload, Menu, X } from 'lucide-react';
import type { Message, IncidentReport } from './lib/types';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

type View = 'chat' | 'upload';

function App() {
  const { incidents, loading, fetchIncidents, fetchStats, agentQuery, ingestPdf } = useRag();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentView, setCurrentView] = useState<View>('chat');
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [filters, setFilters] = useState({
    client: null as string | null,
    category: null as string | null,
    severity: null as string | null,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchIncidents();
    fetchStats();
  }, [fetchIncidents, fetchStats]);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await agentQuery(content, false, 5);
      
      const sources = response?.sources?.map(s => ({
        incident: s.incident,
        chunks: [{ text: s.relevantText, score: s.relevance }],
      }));
      
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: response?.answer || 'No se pudo generar una respuesta.',
        sources,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu pregunta. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [agentQuery]);

  const handleUpload = useCallback(async (file: File) => {
    const filePath = `./${file.name}`;
    const result = await ingestPdf(filePath);
    if (result) {
      fetchIncidents();
    }
  }, [ingestPdf, fetchIncidents]);

  const handleFilterChange = (key: 'client' | 'category' | 'severity', value: string | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="header-title">
            <h1>HEXA RAG</h1>
            <span>Asistente de Actas</span>
          </div>
        </div>
        <div className="header-tabs">
          <button
            className={`tab ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentView('chat')}
          >
            <MessageSquare size={18} />
            <span>Chat</span>
          </button>
          <button
            className={`tab ${currentView === 'upload' ? 'active' : ''}`}
            onClick={() => setCurrentView('upload')}
          >
            <Upload size={18} />
            <span>Subir PDFs</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        {sidebarOpen && (
          <Sidebar
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
            filters={filters}
            onFilterChange={handleFilterChange}
            loading={loading}
          />
        )}

        <div className="main-content">
          {currentView === 'chat' ? (
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              loading={loading}
            />
          ) : (
            <div className="upload-view">
              <FileUploader
                onUpload={handleUpload}
                uploading={loading}
              />
            </div>
          )}
        </div>

        {selectedIncident && (
          <IncidentDetail
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
