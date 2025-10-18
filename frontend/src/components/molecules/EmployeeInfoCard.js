import React from 'react';
import { Card, Avatar, Badge } from '../atoms';

export const EmployeeInfoCard = ({ employee }) => {
    if (!employee) return null;

    return (
        <Card>
            <div className="flex items-center space-x-4">
                <Avatar name={employee.name} size="lg" />
                <div>
                    <h3 className="text-lg font-bold">{employee.name}</h3>
                    <p className="text-sm text-gray-500">{employee.role}</p>
                </div>
            </div>
            <div className="mt-4 space-y-2">
                <p><strong>Email:</strong> {employee.email}</p>
                <p><strong>Phone:</strong> {employee.phone}</p>
                <p><strong>Joined:</strong> {employee.joinDate}</p>
                <Badge text={employee.status} color={employee.status === 'active' ? 'green' : 'yellow'} />
            </div>
        </Card>
    );
};