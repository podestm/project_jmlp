import { useState, useEffect } from 'react';
import API, { API_CONFIG } from '../config/api.js';
import { formatText as formatTextUtil } from '../utils/text.js';
import { MONTH_NAMES } from '../config/constants.js';

export const useNewsArchive = () => {
    // State management
    const [posts, setPosts] = useState([]);
    const [filteredPosts, setFilteredPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    
    const postsPerPage = 10;

    // Effects
    useEffect(() => {
        fetchPosts();
    }, []);

    useEffect(() => {
        filterPosts();
    }, [posts, searchTerm, selectedYear, selectedMonth]);

    useEffect(() => {
        setCurrentPage(1); // Reset to first page when filters change
    }, [searchTerm, selectedYear, selectedMonth]);

    // Data fetching
    const fetchPosts = async () => {
        try {
            setLoading(true);
            const data = await API.get(API_CONFIG.ENDPOINTS.POSTS);
            setPosts(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filtering logic
    const filterPosts = () => {
        let filtered = posts;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(post =>
                post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                post.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
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

    // Utility functions
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

    const monthNames = ['', ...MONTH_NAMES];

    // Pagination
    const indexOfLastPost = currentPage * postsPerPage;
    const indexOfFirstPost = indexOfLastPost - postsPerPage;
    const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost);
    const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedYear('');
        setSelectedMonth('');
        setCurrentPage(1);
    };

    // Date formatting
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('cs-CZ');
    };

    const formatText = (text) => {
        return formatTextUtil(text);
    };

    return {
        // State
        posts,
        filteredPosts,
        loading,
        error,
        currentPage,
        searchTerm,
        selectedYear,
        selectedMonth,
        postsPerPage,
        currentPosts,
        totalPages,
        
        // Setters
        setSearchTerm,
        setSelectedYear,
        setSelectedMonth,
        setCurrentPage,
        
        // Functions
        getAvailableYears,
        getAvailableMonths,
        monthNames,
        handlePageChange,
        clearFilters,
        formatDate,
        formatText
    };
};