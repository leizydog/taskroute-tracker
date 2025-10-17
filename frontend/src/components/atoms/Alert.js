export const Alert = ({ type = 'info', title, message, onClose }) => {
    const types = {
      info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
      success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
      error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
    };
  
    return (
      <div className={`p-4 rounded-lg border ${types[type]} flex justify-between items-start`}>
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {message && <p className="text-sm">{message}</p>}
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-2 font-bold">
            ✕
          </button>
        )}
      </div>
    );
  };