export const EmployeeSelector = ({ employees = [], selectedEmployee, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
  
    const filteredEmployees = employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filterRole === 'all' || emp.role === filterRole;
      return matchesSearch && matchesRole;
    });
  
    const roles = Array.from(new Set(employees.map(e => e.role)));
  
    return (
      <Card>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Select Employee</h3>
        <div className="space-y-3 mb-4">
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            options={[
              { value: 'all', label: 'All Roles' },
              ...roles.map(role => ({ value: role, label: role }))
            ]}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          />
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredEmployees.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">No employees found</p>
          ) : (
            filteredEmployees.map((emp, idx) => (
              <EmployeeListItem
                key={idx}
                employee={emp}
                isSelected={selectedEmployee?.id === emp.id}
                onSelect={() => onSelect(emp)}
              />
            ))
          )}
        </div>
      </Card>
    );
  };