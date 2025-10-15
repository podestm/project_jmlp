import React from 'react';
import { usePostManagement } from '../../hooks/usePostManagement.js';
import PostFilters from './post/PostFilters.jsx';
import PostTable from './post/PostTable.jsx';
import PostForm from './post/PostForm.jsx';
import Alert from '../ui/Alert.jsx';

const PostManagement = () => {
    const postManagement = usePostManagement();

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-primary mb-0">Správa příspěvků</h2>
                <button 
                    className="btn btn-success"
                    onClick={postManagement.handleAdd}
                >
                    + Nový příspěvek
                </button>
            </div>

            <PostFilters {...postManagement} />
            
            {postManagement.loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Načítám...</span>
                    </div>
                </div>
            ) : (
                <>
                    <PostTable {...postManagement} />
                    
                    {postManagement.showForm && (
                        <PostForm {...postManagement} />
                    )}
                </>
            )}

            {postManagement.error && (
                <Alert 
                    type="danger" 
                    message={postManagement.error}
                    onDismiss={() => postManagement.setError(null)}
                />
            )}
        </div>
    );
};

export default PostManagement;
