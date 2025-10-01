import { useState, useEffect } from 'react';
import { AdminAPI } from '../config/api.js';

export const usePostManagement = () => {
    // State management
    const [posts, setPosts] = useState([]);
    const [filteredPosts, setFilteredPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    
    // Form data
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        published: false,
        image_file_id: '',
        image_position: 'right',
        document_file_id: ''
    });
    
    // Available files
    const [availableFiles, setAvailableFiles] = useState({
        images: [],
        documents: []
    });

    // Effects
    useEffect(() => {
        loadPosts();
        loadAvailableFiles();
    }, []);

    useEffect(() => {
        filterPosts();
    }, [posts, searchTerm, statusFilter, selectedYear, selectedMonth]);

    // Data loading functions
    const loadPosts = async () => {
        try {
            setLoading(true);
            const data = await AdminAPI.get('/admin/posts');
            setPosts(data);
        } catch (err) {
            setError('Chyba při načítání postů');
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableFiles = async () => {
        try {
            // Load all files and filter client-side
            const allFiles = await AdminAPI.get('/admin/files');
            
            // Filter images strictly - only files that are definitely images
            const images = allFiles.filter(file => 
                file.file_type === 'image' || 
                (file.mime_type && file.mime_type.startsWith('image/'))
            );
            
            // Filter documents strictly - exclude anything that is an image
            const documents = allFiles.filter(file => {
                // Exclude if it's marked as image type
                if (file.file_type === 'image') return false;
                
                // Exclude if mime_type indicates it's an image
                if (file.mime_type && file.mime_type.startsWith('image/')) return false;
                
                // Include everything else (documents, PDFs, etc.)
                return true;
            });
            
            setAvailableFiles({
                images: images,
                documents: documents
            });
        } catch (err) {
            console.error('Chyba při načítání dostupných souborů:', err);
            // Set empty arrays on error to prevent crashes
            setAvailableFiles({
                images: [],
                documents: []
            });
        }
    };

    // Filter and utility functions
    const filterPosts = () => {
        let filtered = posts;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(post =>
                post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                post.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by status
        if (statusFilter) {
            if (statusFilter === 'published') {
                filtered = filtered.filter(post => post.published);
            } else if (statusFilter === 'draft') {
                filtered = filtered.filter(post => !post.published);
            }
        }

        // Filter by year
        if (selectedYear) {
            filtered = filtered.filter(post => {
                const postYear = new Date(post.created_at).getFullYear().toString();
                return postYear === selectedYear;
            });
        }

        // Filter by month
        if (selectedMonth) {
            filtered = filtered.filter(post => {
                const postMonth = (new Date(post.created_at).getMonth() + 1).toString().padStart(2, '0');
                return postMonth === selectedMonth;
            });
        }

        setFilteredPosts(filtered);
    };

    const getAvailableYears = () => {
        const years = posts.map(post => new Date(post.created_at).getFullYear());
        return [...new Set(years)].sort((a, b) => b - a);
    };

    const getAvailableMonths = () => {
        if (!selectedYear) return [];
        
        const months = posts
            .filter(post => new Date(post.created_at).getFullYear().toString() === selectedYear)
            .map(post => new Date(post.created_at).getMonth() + 1);
        return [...new Set(months)].sort((a, b) => a - b);
    };

    const monthNames = [
        'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ];

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setSelectedYear('');
        setSelectedMonth('');
    };

    const handleAdd = () => {
        resetForm();
        setShowForm(true);
    };

    // Form management functions
    const resetForm = () => {
        setFormData({
            title: '',
            content: '',
            published: false,
            image_file_id: '',
            image_position: 'right',
            document_file_id: ''
        });
        setEditingPost(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            setError('');
            setSuccess('');

            const payload = {
                title: formData.title,
                content: formData.content,
                published: formData.published,
                image_file_id: formData.image_file_id || null,
                image_position: formData.image_position,
                document_file_id: formData.document_file_id || null
            };

            if (editingPost) {
                await AdminAPI.put(`/admin/posts/${editingPost.id}`, payload);
                setSuccess('Post byl úspěšně aktualizován');
            } else {
                await AdminAPI.post('/admin/posts', payload);
                setSuccess('Post byl úspěšně vytvořen');
            }

            loadPosts();
            resetForm();
        } catch (err) {
            setError(err.response?.data?.detail || 'Chyba při ukládání postu');
        }
    };

    const handleEdit = (post) => {
        setFormData({
            title: post.title || '',
            content: post.content || '',
            published: post.published || false,
            image_file_id: post.image_file_id || '',
            image_position: post.image_position || 'right',
            document_file_id: post.document_file_id || ''
        });
        setEditingPost(post);
        setShowForm(true);
    };

    const handleDelete = async (postId) => {
        if (!window.confirm('Opravdu chcete smazat tento post?')) {
            return;
        }

        try {
            await AdminAPI.delete(`/admin/posts/${postId}`);
            setSuccess('Post byl úspěšně smazán');
            loadPosts();
        } catch (err) {
            setError(err.message || 'Chyba při mazání postu');
        }
    };

    // Utility functions
    const getFileName = (fileId, type) => {
        const files = type === 'image' ? availableFiles.images : availableFiles.documents;
        const file = files.find(f => f.id === parseInt(fileId));
        return file ? file.original_filename : 'Neznámý soubor';
    };

    const formatContent = (content) => {
        if (!content) return '';
        
        // Replace **bold** with <strong>
        let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Replace *italic* with <em>
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return formatted;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('cs-CZ');
    };

    const formatDateTime = (dateString) => {
        return new Date(dateString).toLocaleString('cs-CZ');
    };

    // Return all state and functions
    return {
        // State
        posts,
        filteredPosts,
        loading,
        error,
        success,
        showForm,
        editingPost,
        searchTerm,
        statusFilter,
        selectedYear,
        selectedMonth,
        formData,
        availableFiles,
        
        // Computed values
        availableYears: getAvailableYears(),
        availableMonths: getAvailableMonths(),
        monthNames,
        
        // Setters
        setError,
        setSuccess,
        setShowForm,
        setSearchTerm,
        setStatusFilter,
        setSelectedYear,
        setSelectedMonth,
        setFormData,
        
        // Functions
        loadPosts,
        loadAvailableFiles,
        filterPosts,
        getAvailableYears,
        getAvailableMonths,
        clearFilters,
        resetForm,
        handleAdd,
        handleSubmit,
        handleEdit,
        handleDelete,
        getFileName,
        formatContent,
        formatDate,
        formatDateTime
    };
};