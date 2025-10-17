export const StatValue = ({ label, value, trend, color = 'indigo' }) => (
    <Card className="text-center">
      <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{label}</p>
      {trend && (
        <p className={`text-xs mt-1 font-semibold ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </p>
      )}
    </Card>
  );