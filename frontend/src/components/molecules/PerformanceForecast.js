import React from 'react';
import { Card, ProgressBar, Badge } from '../atoms';

export const PerformanceForecast = ({ employee, forecast }) => (
    <Card>
        <h3 className="text-lg font-bold mb-4">Performance Forecast for {employee}</h3>
        <div className="space-y-4">
            {forecast.map((item, index) => (
                <div key={index}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{item.metric}</span>
                        <Badge text={`${item.predicted}%`} color="blue" />
                    </div>
                    <ProgressBar percentage={item.predicted} />
                </div>
            ))}
        </div>
    </Card>
);