import React from 'react';

const RegistrationMessage = ({ msg, setMsg }) => {
    if (!msg) return null;

    const isSuccess = msg.includes('✅');
    const isError = msg.includes('❌');
    
    let alertClass = 'alert-info';
    if (isSuccess) alertClass = 'alert-success';
    if (isError) alertClass = 'alert-danger';

    return (
        <div className={`alert ${alertClass} alert-dismissible fade show`}>
            {msg}
            <button 
                type="button" 
                className="btn-close" 
                onClick={() => setMsg('')}
            ></button>
        </div>
    );
};

export default RegistrationMessage;