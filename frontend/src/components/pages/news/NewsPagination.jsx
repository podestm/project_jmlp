import React from 'react';

const NewsPagination = ({ currentPage, totalPages, handlePageChange }) => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    if (currentPage > 1) {
        pages.push(
            <li key="prev" className="page-item">
                <button
                    className="page-link"
                    onClick={() => handlePageChange(currentPage - 1)}
                >
                    <i className="bi bi-chevron-left"></i>
                </button>
            </li>
        );
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        pages.push(
            <li key={i} className={`page-item ${i === currentPage ? 'active' : ''}`}>
                <button
                    className="page-link"
                    onClick={() => handlePageChange(i)}
                >
                    {i}
                </button>
            </li>
        );
    }

    // Next button
    if (currentPage < totalPages) {
        pages.push(
            <li key="next" className="page-item">
                <button
                    className="page-link"
                    onClick={() => handlePageChange(currentPage + 1)}
                >
                    <i className="bi bi-chevron-right"></i>
                </button>
            </li>
        );
    }

    return (
        <nav aria-label="Stránkování příspěvků">
            <ul className="pagination justify-content-center">
                {pages}
            </ul>
        </nav>
    );
};

export default NewsPagination;