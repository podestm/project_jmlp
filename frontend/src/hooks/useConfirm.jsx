import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ms/ConfirmDialog/ConfirmDialog.jsx';

/**
 * Promise-based replacement for window.confirm / window.prompt.
 *
 *   const { confirm, confirmElement } = useConfirm();
 *   if (!await confirm({ title: 'Smazat závodníka?', confirmLabel: 'Smazat', danger: true })) return;
 *
 * Multi-way choices replace a free-text prompt:
 *
 *   const choice = await confirm({ title: '…', choices: [
 *     { value: 'keep',  label: 'Soubory ponechat' },
 *     { value: 'purge', label: 'Smazat i soubory', danger: true },
 *   ]});   // null when cancelled
 *
 * Hooks with no JSX of their own (usePostManagement, useRaceManagement) cannot
 * render `confirmElement`; the component that owns them passes `confirm` down.
 */
export const useConfirm = () => {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(({
    title,
    message = null,
    confirmLabel = 'Potvrdit',
    cancelLabel = 'Zrušit',
    danger = false,
    icon,
    choices
  }) => new Promise((resolve) => {
    resolveRef.current = resolve;
    setRequest({
      title,
      message,
      cancelLabel,
      choices: choices || [{ value: true, label: confirmLabel, danger, icon }]
    });
  }), []);

  const handleResolve = useCallback((value) => {
    setRequest(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    if (resolve) resolve(value);
  }, []);

  // A pending promise would leak if the user navigated away mid-dialog.
  useEffect(() => () => {
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
  }, []);

  const confirmElement = request
    ? <ConfirmDialog {...request} onResolve={handleResolve} />
    : null;

  return { confirm, confirmElement };
};

export default useConfirm;
