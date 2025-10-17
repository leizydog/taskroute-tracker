export const ComparisonCard = ({ label, current, benchmark, isDoing = true }) => (
    <Card>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{label}</p>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Current</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{current}</p>
        </div>
        <div className={`text-sm font-semibold ${isDoing ? 'text-green-600' : 'text-red-600'}`}>
          {isDoing ? '↑' : '↓'} vs {benchmark}
        </div>
      </div>
    </Card>
  );