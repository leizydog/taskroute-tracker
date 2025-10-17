export const LiveLocationTracker = ({ selectedEmployee, onViewLocation }) => {
    const [isTracking, setIsTracking] = useState(true);
  
    return (
      <Card>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <FiEye />
          Live Location Tracking
        </h3>
        {selectedEmployee ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Tracking: <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedEmployee.name}</span>
                </p>
              </div>
              <Badge text={isTracking ? "Live - Active" : "Offline"} color={isTracking ? "green" : "red"} />
            </div>
  
            <div className="bg-slate-100 dark:bg-slate-700 p-6 rounded-lg h-64 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600">
              <p className="text-slate-500 dark:text-slate-400 text-center">
                <FiMapPin className="inline mr-2" />
                GPS Map Integration
              </p>
            </div>
  
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400 text-xs">Current Location</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">14.5994° N, 120.9842° E</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400 text-xs">Last Updated</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">2 mins ago</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400 text-xs">Distance Traveled</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">5.2 km</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400 text-xs">Speed</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">42 km/h</p>
              </div>
            </div>
  
            <Button variant="primary" onClick={onViewLocation} fullWidth>
              View Full Map
            </Button>
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">Select an employee first</p>
        )}
      </Card>
    );
  };