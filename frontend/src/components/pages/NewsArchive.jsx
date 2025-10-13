import React from 'react';
import { useNewsArchive } from '../../hooks/useNewsArchive.js';
import NewsFilters from './news/NewsFilters.jsx';
import PostsList from './news/PostsList.jsx';
import NewsPagination from './news/NewsPagination.jsx';

function NewsArchive() {
    const newsArchive = useNewsArchive();

    if (newsArchive.loading) {
        return (
            <div className="container">
                <div className="d-flex justify-content-center align-items-center" style={{minHeight: '400px'}}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Načítám...</span>
                        </div>
                        <p className="text-muted">Načítám příspěvky...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (newsArchive.error) {
        return (
            <div className="container">
                <div className="alert alert-danger" role="alert">
                    <h4 className="alert-heading">Chyba při načítání</h4>
                    <p>{newsArchive.error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h1 className="mb-0">
                            <i className="bi bi-newspaper me-2"></i>
                            Archiv příspěvků
                        </h1>
                    </div>

                    <NewsFilters 
                        searchTerm={newsArchive.searchTerm}
                        setSearchTerm={newsArchive.setSearchTerm}
                        selectedYear={newsArchive.selectedYear}
                        setSelectedYear={newsArchive.setSelectedYear}
                        selectedMonth={newsArchive.selectedMonth}
                        setSelectedMonth={newsArchive.setSelectedMonth}
                        getAvailableYears={newsArchive.getAvailableYears}
                        getAvailableMonths={newsArchive.getAvailableMonths}
                        monthNames={newsArchive.monthNames}
                        clearFilters={newsArchive.clearFilters}
                        filteredPostsCount={newsArchive.filteredPosts.length}
                        totalPostsCount={newsArchive.posts.length}
                    />

                    <PostsList 
                        posts={newsArchive.currentPosts}
                        formatDate={newsArchive.formatDate}
                        formatText={newsArchive.formatText}
                    />

                    <NewsPagination 
                        currentPage={newsArchive.currentPage}
                        totalPages={newsArchive.totalPages}
                        handlePageChange={newsArchive.handlePageChange}
                    />
                </div>
            </div>
        </div>
    );
}

export default NewsArchive;