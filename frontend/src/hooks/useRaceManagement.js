import { useState, useEffect, useRef } from 'react';
import { AdminAPI, API_CONFIG } from '../config/api.js';
import { getSeasonIdForRace, formatSeason, generateRaceNumber } from '../utils/season.js';

export const useRaceManagement = () => {
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
        raceNr: '',
        season_id: '',
        areal_id: '',
        organizer_id: '',
        registration: true,
        proposition_file_id: null,
        results_file_id: null,
        raceMethod_id: 1  // 1 = závod na sněhu (default), 2 = suchý slalom
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // Documents state
    const [availableDocuments, setAvailableDocuments] = useState([]);
    const [availableDocumentsOnly, setAvailableDocumentsOnly] = useState([]); // Documents only (no images)
    const [propositionDocuments, setPropositionDocuments] = useState([]);
    const [resultsDocuments, setResultsDocuments] = useState([]);
    
    // Autocomplete states
    const [arealSearch, setArealSearch] = useState('');
    const [arealSuggestions, setArealSuggestions] = useState([]);
    const [organizerSearch, setOrganizerSearch] = useState('');
    const [organizerSuggestions, setOrganizerSuggestions] = useState([]);
    const [propositionSearch, setPropositionSearch] = useState('');
    const [propositionSuggestions, setPropositionSuggestions] = useState([]);
    const [resultsSearch, setResultsSearch] = useState('');
    const [resultsSuggestions, setResultsSuggestions] = useState([]);
    const [raceNumberPreview, setRaceNumberPreview] = useState('');
    const [seasonPreview, setSeasonPreview] = useState('');
    
    // Filter states
    const [seasonFilter, setSeasonFilter] = useState('');
    const [availableSeasons, setAvailableSeasons] = useState([]);

    // Helper function to determine if file is a document (not image)
    const isDocument = (doc) => {
        if (!doc.original_filename) return true; // Safe fallback
        
        const filename = doc.original_filename.toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const documentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.rtf', '.odt', '.ods'];
        
        // If it's explicitly an image, exclude it
        if (imageExtensions.some(ext => filename.endsWith(ext))) {
            return false;
        }
        
        // If it's explicitly a document, include it
        if (documentExtensions.some(ext => filename.endsWith(ext))) {
            return true;
        }
        
        // For unknown extensions, include by default (safer for race propositions)
        return true;
    };

    // Data loading functions
    const loadDocuments = async () => {
        try {
            const data = await AdminAPI.get('/api/admin/files');
            setAvailableDocuments(data);
            
            // Filter for documents only (exclude images) for propositions
            const documentsOnly = data.filter(isDocument);
            setAvailableDocumentsOnly(documentsOnly);
            
            setPropositionDocuments(documentsOnly.filter(doc => 
                doc.file_type === 'proposition' || (doc.original_filename && doc.original_filename.toLowerCase().includes('propozice'))
            ));
            setResultsDocuments(documentsOnly.filter(doc => 
                doc.file_type === 'results' || (doc.original_filename && doc.original_filename.toLowerCase().includes('vysledky'))
            ));
        } catch (err) {
            console.error('Error loading documents:', err);
        }
    };

    const loadRaces = async () => {
        try {
            setError(null);
            const data = await AdminAPI.get('/api/admin/races');
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

    // Document autocomplete handlers
    const handlePropositionSearch = (value) => {
        setPropositionSearch(value);
        
        if (!value.trim()) {
            setPropositionSuggestions([]);
            return;
        }
        
        // Filter documents by search query
        const filtered = availableDocumentsOnly.filter(doc =>
            doc.original_filename.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 10); // Limit to 10 suggestions
        
        setPropositionSuggestions(filtered);
    };

    const handleResultsSearch = (value) => {
        setResultsSearch(value);
        
        if (!value.trim()) {
            setResultsSuggestions([]);
            return;
        }
        
        // Filter documents by search query
        const filtered = availableDocumentsOnly.filter(doc =>
            doc.original_filename.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 10); // Limit to 10 suggestions
        
        setResultsSuggestions(filtered);
    };

    const selectPropositionDocument = (doc) => {
        setFormData(prev => ({...prev, proposition_file_id: doc.id}));
        setPropositionSearch(doc.original_filename);
        setPropositionSuggestions([]);
    };

    const selectResultsDocument = (doc) => {
        setFormData(prev => ({...prev, results_file_id: doc.id}));
        setResultsSearch(doc.original_filename);
        setResultsSuggestions([]);
    };

    const clearPropositionDocument = () => {
        setFormData(prev => ({...prev, proposition_file_id: null}));
        setPropositionSearch('');
        setPropositionSuggestions([]);
    };

    const clearResultsDocument = () => {
        setFormData(prev => ({...prev, results_file_id: null}));
        setResultsSearch('');
        setResultsSuggestions([]);
    };

    // Inline file upload handler for race form
    const handleInlineUpload = async (file, type) => {
        // type = 'proposition' or 'results'
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('file_type', type === 'proposition' ? 'propozice' : 'vysledky');

            const result = await AdminAPI.upload('/api/admin/files/upload', formData);

            // Create a doc object matching the format used by select functions
            const doc = {
                id: result.file_id,
                original_filename: result.original_filename,
                file_type: result.file_type || (type === 'proposition' ? 'propozice' : 'vysledky')
            };

            // Auto-select the uploaded document
            if (type === 'proposition') {
                selectPropositionDocument(doc);
            } else {
                selectResultsDocument(doc);
            }

            // Refresh documents list
            await loadDocuments();

            return { success: true, filename: result.original_filename };
        } catch (err) {
            console.error('Inline upload error:', err);
            throw err;
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
                    submitData.raceNr = result.raceNr;
                    submitData.season_id = result.seasonId;
                }
            }

            let response;
            if (editingRace) {
                response = await AdminAPI.put(`/api/admin/races/${editingRace.id}`, submitData);
            } else {
                response = await AdminAPI.post('/api/admin/races', submitData);
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
            results_file_id: null,
            raceMethod_id: 1
        });
        setEditingRace(null);
        setArealSearch('');
        setOrganizerSearch('');
        setPropositionSearch('');
        setResultsSearch('');
        setRaceNumberPreview('');
        setSeasonPreview('');
        setArealSuggestions([]);
        setOrganizerSuggestions([]);
        setPropositionSuggestions([]);
        setResultsSuggestions([]);
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
            results_file_id: race.results_file_id,
            raceMethod_id: race.raceMethod_id || 1
        });
        
        // Set areál and organizer names for autocomplete display
        setArealSearch(race.areal_name || '');
        setOrganizerSearch(race.organizer_name || '');
        
        // Set document names for autocomplete display
        if (race.proposition_file_id) {
            const propDoc = availableDocumentsOnly.find(doc => doc.id === race.proposition_file_id);
            if (propDoc) {
                setPropositionSearch(propDoc.original_filename);
            }
        }
        if (race.results_file_id) {
            const resDoc = availableDocumentsOnly.find(doc => doc.id === race.results_file_id);
            if (resDoc) {
                setResultsSearch(resDoc.original_filename);
            }
        }
        
        // Set preview values for editing
        if (race.raceNr) {
            setRaceNumberPreview(race.raceNr);
        }
        if (race.season_id) {
            setSeasonPreview(formatSeason(race.season_id));
        }
        
        setShowForm(true);
    };

    const deleteRace = async (raceId) => {
        if (!window.confirm('Opravdu chcete smazat tento závod?')) return;
        
        try {
            await AdminAPI.delete(`/api/admin/races/${raceId}`);
            setSuccess('Závod byl úspěšně smazán');
            loadRaces();
        } catch (err) {
            console.error('Error deleting race:', err);
            setError('Chyba při mazání závodu');
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

    const downloadRegistrationsCsv = async (raceId, raceNr) => {
        try {
            const token = localStorage.getItem('admin_token');
            const endpoint = `/api/admin/races/${raceId}/export-csv`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `registrace_${raceNr}.csv`;
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
        loadDocuments();
    }, []);

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
                        raceNr: result.raceNr,
                        season_id: result.seasonId
                    }));
                    // Update preview too
                    setRaceNumberPreview(result.raceNr);
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
        availableDocuments,
        availableDocumentsOnly,
        propositionDocuments,
        resultsDocuments,
        arealSearch,
        arealSuggestions,
        organizerSearch,
        organizerSuggestions,
        propositionSearch,
        propositionSuggestions,
        resultsSearch,
        resultsSuggestions,
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
        handlePropositionSearch,
        handleResultsSearch,
        selectAreal,
        selectOrganizer,
        selectPropositionDocument,
        selectResultsDocument,
        clearPropositionDocument,
        clearResultsDocument,
        handleInlineUpload,
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