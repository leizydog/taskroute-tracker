export const LocationBadge = ({ location, status = 'active' }) => (
    <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
      <div className={`w-3 h-3 rounded-full ${status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">📍 {location}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{status === 'active' ? 'Live' : 'Last known'}</p>
      </div>
    </div>
  );