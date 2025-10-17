export const EmployeeKPIPanel = ({ selectedEmployee, loading = false }) => {
    if (loading) {
      return (
        <Card className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </Card>
      );
    }
  
    if (!selectedEmployee) {
      return (
        <Card className="text-center py-8 text-slate-500 dark:text-slate-400">
          Select an employee to view KPIs
        </Card>
      );
    }
  
    return (
      <div className="space-y-4">
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Key Performance Indicators</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KPIMetric
              icon={FiCheckSquare}
              label="Completion Rate"
              value="92%"
              target="85%"
              color="green"
            />
            <KPIMetric
              icon={FiTrendingUp}
              label="Quality Score"
              value="4.6/5"
              target="4.5/5"
              color="yellow"
            />
            <KPIMetric
              icon={FiCalendar}
              label="On-Time Rate"
              value="88%"
              target="90%"
              color="blue"
            />
            <KPIMetric
              icon={FiMapPin}
              label="Location Compliance"
              value="95%"
              target="90%"
              color="purple"
            />
          </div>
        </Card>
  
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComparisonCard
              label="Task Completion"
              current="92%"
              benchmark="85%"
              isDoing={true}
            />
            <ComparisonCard
              label="Quality Maintenance"
              current="4.6/5"
              benchmark="4.0/5"
              isDoing={true}
            />
            <ComparisonCard
              label="Avg Time per Task"
              current="2.5hrs"
              benchmark="3hrs"
              isDoing={true}
            />
            <ComparisonCard
              label="Customer Satisfaction"
              current="4.8/5"
              benchmark="4.5/5"
              isDoing={true}
            />
          </div>
        </Card>
  
        <PerformanceForecast
          employee={selectedEmployee.name}
          forecast={[
            { metric: 'Next Week Completion', predicted: 94 },
            { metric: 'Quality Prediction', predicted: 88 },
            { metric: 'Efficiency Score', predicted: 91 },
            { metric: 'Customer Satisfaction', predicted: 92 }
          ]}
        />
  
        <TaskStatusTimeline
          statuses={[
            { label: 'Assigned', time: '2 hours ago', completed: true },
            { label: 'In Progress', time: '1 hour ago', completed: true },
            { label: 'Review', time: 'In progress', completed: false },
            { label: 'Complete', time: 'Pending', completed: false }
          ]}
        />
      </div>
    );
  };