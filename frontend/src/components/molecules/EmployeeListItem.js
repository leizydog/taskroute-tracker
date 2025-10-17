export const EmployeeListItem = ({ employee, onSelect, isSelected }) => (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={onSelect}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
        isSelected 
          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar name={employee.name} size="md" />
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">{employee.name}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{employee.role}</p>
        </div>
        <Badge text={employee.status} color={employee.status === 'active' ? 'green' : 'yellow'} />
      </div>
    </motion.div>
  );