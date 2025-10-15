import { useEffect, useState } from 'react';

/**
 * Universal alert component with auto-dismiss functionality
 * 
 * @param {string} type - Alert type: 'success', 'danger', 'warning', 'info'
 * @param {string} message - Alert message to display
 * @param {function} onDismiss - Callback when alert is dismissed
 * @param {number} autoDismissDelay - Auto-dismiss delay in ms (0 = no auto-dismiss)
 */
const Alert = ({ 
  type = 'info', 
  message, 
  onDismiss, 
  autoDismissDelay = null 
}) => {
  const [visible, setVisible] = useState(true);

  // Determine auto-dismiss delay based on alert type
  const dismissDelay = autoDismissDelay !== null 
    ? autoDismissDelay 
    : (type === 'danger' ? 0 : 3000); // danger/error stays, others auto-dismiss after 3s

  useEffect(() => {
    if (dismissDelay > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) {
          setTimeout(onDismiss, 300); // Wait for fade animation
        }
      }, dismissDelay);

      return () => clearTimeout(timer);
    }
  }, [dismissDelay, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    if (onDismiss) {
      setTimeout(onDismiss, 300); // Wait for fade animation
    }
  };

  if (!message) return null;

  return (
    <div 
      className={`alert alert-${type} alert-dismissible fade ${visible ? 'show' : ''}`} 
      role="alert"
      style={{
        transition: 'opacity 0.3s ease-in-out',
        opacity: visible ? 1 : 0
      }}
    >
      {message}
      <button 
        type="button" 
        className="btn-close" 
        onClick={handleDismiss}
        aria-label="Close"
      />
    </div>
  );
};

export default Alert;
