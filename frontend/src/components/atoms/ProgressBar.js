export const ProgressBar = ({ value, color = 'indigo', showLabel = true }) => {
    const colors = {
      indigo: 'bg-indigo-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
    };
  
    return (
      <div className="w-full">
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${colors[color]} transition-all duration-300`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
        {showLabel && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{value}%</p>
        )}
      </div>
    );
  };