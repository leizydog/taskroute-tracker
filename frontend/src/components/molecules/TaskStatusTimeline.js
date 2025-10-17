export const TaskStatusTimeline = ({ statuses }) => (
    <Card>
      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Task Timeline</h4>
      <div className="space-y-3">
        {statuses.map((status, idx) => (
          <div key={idx} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-4 h-4 rounded-full ${status.completed ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              {idx < statuses.length - 1 && <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600 mt-1" />}
            </div>
            <div className="pb-3">
              <p className="font-medium text-slate-900 dark:text-slate-100">{status.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{status.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );