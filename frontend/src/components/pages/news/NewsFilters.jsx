import React from 'react';

const NewsFilters = ({
    searchTerm,
    setSearchTerm,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    getAvailableYears,
    getAvailableMonths,
    monthNames,
    clearFilters,
    filteredPostsCount,
    totalPostsCount
}) => {
    return (
        <div className="card mb-4">
            <div className="card-body">
                <div className="row g-3 align-items-end">
                    <div className="col-md-6">
                        <label className="form-label">
                            <i className="bi bi-search me-1"></i>
                            Hledat v příspěvcích
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Zadejte hledaný výraz..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">
                            <i className="bi bi-calendar me-1"></i>
                            Rok
                        </label>
                        <select
                            className="form-select"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            <option value="">Všechny roky</option>
                            {getAvailableYears().map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">
                            <i className="bi bi-calendar-month me-1"></i>
                            Měsíc
                        </label>
                        <select
                            className="form-select"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={!selectedYear}
                        >
                            <option value="">Všechny měsíce</option>
                            {getAvailableMonths().map(month => (
                                <option key={month} value={month.toString().padStart(2, '0')}>
                                    {monthNames[month]}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="text-muted small">
                        Zobrazeno {filteredPostsCount} z {totalPostsCount} příspěvků
                    </div>
                    {(searchTerm || selectedYear || selectedMonth) && (
                        <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={clearFilters}
                        >
                            <i className="bi bi-x-circle me-1"></i>
                            Vymazat filtry
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewsFilters;