import { useState, useEffect, useCallback, useMemo } from 'react';

export const useRegistration = (raceId, onSuccess) => {
    // Formulářová data
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        year: '',
        sex: '', // 1 = muž, 2 = žena
        club: '',
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
        
        // Trigger search při změně relevantních polí
        if (['name', 'surname', 'club', 'slcr_id'].includes(field)) {
            const updatedData = { ...formData, [field]: value };
            searchRacers({
                name: updatedData.name,
                surname: updatedData.surname,
                club: updatedData.club,
                slcr_id: updatedData.slcr_id
            });
        }
    }, [formData, searchRacers]);

    // Výběr existujícího závodníka
    const selectExistingRacer = (racer) => {
        setFormData({
            name: racer.name,
            surname: racer.surname,
            year: racer.year,
            sex: racer.sex,
            club: racer.club_name || '',
            telefon: '', // Záměrně prázdné - nechceme automaticky vyplňovat
            email: '',   // Záměrně prázdné - nechceme automaticky vyplňovat
            slcr_id: racer.slcr_id || ''
        });
        setSelectedRacer(racer);
        setMsg(`Vybrán existující závodník: ${racer.name} ${racer.surname}`);
    };

    // Submit registration
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');

        // Validace povinných polí
        if (!formData.name.trim() || !formData.surname.trim() || !formData.year || !formData.club.trim()) {
            setMsg('Vyplňte všechna povinná pole (jméno, příjmení, rok, klub)');
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
            club_name: formData.club
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
                    club: '',
                    telefon: '',
                    email: '',
                    slcr_id: ''
                });
                setFilteredRacers([]);
                setSelectedRacer(null);
                
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
            club: '',
            telefon: '',
            email: '',
            slcr_id: ''
        });
        setFilteredRacers([]);
        setSelectedRacer(null);
        setMsg('');
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
        msg,
        isSearching,
        
        // Setters
        setMsg,
        
        // Functions
        updateField,
        selectExistingRacer,
        handleSubmit,
        resetForm,
        getSexLabel
    };
};