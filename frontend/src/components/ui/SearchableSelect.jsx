import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Searchable Select - dropdown s live vyhledáváním
 * Používá Portal pro vykreslení dropdown mimo parent kontejner
 *
 * Props:
 *   inline  — true: search input je vždy viditelný (lepší UX pro formuláře)
 *             false (default): klikni → otevře dropdown se search uvnitř
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Vyberte...',
  allLabel = 'Vše',
  valueKey = 'value',
  labelKey = 'label',
  inline = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Zavření dropdown při kliknutí mimo
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        const dropdown = document.getElementById('searchable-select-dropdown');
        if (dropdown && dropdown.contains(event.target)) {
          return;
        }
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Aktualizace pozice dropdown při otevření
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

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

  const handleSelect = (e, optionValue) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
    if (inline) inputRef.current?.focus();
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
    setSearchTerm('');
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // ── Inline mode handlers ────────────────────────────────────────────────
  const handleInlineFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleInlineChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
      inputRef.current?.blur();
    }
  };

  // Dropdown list (sdílený pro oba režimy, ale bez search pole v inline režimu)
  const dropdownContent = isOpen && createPortal(
    <div
      id="searchable-select-dropdown"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: '0.375rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        zIndex: 9999,
        maxHeight: '280px',
        overflowY: 'auto'
      }}
    >
      {/* Vyhledávací pole — pouze v klasickém (non-inline) režimu */}
      {!inline && (
        <div style={{
          padding: '0.5rem',
          borderBottom: '1px solid #eee',
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 1
        }}>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hledat..."
            className="form-control form-control-sm"
            style={{ background: '#f8f9fa', border: '1px solid #dee2e6' }}
            autoFocus
          />
        </div>
      )}

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
              onClick={(e) => handleSelect(e, optValue)}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                background: isSelected ? '#e9ecef' : '#fff',
                color: '#212529',
                borderBottom: index < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f0f4ff'}
              onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#e9ecef' : '#fff'}
            >
              {optLabel}
            </div>
          );
        })
      )}
    </div>,
    document.body
  );

  // ── Inline render ────────────────────────────────────────────────────────
  if (inline) {
    const selectedLabel = getCurrentLabel();
    return (
      <div ref={containerRef} style={{ position: 'relative' }}>
        <div className="d-flex align-items-center" style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            className="form-control registration-input"
            placeholder={placeholder}
            value={isOpen ? searchTerm : selectedLabel}
            onFocus={handleInlineFocus}
            onChange={handleInlineChange}
            onKeyDown={handleInlineKeyDown}
            autoComplete="off"
            style={{
              background: selectedLabel ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.2)',
              color: selectedLabel ? 'var(--text-primary)' : undefined,
              border: selectedLabel
                ? '1px solid rgba(255, 107, 0, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              paddingRight: '2.2rem',
              height: '44px',
              fontSize: '1rem',
            }}
          />
          <div style={{ position: 'absolute', right: '0.6rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {value ? (
              <i
                className="bi bi-x-circle"
                onClick={handleClear}
                style={{ cursor: 'pointer', opacity: 0.6, fontSize: '1rem', color: 'var(--text-primary)' }}
              />
            ) : (
              <i className="bi bi-search" style={{ opacity: 0.4, fontSize: '0.9rem', color: 'var(--text-primary)' }} />
            )}
          </div>
        </div>
        {dropdownContent}
      </div>
    );
  }

  // ── Klasický (non-inline) render ─────────────────────────────────────────
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
        onClick={handleToggle}
      >
        <span style={{ color: value ? 'var(--text-primary)' : 'rgba(255,255,255,0.5)' }}>
          {value ? getCurrentLabel() : placeholder}
        </span>
        <div className="d-flex align-items-center gap-1">
          {value && (
            <i
              className="bi bi-x-circle"
              onClick={handleClear}
              style={{ cursor: 'pointer', opacity: 0.7, fontSize: '0.9rem' }}
            />
          )}
          <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} style={{ opacity: 0.7 }} />
        </div>
      </div>
      {dropdownContent}
    </div>
  );
}
