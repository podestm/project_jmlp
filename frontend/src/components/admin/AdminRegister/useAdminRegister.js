import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAPI } from '../../../config/api.js';
import { EMPTY_REGISTER_FORM, validateRegisterForm } from './register.js';

/** Stav a odeslání formuláře nového správce; po úspěchu zpět na přehled. */
export function useAdminRegister() {
  const [formData, setFormData] = useState(EMPTY_REGISTER_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Chyba pole zmizí, jakmile ho uživatel opravuje.
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateRegisterForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      await AdminAPI.post('/api/admin/auth/register', {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        is_active: formData.is_active,
      });
      setSuccess(true);
      setFormData(EMPTY_REGISTER_FORM);
      setTimeout(() => navigate('/admin'), 2000);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    errors,
    loading,
    success,
    setField,
    handleSubmit,
    dismissSubmitError: () => setErrors((prev) => ({ ...prev, submit: '' })),
    goBack: () => navigate('/admin'),
  };
}
