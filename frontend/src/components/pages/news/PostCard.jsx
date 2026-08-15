import API from '../../../config/api.js';
import { formatDateShort } from '../../../utils/date.js';
import { formatText } from '../../../utils/text.js';

// Pomocné funkce si karta bere přímo z utils - dřív je dostávala jako props,
// což vázalo každé místo, které kartu vykreslí, na hook s formátováním.
const PostCard = ({ post }) => {
    const showImage = post.image_file_id && post.image_position !== 'none';
    const imagePosition = post.image_position || 'right';
    
    // Add cache busting parameter using updated_at timestamp
    const imageUrl = showImage 
        ? API.getImageUrl(post.id, post.updated_at)
        : null;

    return (
        <article className="card mb-4">
            {/* Obrázek nad kartou (pozice top) */}
            {showImage && imagePosition === 'top' && (
                <img 
                    src={imageUrl}
                    alt={post.title}
                    className="card-img-top"
                    style={{ height: '200px', objectFit: 'cover' }}
                />
            )}
            
            <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">{post.title}</h5>
                <small className="text-muted">
                    <i className="bi bi-calendar3 me-1"></i>
                    {formatDateShort(post.created_at)}
                </small>
            </div>
            <div className="card-body">
                {/* Obrázek vlevo nebo vpravo (float) */}
                {showImage && (imagePosition === 'left' || imagePosition === 'right') && (
                    <img 
                        src={imageUrl}
                        alt={post.title}
                        className={`img-fluid mb-2 ${imagePosition === 'left' ? 'float-start me-3' : 'float-end ms-3'}`}
                        style={{ maxWidth: '400px', maxHeight: '250px', objectFit: 'cover' }}
                    />
                )}
                
                <div 
                    className="card-text"
                    dangerouslySetInnerHTML={{
                        __html: formatText(post.content)
                    }}
                />
                
                {post.document_file_id && (
                    <div className="mt-3">
                        <a 
                            href={API.getDocumentUrl(post.id)}
                            className="btn btn-outline-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <i className="bi bi-file-text me-1"></i>
                            Stáhnout dokument
                        </a>
                    </div>
                )}
            </div>
        </article>
    );
};

export default PostCard;