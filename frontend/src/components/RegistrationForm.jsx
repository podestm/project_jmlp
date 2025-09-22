import React from 'react'
const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function RegistrationForm({ raceId, onSuccess }) {
  // Formulářová data
  const [formData, setFormData] = React.useState({
    name: '',
    surname: '',
    year: new Date().getFullYear() - 10,
    sex: 1, // 1 = muž, 2 = žena
    club: '',
    telefon: '',
    email: '',
    slcr_id: ''
  })
  
  // Seznam vyfiltrovaných závodníků
  const [filteredRacers, setFilteredRacers] = React.useState([])
  
  // Vybraný závodník ze seznamu (pokud nějaký)
  const [selectedRacer, setSelectedRacer] = React.useState(null)
  
  // Klub seznam pro autocomplete
  const [clubs, setClubs] = React.useState([])
  
  // UI state
  const [msg, setMsg] = React.useState('')
  const [isSearching, setIsSearching] = React.useState(false)

  // Načtení klubů
  React.useEffect(() => {
    fetch(`${API}/clubs/`).then(r => r.json()).then(setClubs)
  }, [])

  // Debounced search funkce
  const searchRacers = React.useCallback(
    React.useMemo(() => {
      let timeoutId
      return (searchParams) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(async () => {
          if (!searchParams.name && !searchParams.surname && !searchParams.club && !searchParams.slcr_id) {
            setFilteredRacers([])
            return
          }
          
          setIsSearching(true)
          try {
            const params = new URLSearchParams()
            if (searchParams.name) params.append('name', searchParams.name)
            if (searchParams.surname) params.append('surname', searchParams.surname)
            if (searchParams.club) params.append('club', searchParams.club)
            if (searchParams.slcr_id) params.append('slcr_id', searchParams.slcr_id)
            
            const response = await fetch(`${API}/racers/search?${params}`)
            const results = await response.json()
            setFilteredRacers(results)
          } catch (error) {
            console.error('Search error:', error)
            setFilteredRacers([])
          } finally {
            setIsSearching(false)
          }
        }, 300)
      }
    }, []),
    []
  )

  // Trigger search při změně formuláře
  React.useEffect(() => {
    const searchParams = {
      name: formData.name.trim(),
      surname: formData.surname.trim(),
      club: formData.club.trim(),
      slcr_id: formData.slcr_id.trim()
    }
    searchRacers(searchParams)
  }, [formData.name, formData.surname, formData.club, formData.slcr_id, searchRacers])

  // Update formData
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSelectedRacer(null) // Clear selection when manually editing
    setMsg('')
  }

  // Kliknutí na závodníka ze seznamu
  const selectRacer = (racer) => {
    setFormData({
      name: racer.name,
      surname: racer.surname,
      year: racer.year,
      sex: racer.sex || 1, // Default muž pokud není zadáno
      club: racer.club_name || '',
      telefon: '', // Nepředvyplňovat telefon
      email: '', // Nepředvyplňovat email
      slcr_id: racer.slcr_id || ''
    })
    setSelectedRacer(racer)
    setMsg(`Vybrán existující závodník: ${racer.name} ${racer.surname}`)
  }

  // Submit registration
  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg('')

    // Validace povinných polí
    if (!formData.name.trim() || !formData.surname.trim() || !formData.year || !formData.club.trim()) {
      setMsg('Vyplňte všechna povinná pole (jméno, příjmení, rok, klub)')
      return
    }

    // Detekce existujícího závodníka - hledáme v celé databázi
    let exactMatch = null
    try {
      const params = new URLSearchParams()
      params.append('name', formData.name.trim())
      params.append('surname', formData.surname.trim())
      
      const response = await fetch(`${API}/racers/search?${params}`)
      const allMatches = await response.json()
      
      exactMatch = allMatches.find(r => 
        r.name.toLowerCase() === formData.name.trim().toLowerCase() &&
        r.surname.toLowerCase() === formData.surname.trim().toLowerCase() &&
        r.year === formData.year
      )
    } catch (error) {
      console.error('Error checking for existing racer:', error)
    }

    const payload = {
      race_id: raceId,
      club_name: formData.club
    }

    if (exactMatch) {
      // Použít existujícího závodníka ale aktualizovat telefon, email a SLCR ID pouze pokud jsou vyplněné
      payload.racer_id = exactMatch.id
      if (formData.telefon.trim()) {
        payload.racer_telefon = formData.telefon.trim()
      }
      if (formData.email.trim()) {
        payload.racer_email = formData.email.trim()
      }
      if (formData.slcr_id.trim()) {
        payload.racer_slcr_id = formData.slcr_id.trim()
      }
      setMsg(`Používám existujícího závodníka: ${exactMatch.name} ${exactMatch.surname}`)
    } else {
      // Vytvořit nového závodníka
      payload.racer_name = formData.name.trim()
      payload.racer_surname = formData.surname.trim()
      payload.racer_sex = formData.sex
      payload.racer_year = Number(formData.year)
      payload.racer_telefon = formData.telefon.trim()
      payload.racer_email = formData.email.trim()
      payload.racer_slcr_id = formData.slcr_id.trim()
    }

    try {
      const res = await fetch(`${API}/registrations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setMsg('Registrováno úspěšně!')
        setFormData({
          name: '',
          surname: '',
          year: new Date().getFullYear() - 10,
          sex: 1, // 1 = muž, 2 = žena
          club: '',
          telefon: '',
          email: '',
          slcr_id: ''
        })
        setSelectedRacer(null)
        setFilteredRacers([])
        onSuccess?.()
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg(data.detail || 'Chyba při registraci')
      }
    } catch (error) {
      setMsg('Chyba při registraci')
    }
  }

  const canSubmit = formData.name.trim() && formData.surname.trim() && formData.year && formData.club.trim()

  return (
    <div style={{ display: 'flex', gap: '1.5rem', minHeight: '500px' }}>
      {/* Formulář */}
      <div style={{ flex: '1 1 60%', minWidth: '300px' }}>
        <form onSubmit={handleSubmit}>
          {/* Základní údaje */}
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label">
                <span className="bi bi-person"></span>
                Jméno <span className="text-danger">*</span>
              </label>
              <input 
                type="text"
                className="form-control" 
                placeholder="Zadejte jméno" 
                value={formData.name} 
                onChange={e => updateField('name', e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">
                <span className="bi bi-person"></span>
                Příjmení <span className="text-danger">*</span>
              </label>
              <input 
                type="text"
                className="form-control" 
                placeholder="Zadejte příjmení" 
                value={formData.surname} 
                onChange={e => updateField('surname', e.target.value)}
              />
            </div>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <label className="form-label">
                <span className="bi bi-calendar3"></span>
                Rok narození <span className="text-danger">*</span>
              </label>
              <input 
                type="number" 
                className="form-control"
                placeholder="YYYY" 
                value={formData.year} 
                onChange={e => updateField('year', Number(e.target.value))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">
                <span className="bi bi-gender-ambiguous"></span>
                Pohlaví <span className="text-danger">*</span>
              </label>
              <select 
                className="form-select"
                value={formData.sex} 
                onChange={e => updateField('sex', Number(e.target.value))}
              >
                <option value={1}>Muž</option>
                <option value={2}>Žena</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                <span className="bi bi-telephone"></span>
                Telefon
              </label>
              <input 
                type="tel"
                className="form-control"
                placeholder="Volitelné" 
                value={formData.telefon} 
                onChange={e => updateField('telefon', e.target.value)}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">
              <span className="bi bi-envelope"></span>
              E-mail
            </label>
            <input 
              type="email"
              className="form-control"
              placeholder="Volitelné" 
              value={formData.email} 
              onChange={e => updateField('email', e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">
              <span className="bi bi-building"></span>
              Klub <span className="text-danger">*</span>
            </label>
            <input 
              type="text"
              className="form-control"
              placeholder="Začněte psát název klubu" 
              value={formData.club} 
              onChange={e => updateField('club', e.target.value)}
              list="clubs-list"
            />
            <datalist id="clubs-list">
              {clubs.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>

          <div className="mb-3">
            <label className="form-label">
              <span className="bi bi-card-text"></span>
              SLČR ID
            </label>
            <input 
              type="text"
              className="form-control"
              placeholder="Volitelné" 
              value={formData.slcr_id} 
              onChange={e => updateField('slcr_id', e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={!canSubmit}
            className={`btn ${canSubmit ? 'btn-primary' : 'btn-secondary'} w-100`}
          >
            <span className="bi bi-person-plus"></span>
            Registrovat závodníka
          </button>

          {msg && (
            <div className={`alert mt-3 ${msg.includes('Chyba') ? 'alert-danger' : 'alert-success'}`} role="alert">
              <span className={`bi ${msg.includes('Chyba') ? 'bi-exclamation-triangle' : 'bi-check-circle'}`}></span>
              {msg}
            </div>
          )}
        </form>
      </div>

      {/* Seznam závodníků */}
      <div style={{ flex: '1 1 40%', minWidth: '250px' }}>
        <div className="card">
          <div className="card-header">
            <h6 className="card-title mb-0">
              <span className="bi bi-search"></span>
              Nalezení závodníci
            </h6>
          </div>
          <div className="card-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {isSearching && (
              <div className="text-center text-muted">
                <div className="spinner-border spinner-border-sm me-2" role="status">
                  <span className="visually-hidden">Hledám...</span>
                </div>
                Hledám...
              </div>
            )}
            
            {!isSearching && filteredRacers.length === 0 && (
              <div className="text-center text-muted">
                <span className="bi bi-search" style={{ fontSize: '3rem' }}></span>
                <p className="mt-2 small">Začněte psát do polí formuláře pro vyhledání závodníků</p>
              </div>
            )}
            
            {filteredRacers.map(racer => (
              <div 
                key={racer.id}
                onClick={() => selectRacer(racer)}
                className={`racer-card ${selectedRacer?.id === racer.id ? 'selected' : ''}`}
              >
                <div className="fw-bold">
                  <span className="bi bi-person"></span>
                  {racer.name} {racer.surname} ({racer.year})
                </div>
                <div className="small text-muted">
                  <span className="bi bi-building"></span>
                  {racer.club_name || 'Bez klubu'}
                </div>
                {racer.slcr_id && (
                  <div className="small text-muted">
                    <span className="bi bi-card-text"></span>
                    SLČR: {racer.slcr_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}