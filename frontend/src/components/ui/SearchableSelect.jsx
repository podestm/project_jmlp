import React, { useState, useRef, useEffect } from 'react';

/**
 * Searchable Select - dropdown s live vyhledáváním
 */
export default function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Vyberte...', 
  allLabel = 'Vše',
  valueKey = 'value',
  labelKey = 'label'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Zavření dropdown při kliknutí mimo
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrované options podle searchTerm
  const filteredOptions = options.filter(option => {
    const label = typeof option === 'string' ? option : option[labelKey];
    return label.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Získání aktuálního labelu pro zobrazení
  const getCurrentLabel = () => {
    if (!value) return '';
    const selected = options.find(opt => {
      const optValue = typeof opt === 'string' ? opt : opt[valueKey];
      return optValue === value || String(optValue) === String(value);
    });
    if (selected) {
      return typeof selected === 'string' ? selected : selected[labelKey];
    }
    return value;
  };

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div 
        className="form-control d-flex align-items-center justify-content-between"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          minHeight: '38px'
        }}
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={value ? getCurrentLabel() : placeholder}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              width: '100%'
            }}
            autoFocus
          />
        ) : (
          <span style={{ color: value ? 'var(--text-primary)' : 'rgba(255,255,255,0.5)' }}>
            {value ? getCurrentLabel() : placeholder}
          </span>
        )}
        <div className="d-flex align-items-center gap-1">
          {value && (
            <i 
              className="bi bi-x-circle" 
              onClick={handleClear}
              style={{ 
                cursor: 'pointer', 
                opacity: 0.7,
                fontSize: '0.9rem'
              }}
            />
          )}
          <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} style={{ opacity: 0.7 }} />
        </div>
      </div>

      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1050,
            maxHeight: '250px',
            overflowY: 'auto',
            marginTop: '2px'
          }}
        >
          {/* Možnost "Vše" */}
          <div
            onClick={() => handleSelect('')}
            style={{
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              background: !value ? '#e9ecef' : '#fff',
              color: '#212529',
              borderBottom: '1px solid #eee'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
            onMouseLeave={(e) => e.target.style.background = !value ? '#e9ecef' : '#fff'}
          >
            {allLabel}
          </div>

          {filteredOptions.length === 0 ? (
            <div style={{ padding: '0.5rem 0.75rem', color: '#6c757d', fontStyle: 'italic' }}>
              Žádné výsledky
            </div>
          ) : (
            filteredOptions.map((option, index) => {
              const optValue = typeof option === 'string' ? option : option[valueKey];
              const optLabel = typeof option === 'string' ? option : option[labelKey];
              const isSelected = optValue === value || String(optValue) === String(value);

              return (
                <div
                  key={index}
                  onClick={() => handleSelect(optValue)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    background: isSelected ? '#e9ecef' : '#fff',
                    color: '#212529',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                  onMouseLeave={(e) => e.target.style.background = isSelected ? '#e9ecef' : '#fff'}
                >
                  {optLabel}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
