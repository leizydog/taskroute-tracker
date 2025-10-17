export const Textarea = ({ label, placeholder, value, onChange, error, rows = 4, required = false }) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        className={`w-full px-4 py-2 border rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 transition-colors ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-slate-300 dark:border-slate-600 focus:ring-indigo-500'
        } focus:outline-none focus:ring-2`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );