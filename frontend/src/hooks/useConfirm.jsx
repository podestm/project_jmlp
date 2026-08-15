import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

const DEFAULT_CHOICES = [{ value: true, label: 'Potvrdit', variant: 'primary' }];

/**
 * Promise-based replacement for window.confirm / window.prompt.
 *
 *   const { confirm, confirmElement } = useConfirm();
 *   if (!await confirm({ title: 'Smazat závodníka?', confirmLabel: 'Smazat', variant: 'danger' })) return;
 *
 * Multi-way choices replace a free-text prompt:
 *
 *   const choice = await confirm({ title: '…', choices: [
 *     { value: 'keep',  label: 'Soubory ponechat', variant: 'outline-primary' },
 *     { value: 'purge', label: 'Smazat i soubory', variant: 'danger' },
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
    variant = 'primary',
    icon,
    choices
  }) => new Promise((resolve) => {
    resolveRef.current = resolve;
    setRequest({
      title,
      message,
      cancelLabel,
      choices: choices || [{ ...DEFAULT_CHOICES[0], label: confirmLabel, variant, icon }]
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
