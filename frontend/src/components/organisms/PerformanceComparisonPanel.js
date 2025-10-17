export const PerformanceComparisonPanel = ({ selectedEmployee, teamAverage = {} }) => {
    if (!selectedEmployee) {
      return (
        <Card className="text-center py-8 text-slate-500 dark:text-slate-400">
          Select an employee to view comparison
        </Card>
      );
    }
  
    return (
      <div className="space-y-4">
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Performance vs Team Average</h3>
          <div className="space-y-4">
            <ComparisonCard
              label="Completion Rate"
              current="92%"
              benchmark={teamAverage.completionRate || "85%"}
              isDoing={true}
            />
            <ComparisonCard
              label="Quality Score"
              current="4.6/5"
              benchmark={teamAverage.qualityScore || "4.2/5"}
              isDoing={true}
            />
            <ComparisonCard
              label="On-Time Delivery"
              current="88%"
              benchmark={teamAverage.onTimeRate || "82%"}
              isDoing={true}
            />
            <ComparisonCard
              label="Customer Satisfaction"
              current="4.8/5"
              benchmark={teamAverage.satisfaction || "4.3/5"}
              isDoing={true}
            />
          </div>
        </Card>
      </div>
    );
  };