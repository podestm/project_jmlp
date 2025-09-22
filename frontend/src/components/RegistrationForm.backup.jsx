import React from 'react'
const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function RegistrationForm({ raceId, onSuccess }) {
  const [q, setQ] = React.useState('')
  const [racers, setRacers] = React.useState([])
  const [clubs, setClubs] = React.useState([])
  const [racerId, setRacerId] = React.useState('')
  const [clubName, setClubName] = React.useState('')
  const [msg, setMsg] = React.useState('')
  const [mode, setMode] = React.useState('existing') // 'existing' nebo 'new'
  
  // nový závodník form
  const [newRacer, setNewRacer] = React.useState({
    name: '',
    surname: '',
    sex: 1,
    year: new Date().getFullYear() - 10,
    telefon: '',
    slcr_id: ''
  })

  React.useEffect(() => {
    fetch(`${API}/clubs/`).then(r => r.json()).then(setClubs)
  }, [])

  React.useEffect(() => {
    if (!q) { setRacers([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`${API}/racers/?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(setRacers)
        .catch(() => {})
    }, 300)
    return () => { ctrl.abort(); clearTimeout(t) }
  }, [q])

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    
    const payload = {
      race_id: raceId,
      club_name: clubName
    }
    
    if (mode === 'new') {
      // nový závodník
      Object.assign(payload, {
        racer_name: newRacer.name,
        racer_surname: newRacer.surname,
        racer_sex: Number(newRacer.sex),
        racer_year: Number(newRacer.year),
        racer_telefon: newRacer.telefon || null,
        racer_slcr_id: newRacer.slcr_id || null
      })
    } else {
      // existující závodník
      payload.racer_id = Number(racerId)
    }
    
    const res = await fetch(`${API}/registrations/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      setMsg('Registrováno')
      setRacerId(''); setClubName(''); setQ('')
      setNewRacer({ name: '', surname: '', sex: 1, year: new Date().getFullYear() - 10, telefon: '', slcr_id: '' })
      setMode('existing')
      onSuccess?.()
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg(data.detail || 'Chyba při registraci')
    }
  }

  const canSubmit = clubName.trim() && (
    (mode === 'new' && newRacer.name.trim() && newRacer.surname.trim() && newRacer.year) ||
    (mode === 'existing' && racerId)
  )

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button 
          type="button" 
          onClick={() => setMode('existing')} 
          style={{ 
            padding: '8px 16px',
            background: mode === 'existing' ? '#007acc' : '#e0e0e0', 
            color: mode === 'existing' ? 'white' : 'black',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Existující závodník
        </button>
        <button 
          type="button" 
          onClick={() => setMode('new')} 
          style={{ 
            padding: '8px 16px',
            background: mode === 'new' ? '#007acc' : '#e0e0e0', 
            color: mode === 'new' ? 'white' : 'black',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Nový závodník
        </button>
      </div>

      {mode === 'existing' ? (
        <>
          <label>
            Vyhledat závodníka:
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="jméno/příjmení" />
          </label>

          {racers.length > 0 && (
            <label>
              Vyber závodníka:
              <select value={racerId} onChange={e => setRacerId(e.target.value)}>
                <option value="">-- vyber --</option>
                {racers.map(r => <option key={r.id} value={r.id}>{r.surname} {r.name} ({r.year})</option>)}
              </select>
            </label>
          )}
        </>
      ) : (
        <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 4 }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Údaje nového závodníka:</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input 
                placeholder="Jméno *" 
                value={newRacer.name} 
                onChange={e => setNewRacer({...newRacer, name: e.target.value})} 
                style={{ padding: 6 }}
              />
              <input 
                placeholder="Příjmení *" 
                value={newRacer.surname} 
                onChange={e => setNewRacer({...newRacer, surname: e.target.value})} 
                style={{ padding: 6 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select value={newRacer.sex} onChange={e => setNewRacer({...newRacer, sex: e.target.value})} style={{ padding: 6 }}>
                <option value={1}>Muž</option>
                <option value={2}>Žena</option>
              </select>
              <input 
                type="number" 
                placeholder="Rok narození *" 
                value={newRacer.year} 
                onChange={e => setNewRacer({...newRacer, year: e.target.value})} 
                style={{ padding: 6 }}
              />
            </div>
            <input 
              placeholder="Telefon" 
              value={newRacer.telefon} 
              onChange={e => setNewRacer({...newRacer, telefon: e.target.value})} 
              style={{ padding: 6 }}
            />
            <input 
              placeholder="SLČR ID" 
              value={newRacer.slcr_id} 
              onChange={e => setNewRacer({...newRacer, slcr_id: e.target.value})} 
              style={{ padding: 6 }}
            />
          </div>
        </div>
      )}

      <label>
        Klub:
        <input 
          list="clubs-list" 
          value={clubName} 
          onChange={e => setClubName(e.target.value)} 
          placeholder="Vyber existující nebo zadej nový klub"
        />
        <datalist id="clubs-list">
          {clubs.map(c => <option key={c.id} value={c.name} />)}
        </datalist>
      </label>

      <button 
        type="submit" 
        disabled={!canSubmit}
        style={{
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.6,
          marginTop: '16px'
        }}
      >
        {mode === 'existing' ? 'Přihlásit závodníka' : 'Vytvořit a přihlásit závodníka'}
      </button>
      {msg && <div>{msg}</div>}
    </form>
  )
}
