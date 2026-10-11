import { useState, useEffect, useRef } from 'react';
import { AdminAPI, adminAuthHeaders } from '../config/api.js';
import { getCurrentSeasonId, getSeasonIdForRace, formatSeason, generateRaceNumber } from '../utils/season.js';
import { useRevalidateOnFocus } from './useRevalidateOnFocus.js';
import { deleteRaceConfirm } from '../components/admin/Races/dialogs/deleteRaceConfirm.jsx';

/**
 * @param {{confirm?: Function}} [options] - confirm z useConfirm komponenty,
 *   která hook používá (hook sám dialog vykreslit nemůže)
 */
export const useRaceManagement = ({ confirm } = {}) => {
    // Refs for debouncing
    const arealSearchTimeoutRef = useRef(null);
    const organizerSearchTimeoutRef = useRef(null);
    
    // State management
    const [races, setRaces] = useState([]);
    const [filteredRaces, setFilteredRaces] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingRace, setEditingRace] = useState(null);
    const [formData, setFormData] = useState({
        datum: '',
        race_nr: '',
        season_id: '',
        areal_id: '',
        organizer_id: '',
        registration: true,
        race_method_id: 1,  // 1 = závod na sněhu (default), 2 = suchý slalom
        is_final: false     // finále poháru - jen závod na sněhu
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // Documents state
    
    // Autocomplete states
    const [arealSearch, setArealSearch] = useState('');
    const [arealSuggestions, setArealSuggestions] = useState([]);
    const [organizerSearch, setOrganizerSearch] = useState('');
    const [organizerSuggestions, setOrganizerSuggestions] = useState([]);
    const [raceNumberPreview, setRaceNumberPreview] = useState('');
    const [seasonPreview, setSeasonPreview] = useState('');
    
    // Filter states – výchozí je aktuální sezóna („Všechny sezóny“ zůstává ve výběru)
    const [seasonFilter, setSeasonFilter] = useState(() => String(getCurrentSeasonId()));
    const [availableSeasons, setAvailableSeasons] = useState([]);

    // silent: obnova na pozadí - nesahá na hlášky nad seznamem
    const loadRaces = async ({ silent = false } = {}) => {
        try {
            if (!silent) setError(null);
            const data = await AdminAPI.get('/api/admin/races');
            setRaces(data);
            
            // Aktuální sezóna je ve výběru i bez závodů (je to výchozí filtr).
            const seasons = [...new Set([getCurrentSeasonId(), ...data.map(race => race.season_id)])];
            setAvailableSeasons(seasons.sort((a, b) => b - a));
        } catch (err) {
            console.error('Error loading races:', err);
            if (!silent) setError('Chyba při načítání závodů');
        }
    };

    const filterRaces = () => {
        let filtered = races;

        if (seasonFilter) {
            filtered = filtered.filter(race => race.season_id === parseInt(seasonFilter));
        }

        setFilteredRaces(filtered);
    };

    // Form helpers
    const generateRaceNumberLocal = (date = null) => {
        const dateToUse = date || formData.datum;
        if (!dateToUse) return null;
        
        const seasonId = getSeasonIdForRace(dateToUse);
        const raceNumber = generateRaceNumber(races, seasonId);
        const seasonDisplay = formatSeason(seasonId);
        
        console.log('Generating race number:', { 
            dateToUse, 
            seasonId, 
            raceNumber, 
            seasonDisplay, 
            racesCount: races.length,
            racesLoaded: races.length > 0 
        });
        
        setRaceNumberPreview(raceNumber);
        setSeasonPreview(seasonDisplay);
        
        return {
            race_nr: raceNumber,
            seasonId: seasonId,
            seasonDisplay: seasonDisplay
        };
    };

    // Autocomplete functions
    const searchAreals = async (query) => {
        if (!query.trim()) {
            setArealSuggestions([]);
            return;
        }
        
        try {
            const data = await AdminAPI.get(`/api/admin/races/autocomplete/areals?q=${encodeURIComponent(query)}`);
            setArealSuggestions(data);
        } catch (err) {
            console.error('Error searching areals:', err);
        }
    };

    const searchOrganizers = async (query) => {
        if (!query.trim()) {
            setOrganizerSuggestions([]);
            return;
        }
        
        try {
            const data = await AdminAPI.get(`/api/admin/races/autocomplete/organizers?q=${encodeURIComponent(query)}`);
            setOrganizerSuggestions(data);
        } catch (err) {
            console.error('Error searching organizers:', err);
        }
    };

    const handleArealSearch = (value) => {
        setArealSearch(value);
        
        // Debounce search
        if (arealSearchTimeoutRef.current) {
            clearTimeout(arealSearchTimeoutRef.current);
        }
        
        arealSearchTimeoutRef.current = setTimeout(() => {
            searchAreals(value);
        }, 300);
    };

    const handleOrganizerSearch = (value) => {
        setOrganizerSearch(value);
        
        // Debounce search
        if (organizerSearchTimeoutRef.current) {
            clearTimeout(organizerSearchTimeoutRef.current);
        }
        
        organizerSearchTimeoutRef.current = setTimeout(() => {
            searchOrganizers(value);
        }, 300);
    };

    const selectAreal = async (areal) => {
        try {
            // Just set the search text - backend will handle find-or-create
            setArealSearch(areal.name);
            setArealSuggestions([]);
        } catch (err) {
            console.error('Error selecting areal:', err);
        }
    };

    const selectOrganizer = async (organizer) => {
        try {
            // Just set the search text - backend will handle find-or-create
            setOrganizerSearch(organizer.name);
            setOrganizerSuggestions([]);
        } catch (err) {
            console.error('Error selecting organizer:', err);
        }
    };

    // CRUD operations
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const submitData = { ...formData };
            
            // Replace IDs with names for auto-create functionality
            submitData.areal_name = arealSearch.trim();
            submitData.organizer_name = organizerSearch.trim();
            delete submitData.areal_id;
            delete submitData.organizer_id;
            
            
            if (!editingRace) {
                const result = generateRaceNumberLocal();
                if (result) {
                    submitData.race_nr = result.race_nr;
                    submitData.season_id = result.seasonId;
                }
            }

            if (editingRace) {
                await AdminAPI.put(`/api/admin/races/${editingRace.id}`, submitData);
            } else {
                await AdminAPI.post('/api/admin/races', submitData);
            }

            setSuccess(editingRace ? 'Závod byl úspěšně aktualizován' : 'Závod byl úspěšně vytvořen');
            setShowForm(false);
            resetForm();
            loadRaces();
        } catch (err) {
            console.error('Error saving race:', err);
            setError(err.message || 'Chyba při ukládání závodu');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            datum: '',
            race_nr: '',
            season_id: '',
            areal_id: '',
            organizer_id: '',
            registration: true,
            race_method_id: 1,
            is_final: false
        });
        setEditingRace(null);
        setArealSearch('');
        setOrganizerSearch('');
        setRaceNumberPreview('');
        setSeasonPreview('');
        setArealSuggestions([]);
        setOrganizerSuggestions([]);
    };

    const editRace = (race) => {
        setEditingRace(race);
        setFormData({
            datum: race.datum,
            race_nr: race.race_nr,
            season_id: race.season_id,
            areal_id: race.areal_id,
            organizer_id: race.organizer_id,
            registration: race.registration,
            race_method_id: race.race_method_id || 1,
            is_final: Boolean(race.is_final)
        });
        
        // Set areál and organizer names for autocomplete display
        setArealSearch(race.areal_name || '');
        setOrganizerSearch(race.organizer_name || '');
        
        // Set preview values for editing
        if (race.race_nr) {
            setRaceNumberPreview(race.race_nr);
        }
        if (race.season_id) {
            setSeasonPreview(formatSeason(race.season_id));
        }
        
        setShowForm(true);
    };

    // Vrací true po úspěšném smazání (formulář úpravy se pak zavře).
    const deleteRace = async (raceId) => {
        const race = races.find((item) => item.id === raceId);
        const confirmed = await confirm(deleteRaceConfirm(race));
        if (!confirmed) return false;
        
        try {
            await AdminAPI.delete(`/api/admin/races/${raceId}`);
            setSuccess('Závod byl úspěšně smazán');
            loadRaces();
            return true;
        } catch (err) {
            console.error('Error deleting race:', err);
            setError('Chyba při mazání závodu');
            return false;
        }
    };

    const toggleRegistration = async (raceId) => {
        try {
            await AdminAPI.post(`/api/admin/races/${raceId}/toggle-registration`);
            setSuccess('Stav registrace byl změněn');
            loadRaces();
        } catch (err) {
            console.error('Error toggling registration:', err);
            setError('Chyba při změně stavu registrace');
        }
    };

    const downloadRegistrationsCsv = async (raceId, race_nr) => {
        try {
            const endpoint = `/api/admin/races/${raceId}/export-csv`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: adminAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `registrace_${race_nr}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            setSuccess('CSV soubor byl stažen');
        } catch (err) {
            console.error('Error downloading CSV:', err);
            setError('Chyba při stahování CSV souboru');
        }
    };

    // Initialize data loading
    useEffect(() => {
        loadRaces();
    }, []);

    // Při otevřeném formuláři ne: změna počtu závodů by přegenerovala číslo
    // závodu v rozepsaném formuláři (viz efekt níž).
    useRevalidateOnFocus(() => loadRaces({ silent: true }), { enabled: !showForm });

    useEffect(() => {
        filterRaces();
    }, [races, seasonFilter]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (arealSearchTimeoutRef.current) {
                clearTimeout(arealSearchTimeoutRef.current);
            }
            if (organizerSearchTimeoutRef.current) {
                clearTimeout(organizerSearchTimeoutRef.current);
            }
        };
    }, []);

    // Re-generate race number when races data is loaded and form has date
    useEffect(() => {
        if (races.length > 0 && formData.datum) {
            // For new races, always generate
            // For existing races, only if date changed from original
            const shouldGenerate = !editingRace || 
                (editingRace && formData.datum !== editingRace.datum);
                
            if (shouldGenerate) {
                const result = generateRaceNumberLocal();
                if (result) {
                    setFormData(prev => ({
                        ...prev,
                        race_nr: result.race_nr,
                        season_id: result.seasonId
                    }));
                    // Update preview too
                    setRaceNumberPreview(result.race_nr);
                    setSeasonPreview(result.seasonDisplay);
                }
            }
        }
    }, [races.length, formData.datum, editingRace]);

    return {
        // State
        races: filteredRaces,
        allRaces: races,
        showForm,
        editingRace,
        formData,
        loading,
        error,
        success,
        arealSearch,
        arealSuggestions,
        organizerSearch,
        organizerSuggestions,
        raceNumberPreview,
        seasonPreview,
        seasonFilter,
        availableSeasons,

        // Actions
        setShowForm,
        setFormData,
        setError,
        setSuccess,
        setSeasonFilter,
        handleArealSearch,
        handleOrganizerSearch,
        selectAreal,
        selectOrganizer,
        generateRaceNumberLocal,
        handleSubmit,
        resetForm,
        editRace,
        deleteRace,
        toggleRegistration,
        downloadRegistrationsCsv,
        loadRaces,
    };
};