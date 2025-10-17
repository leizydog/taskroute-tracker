export const TaskManagementPanel = ({ onCreateTask, tasks = [], onEdit, onDelete }) => {
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
  
    const filteredTasks = tasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.assignee.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Task Management</h3>
          <Button icon={FiPlus} onClick={onCreateTask}>Create Task</Button>
        </div>
  
        <div className="flex gap-3">
          <Input
            placeholder="Search tasks or assignee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={FiSearch}
          />
          <Select
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' }
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
        </div>
  
        {filteredTasks.length === 0 ? (
          <Card className="text-center py-8 text-slate-500 dark:text-slate-400">
            No tasks found
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task, idx) => (
              <TaskCard
                key={idx}
                task={task}
                onEdit={() => onEdit(task)}
                onDelete={() => onDelete(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };