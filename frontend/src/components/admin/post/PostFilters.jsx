import Alert from '../../ui/Alert.jsx';

const PostFilters = ({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    availableYears,
    availableMonths,
    monthNames,
    clearFilters,
    error,
    success,
    setError,
    setSuccess
}) => {
    return (
        <>
            {/* Alerts */}
            {error && (
                <Alert 
                    type="danger" 
                    message={error}
                    onDismiss={() => setError('')}
                />
            )}

            {success && (
                <Alert 
                    type="success" 
                    message={success}
                    onDismiss={() => setSuccess('')}
                />
            )}

            {/* Filter Bar */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-4">
                            <label className="form-label">
                                🔍 Hledat v příspěvcích
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Zadejte hledaný výraz..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">
                                ✅ Status
                            </label>
                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">Všechny</option>
                                <option value="published">Publikované</option>
                                <option value="draft">Koncepty</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">
                                📅 Rok
                            </label>
                            <select
                                className="form-select"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                            >
                                <option value="">Všechny roky</option>
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">
                                🗓️ Měsíc
                            </label>
                            <select
                                className="form-select"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                disabled={!selectedYear}
                            >
                                <option value="">Všechny měsíce</option>
                                {availableMonths.map(month => (
                                    <option key={month} value={month.toString().padStart(2, '0')}>
                                        {monthNames[month - 1]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={clearFilters}
                                title="Vymazat všechny filtry"
                            >
                                🗑️ Vymazat filtry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PostFilters;