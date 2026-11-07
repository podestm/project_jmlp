import { describe, expect, it } from 'vitest';
import { EMPTY_REGISTER_FORM, validateRegisterForm } from './register.js';

describe('nový správce – validace', () => {
  it('prázdný formulář hlásí všechna povinná pole', () => {
    expect(Object.keys(validateRegisterForm(EMPTY_REGISTER_FORM))).toEqual([
      'email',
      'password',
      'confirmPassword',
      'full_name',
    ]);
  });

  it('neshodná hesla a krátké heslo', () => {
    const errors = validateRegisterForm({
      email: 'a@b.cz',
      password: '123',
      confirmPassword: '124',
      full_name: 'Jan',
    });
    expect(errors).toEqual({
      password: 'Heslo musí mít alespoň 6 znaků',
      confirmPassword: 'Hesla se neshodují',
    });
  });
});
