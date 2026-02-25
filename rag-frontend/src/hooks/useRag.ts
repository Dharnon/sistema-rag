import { useState, useCallback } from 'react';
import type { IncidentReport, SearchResult, Stats, AgentResponse } from '../lib/types';

const API_BASE = 'http://localhost:3001';

export function useRag() {
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/incidents`);
      if (!res.ok) throw new Error('Failed to fetch incidents');
      const data = await res.json();
      setIncidents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      return null;
    }
  }, []);

  const search = useCallback(async (query: string, limit = 5): Promise<SearchResult[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // New AI Agent query - conversational responses
  const agentQuery = useCallback(async (query: string, detailed = false, limit = 5): Promise<AgentResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/agent/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, detailed, limit }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Agent query failed');
      }
      const data = await res.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent query failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const ingestPdf = useCallback(async (filePath: string): Promise<IncidentReport | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/incidents/ingest-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Ingest failed');
      }
      const data = await res.json();
      await fetchStats();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingest failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  const ingestFolder = useCallback(async (folderPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/incidents/ingest-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });
      if (!res.ok) throw new Error('Ingest failed');
      const data = await res.json();
      await fetchStats();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingest failed');
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  return {
    incidents,
    stats,
    loading,
    error,
    fetchIncidents,
    fetchStats,
    search,
    agentQuery,
    ingestPdf,
    ingestFolder,
  };
}
