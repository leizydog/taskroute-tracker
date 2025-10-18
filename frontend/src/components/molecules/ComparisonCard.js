import React from 'react';
import { Card } from '../atoms';

export const ComparisonCard = ({ label, current, benchmark, isDoing }) => {
    return (
        <Card className={`p-4 rounded-lg shadow-sm ${isDoing ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="text-sm font-medium text-gray-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{current}</div>
            <div className="text-sm text-gray-500">Benchmark: {benchmark}</div>
        </Card>
    );
};