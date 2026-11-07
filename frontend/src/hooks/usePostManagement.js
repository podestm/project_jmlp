import { useState, useEffect } from 'react';
import { AdminAPI } from '../config/api.js';
import { MONTH_NAMES } from '../config/constants.js';
import { useRevalidateOnFocus } from './useRevalidateOnFocus.js';

/**
 * @param {{confirm?: Function}} [options] - confirm z useConfirm komponenty,
 *   která hook používá (hook sám dialog vykreslit nemůže)
 */
export const usePostManagement = ({ confirm } = {}) => {
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
    // Obrázek a dokument tu záměrně nejsou: připojuje je AttachmentManager
    // rovnou přes /api/admin/attachments. Kdyby je formulář posílal s sebou,
    // uložení příspěvku by přílohu připojenou mezitím zase odpojilo (backend
    // bere image_file_id: null jako "odpojit").
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        published: false,
        image_position: 'right'
    });

    // Effects
    useEffect(() => {
        loadPosts();
    }, []);

    useEffect(() => {
        filterPosts();
    }, [posts, searchTerm, statusFilter, selectedYear, selectedMonth]);

    // Data loading functions
    // silent: obnova na pozadí - bez spinneru a bez chybové hlášky přes
    // seznam, který už na obrazovce je
    const loadPosts = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            const data = await AdminAPI.get('/api/admin/posts');
            setPosts(data);
        } catch {
            if (!silent) setError('Chyba při načítání postů');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Při otevřeném formuláři se seznam pod ním neobnovuje
    useRevalidateOnFocus(() => loadPosts({ silent: true }), { enabled: !showForm });

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

    const monthNames = MONTH_NAMES;

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setSelectedYear('');
        setSelectedMonth('');
    };

    const handleAdd = () => {
        resetForm();
        setError('');
        setSuccess('');
        setShowForm(true);
    };

    // Form management functions
    const resetForm = () => {
        setFormData({
            title: '',
            content: '',
            published: false,
            image_position: 'right'
        });
        setEditingPost(null);
        setShowForm(false);
    };

    // Přílohy se v otevřeném formuláři ukládají hned, takže seznam pod ním
    // se po zavření obnoví - jinak by odznaky Obrázek/Dokument v tabulce
    // ukazovaly stav z doby před otevřením.
    const closeForm = () => {
        resetForm();
        loadPosts({ silent: true });
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
                image_position: formData.image_position
            };

            if (editingPost) {
                await AdminAPI.put(`/api/admin/posts/${editingPost.id}`, payload);
                setSuccess('Post byl úspěšně aktualizován');
                closeForm();
            } else {
                // Obrázek a dokument jde připojit jen k uloženému příspěvku,
                // proto formulář zůstane otevřený už jako úprava nového postu.
                const created = await AdminAPI.post('/api/admin/posts', payload);
                setEditingPost(created);
                setSuccess('Post je uložený, teď k němu můžete připojit obrázek nebo dokument');
                loadPosts({ silent: true });
            }
        } catch (err) {
            setError(err.message || 'Chyba při ukládání postu');
        }
    };

    const handleEdit = (post) => {
        setFormData({
            title: post.title || '',
            content: post.content || '',
            published: post.published || false,
            image_position: post.image_position || 'right'
        });
        setEditingPost(post);
        setError('');
        setSuccess('');
        setShowForm(true);
    };

    const handleDelete = async (postId) => {
        const post = posts.find((item) => item.id === postId);
        const confirmed = await confirm({
            title: post?.title ? `Smazat příspěvek „${post.title}“?` : 'Smazat příspěvek?',
            message: 'Smazání nejde vrátit.',
            confirmLabel: 'Smazat příspěvek',
            danger: true,
            icon: 'trash'
        });
        if (!confirmed) return;

        try {
            await AdminAPI.delete(`/api/admin/posts/${postId}`);
            setSuccess('Post byl úspěšně smazán');
            loadPosts();
        } catch (err) {
            setError(err.message || 'Chyba při mazání postu');
        }
    };

    // Utility functions
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
        filterPosts,
        getAvailableYears,
        getAvailableMonths,
        clearFilters,
        resetForm,
        closeForm,
        handleAdd,
        handleSubmit,
        handleEdit,
        handleDelete,
        formatContent,
        formatDate,
        formatDateTime
    };
};