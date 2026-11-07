// Validace formuláře nového správce – bez Reactu, s testem.

export const EMPTY_REGISTER_FORM = {
  email: '',
  password: '',
  confirmPassword: '',
  full_name: '',
  is_active: true,
};

/** Chyby formuláře podle pole ({} = v pořádku). */
export const validateRegisterForm = (formData) => {
  const errors = {};
  if (!formData.email) errors.email = 'Email je povinný';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
    errors.email = 'Neplatný formát emailu';

  if (!formData.password) errors.password = 'Heslo je povinné';
  else if (formData.password.length < 6) errors.password = 'Heslo musí mít alespoň 6 znaků';

  if (!formData.confirmPassword) errors.confirmPassword = 'Potvrzení hesla je povinné';
  else if (formData.password !== formData.confirmPassword)
    errors.confirmPassword = 'Hesla se neshodují';

  if (!formData.full_name.trim()) errors.full_name = 'Jméno je povinné';
  return errors;
};
