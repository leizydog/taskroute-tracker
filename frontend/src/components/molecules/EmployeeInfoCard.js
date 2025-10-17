export const EmployeeInfoCard = ({ employee }) => (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={employee.name} size="lg" />
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{employee.name}</h3>
          <p className="text-slate-600 dark:text-slate-400">{employee.role}</p>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Email:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{employee.email || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Phone:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{employee.phone || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Status:</span>
          <Badge text={employee.status} color={employee.status === 'active' ? 'green' : 'yellow'} size="sm" />
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Joined:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{employee.joinDate || 'N/A'}</span>
        </div>
      </div>
    </Card>
  );
  