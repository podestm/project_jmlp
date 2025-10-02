import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../config/auth.jsx';
import { API } from '../../config/api.js';

export default function AdminRegister() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    is_active: true
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email je povinný';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Neplatný formát emailu';
    }
    
    if (!formData.password) {
      newErrors.password = 'Heslo je povinné';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Heslo musí mít alespoň 6 znaků';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Potvrzení hesla je povinné';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Hesla se neshodují';
    }
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Jméno je povinné';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      const response = await API.post('/admin/register', {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        is_active: formData.is_active
      }, {
        'Authorization': `Bearer ${token}`,
      });

      setSuccess(true);
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        is_active: true
      });
      
      // Redirect after successful registration
      setTimeout(() => {
        navigate('/admin');
      }, 2000);
      
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Registrace nového administrátora</h2>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/admin')}
            >
              Zpět
            </button>
          </div>

          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  {success && (
                    <div className="alert alert-success" role="alert">
                      Administrátor byl úspěšně zaregistrován! Přesměrování...
                    </div>
                  )}

                  {errors.submit && (
                    <div className="alert alert-danger" role="alert">
                      {errors.submit}
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="admin@example.com"
                      />
                      {errors.email && (
                        <div className="invalid-feedback">{errors.email}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label htmlFor="full_name" className="form-label">
                        Celé jméno <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-control ${errors.full_name ? 'is-invalid' : ''}`}
                        id="full_name"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        placeholder="Jan Novák"
                      />
                      {errors.full_name && (
                        <div className="invalid-feedback">{errors.full_name}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label htmlFor="password" className="form-label">
                        Heslo <span className="text-danger">*</span>
                      </label>
                      <input
                        type="password"
                        className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Minimálně 6 znaků"
                      />
                      {errors.password && (
                        <div className="invalid-feedback">{errors.password}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label htmlFor="confirmPassword" className="form-label">
                        Potvrzení hesla <span className="text-danger">*</span>
                      </label>
                      <input
                        type="password"
                        className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Zadejte heslo znovu"
                      />
                      {errors.confirmPassword && (
                        <div className="invalid-feedback">{errors.confirmPassword}</div>
                      )}
                    </div>

                    <div className="mb-4">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="is_active"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleChange}
                        />
                        <label className="form-check-label" htmlFor="is_active">
                          Aktivní účet
                        </label>
                      </div>
                      <small className="form-text text-muted">
                        Neaktivní administrátoři se nemohou přihlásit
                      </small>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary w-100"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Registruji...
                        </>
                      ) : (
                        'Registrovat administrátora'
                      )}
                    </button>
                  </form>

                  <div className="mt-3 text-center">
                    <small className="text-muted">
                      * Povinná pole
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}