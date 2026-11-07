import { Alert, Button, Checkbox, Field, Input, PasswordInput } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import { useAdminRegister } from './useAdminRegister.js';
import styles from './AdminRegister.module.css';

/**
 * Nový správce: formulář pro založení účtu administrátora. Seznam účtů
 * z návrhu (AdminUcty) backend neumí, proto jen formulář.
 */
export default function AdminRegister() {
  const reg = useAdminRegister();
  const { formData, errors } = reg;

  return (
    <AdminPage
      title="Nový správce"
      actions={
        <Button size="sm" icon="arrow-left" onClick={reg.goBack}>
          Zpět
        </Button>
      }
    >
      <form
        className={styles.form}
        onSubmit={reg.handleSubmit}
        noValidate
        aria-label="Nový správce"
      >
        {reg.success && (
          <Alert
            type="success"
            compact
            autoDismissDelay={0}
            title="Administrátor byl úspěšně zaregistrován! Přesměrování…"
          />
        )}
        {errors.submit && (
          <Alert type="danger" compact title={errors.submit} onDismiss={reg.dismissSubmitError} />
        )}
        <Field label="Email" required error={errors.email}>
          <Input
            type="email"
            size="sm"
            autoComplete="off"
            value={formData.email}
            onChange={(e) => reg.setField('email', e.target.value)}
            placeholder="admin@example.com"
          />
        </Field>
        <Field label="Celé jméno" required error={errors.full_name}>
          <Input
            size="sm"
            value={formData.full_name}
            onChange={(e) => reg.setField('full_name', e.target.value)}
            placeholder="Jan Novák"
          />
        </Field>
        <Field label="Heslo" required error={errors.password} hint="Minimálně 6 znaků.">
          <PasswordInput
            size="sm"
            autoComplete="new-password"
            value={formData.password}
            onChange={(e) => reg.setField('password', e.target.value)}
          />
        </Field>
        <Field label="Potvrzení hesla" required error={errors.confirmPassword}>
          <PasswordInput
            size="sm"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={(e) => reg.setField('confirmPassword', e.target.value)}
          />
        </Field>
        <Checkbox
          label="Aktivní účet"
          checked={formData.is_active}
          onChange={(e) => reg.setField('is_active', e.target.checked)}
        />
        <Button type="submit" variant="primary" icon="user-plus" busy={reg.loading} block>
          {reg.loading ? 'Registruji…' : 'Registrovat administrátora'}
        </Button>
      </form>
    </AdminPage>
  );
}
