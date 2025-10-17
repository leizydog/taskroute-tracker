export const PerformanceForecast = ({ employee, forecast }) => (
    <Card>
      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{employee} - Performance Forecast</h4>
      <div className="space-y-4">
        {forecast.map((item, idx) => (
          <div key={idx}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.metric}</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{item.predicted}%</span>
            </div>
            <ProgressBar value={item.predicted} color="indigo" showLabel={false} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Badge text="ML-Predicted" color="blue" size="sm" />
      </div>
    </Card>
  );