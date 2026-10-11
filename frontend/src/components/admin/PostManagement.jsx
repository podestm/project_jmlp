import { usePostManagement } from '../../hooks/usePostManagement.js';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import PostFilters from './post/PostFilters.jsx';
import PostTable from './post/PostTable.jsx';
import PostForm from './post/PostForm.jsx';

const PostManagement = () => {
    // Hook sám dialog vykreslit nemůže, proto confirm posílá dolů (viz useConfirm.jsx).
    const { confirm, confirmElement } = useConfirm();
    const postManagement = usePostManagement({ confirm });

    return (
        <div className="container-fluid admin-section">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Správa příspěvků</h2>
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

            {confirmElement}
        </div>
    );
};

export default PostManagement;
