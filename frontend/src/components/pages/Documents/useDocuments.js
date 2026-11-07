import { useCallback, useEffect, useState } from 'react';
import { API } from '../../../config/api.js';
import { useRevalidateOnFocus } from '../../../hooks/useRevalidateOnFocus.js';

/** Dokumenty aktuální sezóny a archiv; status: loading | error | ready. */
export function useDocuments() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) setStatus('loading');
    return API.get('/documents')
      .then((result) => { setData(result); setStatus('ready'); })
      .catch(() => { if (!silent) setStatus('error'); });
  }, []);

  useEffect(() => { load(); }, [load]);
  // Obnova na pozadí: seznam, který už na obrazovce je, se jen potichu vymění.
  useRevalidateOnFocus(() => load({ silent: true }));

  return { current: data?.current ?? null, archive: data?.archive ?? [], status, reload: load };
}
