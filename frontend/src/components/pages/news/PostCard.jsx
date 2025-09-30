import React from 'react';

const PostCard = ({ post, formatDate, formatText, getFileUrl }) => {
    const renderImage = () => {
        if (!post.image_file_id) return null;

        const imageUrl = getFileUrl(post.image_file_id);
        const positionClass = post.image_position === 'left' ? 'float-start me-3' : 
                             post.image_position === 'right' ? 'float-end ms-3' : 
                             post.image_position === 'center' ? 'd-block mx-auto' : 
                             'float-end ms-3';

        return (
            <img 
                src={imageUrl}
                alt={post.title}
                className={`img-fluid mb-2 ${positionClass}`}
                style={{ maxWidth: '300px', maxHeight: '200px' }}
            />
        );
    };

    return (
        <article className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">{post.title}</h5>
                <small className="text-muted">
                    <i className="bi bi-calendar3 me-1"></i>
                    {formatDate(post.created_at)}
                </small>
            </div>
            <div className="card-body">
                {renderImage()}
                
                <div 
                    className="card-text"
                    dangerouslySetInnerHTML={{
                        __html: formatText(post.content)
                    }}
                />
                
                <div className="d-flex justify-content-end mt-3">
                    {post.document_file_id && (
                        <a 
                            href={`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/posts/${post.id}/document/download`}
                            className="btn btn-sm btn-outline-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <i className="bi bi-file-text me-1"></i>
                            Stáhnout dokument
                        </a>
                    )}
                </div>
            </div>
        </article>
    );
};

export default PostCard;