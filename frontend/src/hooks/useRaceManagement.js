import { useState, useEffect } from 'react';
import { AdminAPI, API_CONFIG } from '../config/api.js';
import { getSeasonIdForRace, formatSeason, generateRaceNumber } from '../utils/season.js';

export const useRaceManagement = () => {
    // State management
    const [races, setRaces] = useState([]);
    const [filteredRaces, setFilteredRaces] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingRace, setEditingRace] = useState(null);
    const [formData, setFormData] = useState({
        datum: '',
        raceNr: '',
        season_id: '',
        areal_id: '',
        organizer_id: '',
        registration: true,
        proposition_file_id: null,
        results_file_id: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // Documents state
    const [availableDocuments, setAvailableDocuments] = useState([]);
    const [propositionDocuments, setPropositionDocuments] = useState([]);
    const [resultsDocuments, setResultsDocuments] = useState([]);
    
    // Autocomplete states
    const [arealSearch, setArealSearch] = useState('');
    const [arealSuggestions, setArealSuggestions] = useState([]);
    const [organizerSearch, setOrganizerSearch] = useState('');
    const [organizerSuggestions, setOrganizerSuggestions] = useState([]);
    const [raceNumberPreview, setRaceNumberPreview] = useState('');
    const [seasonPreview, setSeasonPreview] = useState('');
    
    // Filter states
    const [seasonFilter, setSeasonFilter] = useState('');
    const [availableSeasons, setAvailableSeasons] = useState([]);

    // Data loading functions
    const loadDocuments = async () => {
        try {
            const data = await AdminAPI.get('/admin/files');
            setAvailableDocuments(data);
            
            setPropositionDocuments(data.filter(doc => 
                doc.file_type === 'proposition' || doc.original_filename.toLowerCase().includes('propozice')
            ));
            setResultsDocuments(data.filter(doc => 
                doc.file_type === 'results' || doc.original_filename.toLowerCase().includes('vysledky')
            ));
        } catch (err) {
            console.error('Error loading documents:', err);
        }
    };

    const loadRaces = async () => {
        try {
            setError(null);
            const data = await AdminAPI.get('/admin/races');
            setRaces(data);
            
            const seasons = [...new Set(data.map(race => race.season_id))];
            setAvailableSeasons(seasons.sort((a, b) => b - a));
        } catch (err) {
            console.error('Error loading races:', err);
            setError('Chyba při načítání závodů');
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
        
        setRaceNumberPreview(raceNumber);
        setSeasonPreview(seasonDisplay);
        
        return {
            raceNr: raceNumber,
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
            const data = await AdminAPI.get(`/admin/races/autocomplete/areals?q=${encodeURIComponent(query)}`);
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
            const data = await AdminAPI.get(`/admin/races/autocomplete/organizers?q=${encodeURIComponent(query)}`);
            setOrganizerSuggestions(data);
        } catch (err) {
            console.error('Error searching organizers:', err);
        }
    };

    const handleArealSearch = (value) => {
        setArealSearch(value);
        searchAreals(value);
    };

    const handleOrganizerSearch = (value) => {
        setOrganizerSearch(value);
        searchOrganizers(value);
    };

    const selectAreal = async (areal) => {
        try {
            if (typeof areal.id === 'undefined') {
                const newAreal = await AdminAPI.post('/admin/races/autocomplete/areals', { name: areal.name });
                setFormData(prev => ({...prev, areal_id: newAreal.id}));
                setArealSearch(newAreal.name);
            } else {
                setFormData(prev => ({...prev, areal_id: areal.id}));
                setArealSearch(areal.name);
            }
            setArealSuggestions([]);
        } catch (err) {
            console.error('Error selecting areal:', err);
        }
    };

    const selectOrganizer = async (organizer) => {
        try {
            if (typeof organizer.id === 'undefined') {
                const newOrganizer = await AdminAPI.post('/admin/races/autocomplete/organizers', { name: organizer.name });
                setFormData(prev => ({...prev, organizer_id: newOrganizer.id}));
                setOrganizerSearch(newOrganizer.name);
            } else {
                setFormData(prev => ({...prev, organizer_id: organizer.id}));
                setOrganizerSearch(organizer.name);
            }
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
            
            if (!editingRace) {
                const result = generateRaceNumberLocal();
                if (result) {
                    submitData.raceNr = result.raceNr;
                    submitData.season_id = result.seasonId;
                }
            }

            let response;
            if (editingRace) {
                response = await AdminAPI.put(`/admin/races/${editingRace.id}`, submitData);
            } else {
                response = await AdminAPI.post('/admin/races', submitData);
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
            raceNr: '',
            season_id: '',
            areal_id: '',
            organizer_id: '',
            registration: true,
            proposition_file_id: null,
            results_file_id: null
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
            raceNr: race.raceNr,
            season_id: race.season_id,
            areal_id: race.areal_id,
            organizer_id: race.organizer_id,
            registration: race.registration,
            proposition_file_id: race.proposition_file_id,
            results_file_id: race.results_file_id
        });
        setShowForm(true);
    };

    const deleteRace = async (raceId) => {
        if (!window.confirm('Opravdu chcete smazat tento závod?')) return;
        
        try {
            await AdminAPI.delete(`/admin/races/${raceId}`);
            setSuccess('Závod byl úspěšně smazán');
            loadRaces();
        } catch (err) {
            console.error('Error deleting race:', err);
            setError('Chyba při mazání závodu');
        }
    };

    const toggleRegistration = async (raceId) => {
        try {
            await AdminAPI.post(`/admin/races/${raceId}/toggle-registration`);
            setSuccess('Stav registrace byl změněn');
            loadRaces();
        } catch (err) {
            console.error('Error toggling registration:', err);
            setError('Chyba při změně stavu registrace');
        }
    };

    const downloadRegistrationsCsv = async (raceId, raceNr) => {
        try {
            const token = localStorage.getItem('admin_token');
            const response = await fetch(`${API_CONFIG.BASE_URL}/admin/races/${raceId}/export-csv`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `registrace_${raceNr}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            setSuccess('CSV soubor byl stažen');
        } catch (err) {
            console.error('Error downloading CSV:', err);
            setError('Chyba při stahování CSV souboru');
        }
    };

    // Initialize data loading
    useEffect(() => {
        loadRaces();
        loadDocuments();
    }, []);

    useEffect(() => {
        filterRaces();
    }, [races, seasonFilter]);

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
        availableDocuments,
        propositionDocuments,
        resultsDocuments,
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
        loadDocuments
    };
};