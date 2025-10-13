import React from 'react';
import PostCard from './PostCard.jsx';

const PostsList = ({ posts, formatDate, formatText }) => {
    if (posts.length === 0) {
        return (
            <div className="text-center py-5">
                <div className="text-muted">
                    <i className="bi bi-inbox display-1"></i>
                    <p className="mt-3">Žádné příspěvky nebyly nalezeny</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {posts.map(post => (
                <PostCard 
                    key={post.id}
                    post={post}
                    formatDate={formatDate}
                    formatText={formatText}
                />
            ))}
        </div>
    );
};

export default PostsList;