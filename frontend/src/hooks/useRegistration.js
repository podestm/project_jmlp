import { useState, useEffect, useCallback, useMemo } from 'react';

export const useRegistration = (raceId, onSuccess) => {
    // Formulářová data
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        year: '',
        sex: '', // 1 = muž, 2 = žena
        clubId: null,
        clubNoteMode: false,
        clubNote: '',
        telefon: '',
        email: '',
        slcr_id: ''
    });

    // Seznam vyfiltrovaných závodníků
    const [filteredRacers, setFilteredRacers] = useState([]);

    // Vybraný závodník ze seznamu (pokud nějaký)
    const [selectedRacer, setSelectedRacer] = useState(null);

    // Klub seznam pro autocomplete
    const [clubs, setClubs] = useState([]);

    // UI state
    const [msg, setMsg] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({ name: '', surname: '', year: '', club: '' });
    const [clubNoteMode, setClubNoteMode] = useState(false);

    // Načtení klubů
    useEffect(() => {
        fetch('/clubs/').then(r => r.json()).then(setClubs);
    }, []);

    // Debounced search funkce
    const searchRacers = useCallback(
        useMemo(() => {
            let timeoutId;
            return (searchParams) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(async () => {
                    if (!searchParams.name && !searchParams.surname && !searchParams.club && !searchParams.slcr_id) {
                        setFilteredRacers([]);
                        return;
                    }
                    
                    setIsSearching(true);
                    try {
                        const params = new URLSearchParams();
                        if (searchParams.name) params.append('name', searchParams.name);
                        if (searchParams.surname) params.append('surname', searchParams.surname);
                        if (searchParams.club) params.append('club', searchParams.club);
                        if (searchParams.slcr_id) params.append('slcr_id', searchParams.slcr_id);
                        
                        const response = await fetch(`/racers/search?${params}`);
                        const data = await response.json();
                        setFilteredRacers(data);
                    } catch (error) {
                        console.error('Search error:', error);
                        setFilteredRacers([]);
                    } finally {
                        setIsSearching(false);
                    }
                }, 300);
            };
        }, [])
    );

    // Aktualizace pole formuláře
    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setSelectedRacer(null);
        setMsg('');
        if (['name', 'surname', 'year', 'club', 'clubId', 'clubNote'].includes(field)) {
            setFieldErrors(prev => ({ ...prev, [field === 'clubId' || field === 'clubNote' ? 'club' : field]: '' }));
        }

        // Trigger search při změně relevantních polí
        if (['name', 'surname', 'slcr_id'].includes(field)) {
            const updatedData = { ...formData, [field]: value };
            searchRacers({
                name: updatedData.name,
                surname: updatedData.surname,
                slcr_id: updatedData.slcr_id
            });
        }
    }, [formData, searchRacers]);

    // Výběr existujícího závodníka
    const selectExistingRacer = (racer) => {
        // Pokud závodník má klub, předvyplníme ho
        const existingClubId = racer.club_id || null;
        setFormData({
            name: racer.name,
            surname: racer.surname,
            year: racer.year,
            sex: racer.sex,
            clubId: existingClubId,
            clubNoteMode: false,
            clubNote: '',
            telefon: '', // Záměrně prázdné - nechceme automaticky vyplňovat
            email: '',   // Záměrně prázdné - nechceme automaticky vyplňovat
            slcr_id: racer.slcr_id || ''
        });
        setClubNoteMode(false);
        setSelectedRacer(racer);
        setMsg(`Vybrán existující závodník: ${racer.name} ${racer.surname}`);
        setFieldErrors({ name: '', surname: '', year: '', club: '' });
    };

    // Submit registration
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');

        // Validace povinných polí
        const errors = {};
        if (!formData.name.trim()) errors.name = 'Jméno je povinné';
        if (!formData.surname.trim()) errors.surname = 'Příjmení je povinné';
        if (!formData.year) errors.year = 'Rok narození je povinný';
        if (!formData.clubId && !(formData.clubNote && formData.clubNote.trim())) {
            errors.club = 'Vyberte klub nebo zadejte poznámku';
        } else if (!formData.clubId && formData.clubNote) {
            const note = formData.clubNote.trim();
            if (note.length > 100) {
                errors.club = 'Název klubu může mít nejvýše 100 znaků';
            } else if (!/^[a-zA-Z0-9\u00C0-\u017E\s\-\.]+$/.test(note)) {
                errors.club = 'Název klubu smí obsahovat pouze písmena (včetně háčků), číslice, mezery, pomlčky a tečky';
            }
        }
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        // Detekce existujícího závodníka - hledáme v celé databázi
        let exactMatch = null;
        try {
            const params = new URLSearchParams();
            params.append('name', formData.name.trim());
            params.append('surname', formData.surname.trim());
            
            const response = await fetch(`/racers/search?${params}`);
            const allMatches = await response.json();
            
            exactMatch = allMatches.find(r => 
                r.name.toLowerCase() === formData.name.trim().toLowerCase() &&
                r.surname.toLowerCase() === formData.surname.trim().toLowerCase() &&
                r.year === parseInt(formData.year, 10)
            );
        } catch (error) {
            console.error('Error checking for existing racer:', error);
        }

        const payload = {
            race_id: raceId,
            club_id: formData.clubId || null,
            club_request_note: (!formData.clubId && formData.clubNote && formData.clubNote.trim())
                ? formData.clubNote.trim()
                : null
        };

        if (exactMatch) {
            // Použít existujícího závodníka ale aktualizovat telefon, email a SLCR ID pouze pokud jsou vyplněné
            payload.racer_id = exactMatch.id;
            if (formData.telefon.trim()) {
                payload.racer_telefon = formData.telefon.trim();
            }
            if (formData.email.trim()) {
                payload.racer_email = formData.email.trim();
            }
            if (formData.slcr_id.trim()) {
                payload.racer_slcr_id = formData.slcr_id.trim();
            }
        } else {
            // Vytvořit nového závodníka
            payload.racer_name = formData.name.trim();
            payload.racer_surname = formData.surname.trim();
            payload.racer_year = formData.year;
            payload.racer_sex = formData.sex;
            payload.racer_telefon = formData.telefon.trim();
            payload.racer_email = formData.email.trim();
            payload.racer_slcr_id = formData.slcr_id.trim();
        }

        try {
            const response = await fetch(`/races/${raceId}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                setMsg(`✅ Registrace úspěšná! ${result.message || ''}`);

                // Reset formuláře
                setFormData({
                    name: '',
                    surname: '',
                    year: new Date().getFullYear() - 10,
                    sex: 1,
                    clubId: null,
                    clubNoteMode: false,
                    clubNote: '',
                    telefon: '',
                    email: '',
                    slcr_id: ''
                });
                setClubNoteMode(false);
                setFilteredRacers([]);
                setSelectedRacer(null);
                setFieldErrors({ name: '', surname: '', year: '', club: '' });
                
                if (onSuccess) onSuccess(result);
            } else {
                const error = await response.json();
                setMsg(`❌ Chyba: ${error.detail || 'Registrace se nezdařila'}`);
            }
        } catch (error) {
            console.error('Registration error:', error);
            setMsg('❌ Chyba spojení se serverem');
        }
    };

    // Reset formuláře
    const resetForm = () => {
        setFormData({
            name: '',
            surname: '',
            year: new Date().getFullYear() - 10,
            sex: 1,
            clubId: null,
            clubNoteMode: false,
            clubNote: '',
            telefon: '',
            email: '',
            slcr_id: ''
        });
        setClubNoteMode(false);
        setFilteredRacers([]);
        setSelectedRacer(null);
        setMsg('');
        setFieldErrors({ name: '', surname: '', year: '', club: '' });
    };

    // Utility funkce
    const getSexLabel = (sex) => {
        return sex === 1 ? 'Muž' : 'Žena';
    };

    return {
        // State
        formData,
        filteredRacers,
        selectedRacer,
        clubs,
        clubNoteMode,
        msg,
        isSearching,
        fieldErrors,

        // Setters
        setMsg,
        setClubNoteMode,

        // Functions
        updateField,
        selectExistingRacer,
        handleSubmit,
        resetForm,
        getSexLabel
    };
};