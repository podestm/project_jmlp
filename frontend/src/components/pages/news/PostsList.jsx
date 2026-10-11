import PostCard from './PostCard.jsx';
import EmptyState from '../../ui/EmptyState.jsx';

const PostsList = ({ posts }) => {
    if (posts.length === 0) {
        return <EmptyState icon="inbox" title="Žádné příspěvky nebyly nalezeny" />;
    }

    return (
        <div>
            {posts.map(post => (
                <PostCard key={post.id} post={post} />
            ))}
        </div>
    );
};

export default PostsList;
