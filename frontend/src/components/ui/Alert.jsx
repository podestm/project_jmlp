import { useEffect, useRef, useState } from 'react';

/**
 * Universal alert component with auto-dismiss functionality.
 *
 * @param {string} type - 'success' | 'danger' | 'warning' | 'info'
 * @param {React.ReactNode} message - content to display
 * @param {function} onDismiss - called after the alert has faded out
 * @param {number} autoDismissDelay - ms before auto-dismiss (0 = stay)
 *
 * To restart the countdown when the message changes, give the element a
 * `key` derived from the message - the timer deliberately does not depend on
 * `message`, because most call sites pass a freshly-built JSX element on every
 * render and the alert would then never disappear.
 */
const Alert = ({
  type = 'info',
  message,
  onDismiss,
  autoDismissDelay = null
}) => {
  const [visible, setVisible] = useState(true);

  // Held in a ref so an inline arrow from the parent cannot restart the timer.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Determine auto-dismiss delay based on alert type
  const dismissDelay = autoDismissDelay !== null
    ? autoDismissDelay
    : (type === 'danger' ? 0 : 3000); // danger/error stays, others auto-dismiss after 3s

  useEffect(() => {
    if (dismissDelay <= 0) return undefined;

    const timer = setTimeout(() => {
      setVisible(false);
      if (onDismissRef.current) {
        setTimeout(onDismissRef.current, 300); // Wait for fade animation
      }
    }, dismissDelay);

    return () => clearTimeout(timer);
  }, [dismissDelay]);

  const handleDismiss = () => {
    setVisible(false);
    if (onDismissRef.current) {
      setTimeout(onDismissRef.current, 300); // Wait for fade animation
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
        aria-label="Zavřít"
      />
    </div>
  );
};

export default Alert;
