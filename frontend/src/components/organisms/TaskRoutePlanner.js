export const TaskRoutePlanner = ({ selectedEmployee, tasks = [], onPlanRoute }) => {
    const [selectedTasks, setSelectedTasks] = useState([]);
  
    const handleTaskToggle = (taskId) => {
      setSelectedTasks(prev =>
        prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
      );
    };
  
    return (
      <Card>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <FiRoute />
          Multi-Task Route Planner
        </h3>
        {selectedEmployee ? (
          <div className="space-y-4">
            <Alert
              type="info"
              message={`Planning optimized route for ${selectedEmployee.name}`}
            />
  
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Select Tasks to Include
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tasks.map((task, idx) => (
                  <label key={idx} className="flex items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={() => handleTaskToggle(task.id)}
                      className="w-4 h-4"
                    />
                    <span className="ml-3 text-sm text-slate-900 dark:text-slate-100">{task.name}</span>
                    <Badge text={task.status} size="sm" className="ml-auto" />
                  </label>
                ))}
              </div>
            </div>
  
            <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg min-h-64 flex items-center justify-center">
              <p className="text-slate-500 dark:text-slate-400 text-center">
                {selectedTasks.length === 0
                  ? 'Select tasks to see route preview'
                  : `Route preview for ${selectedTasks.length} task(s)`}
              </p>
            </div>
  
            <Button
              variant="primary"
              onClick={() => onPlanRoute(selectedTasks)}
              disabled={selectedTasks.length === 0}
              fullWidth
            >
              Generate Optimal Route
            </Button>
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">Select an employee first</p>
        )}
      </Card>
    );
  };