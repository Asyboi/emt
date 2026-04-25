import { useEffect, useState } from 'react';
import type { IncidentReport, IncidentSummary } from '../types';
import { getDataSource } from './source';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useIncidentList(): AsyncState<IncidentSummary[]> {
  const [state, setState] = useState<AsyncState<IncidentSummary[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    getDataSource()
      .listIncidents()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useIncident(id: string | undefined): AsyncState<IncidentReport> {
  const [state, setState] = useState<AsyncState<IncidentReport>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: new Error('No incident id') });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    getDataSource()
      .getIncident(id)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
