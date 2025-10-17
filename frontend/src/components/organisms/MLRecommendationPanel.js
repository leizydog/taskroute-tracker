export const MLRecommendationPanel = ({ employees = [], onAssignTask }) => {
    const [taskDetails, setTaskDetails] = useState({
      name: '',
      description: '',
      priority: 'medium'
    });
  
    const [recommendations, setRecommendations] = useState([]);
    const [showRecommendations, setShowRecommendations] = useState(false);
  
    const handleGenerateRecommendations = () => {
      const mockRecommendations = [
        { id: 1, name: 'John Doe', score: 94, reason: 'Excellent completion rate and quality' },
        { id: 2, name: 'Jane Smith', score: 89, reason: 'Strong performance history' },
        { id: 3, name: 'Sarah Williams', score: 85, reason: 'Good capability for this type of task' }
      ];
      setRecommendations(mockRecommendations);
      setShowRecommendations(true);
    };
  
    return (
      <div className="space-y-4">
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <FiBrain />
            ML-Powered Task Assignment
          </h3>
  
          <div className="space-y-4 mb-6">
            <Input
              label="Task Name"
              placeholder="e.g., Package Delivery Downtown"
              value={taskDetails.name}
              onChange={(e) => setTaskDetails({ ...taskDetails, name: e.target.value })}
            />
            <textarea
              placeholder="Describe the task..."
              value={taskDetails.description}
              onChange={(e) => setTaskDetails({ ...taskDetails, description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
              rows="3"
            />
            <Select
              label="Priority"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' }
              ]}
              value={taskDetails.priority}
              onChange={(e) => setTaskDetails({ ...taskDetails, priority: e.target.value })}
            />
          </div>
  
          <Button
            variant="primary"
            onClick={handleGenerateRecommendations}
            fullWidth
          >
            Get ML Recommendations
          </Button>
        </Card>
  
        {showRecommendations && (
          <Card>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Recommended Employees</h4>
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.name}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{rec.reason}</p>
                  </div>
                  <div className="text-right mr-4">
                    <Badge text={`${rec.score}% Match`} color="green" size="sm" />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onAssignTask(rec.id, taskDetails)}
                  >
                    Assign
                  </Button>
                </motion.div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };