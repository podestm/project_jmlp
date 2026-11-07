import { useEffect, useId, useRef, useState } from 'react';
import { useTimekeeperAuth } from '../../../../config/timekeeperAuth.jsx';
import { useOnline } from '../../../../hooks/useOnline.js';
import { Alert, Button, Field, Input, Modal, PasswordInput } from '../../../ms/index.js';
import styles from './TimekeeperReauthModal.module.css';

const knownEmail = (user) => (user?.email && user.email !== 'offline' ? user.email : '');

/**
 * Přihlášení v okně na místě, když přihlášení vypršelo (401).
 *
 * Časomíra se kvůli vypršelému přihlášení nikdy neodhlašuje ani nepřesměrovává:
 * obrazovka, rozepsané časy, sériový port i offline fronta zůstávají. Po
 * přihlášení fronta pokračuje sama (timekeeperAuth.jsx). Offline se okno
 * neukazuje – přihlásit se bez sítě nejde a měřit se dá dál. Zavřít ho nejde,
 * jedinou cestou je přihlásit se.
 */
export default function TimekeeperReauthModal() {
  const { reauthRequired, user, login } = useTimekeeperAuth();
  const online = useOnline();
  const [email, setEmail] = useState(knownEmail(user));
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef(null);
  const formId = useId();

  useEffect(() => {
    if (!email && knownEmail(user)) setEmail(knownEmail(user));
  }, [user, email]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await login(email.trim(), password);
    setBusy(false);
    if (result.success) {
      setPassword('');
    } else {
      setError(result.error || 'Přihlášení se nezdařilo');
    }
  };

  return (
    <Modal
      open={Boolean(reauthRequired && online)}
      onClose={() => {}}
      dismissible={false}
      size="sm"
      eyebrow="Časomíra"
      title="Přihlášení vypršelo"
      initialFocusRef={passwordRef}
      footer={
        <Button type="submit" form={formId} variant="primary" icon="login" busy={busy}>
          Přihlásit a pokračovat
        </Button>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        <p className={styles.lead}>Nic se neztratilo, data zůstávají v zařízení.</p>
        {error && <Alert type="danger" compact title={error} />}
        <Field label="E-mail" id="tk-reauth-email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Heslo" id="tk-reauth-password">
          <PasswordInput
            ref={passwordRef}
            size="md"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
