import React from 'react';

const PerformanceCharts = ({ kpiData, locationAnalytics }) => {
  // Simple bar chart component (since we don't have chart libraries installed)
  const SimpleBarChart = ({ data, title, valueKey, labelKey, color = '#4F46E5' }) => {
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data.map(item => item[valueKey]));
    
    return (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">{title}</h4>
        <div className="space-y-2">
          {data.map((item, index) => {
            const percentage = maxValue > 0 ? (item[valueKey] / maxValue) * 100 : 0;
            
            return (
              <div key={index} className="flex items-center">
                <div className="w-16 text-xs text-gray-600 truncate">
                  {item[labelKey]}
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="h-4 rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: color
                      }}
                    />
                  </div>
                </div>
                <div className="w-8 text-xs text-gray-900 text-right">
                  {item[valueKey]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Productivity trend chart
  const productivityData = kpiData?.efficiency_metrics?.productivity_trend || [];
  
  // Quality distribution data
  const qualityData = Object.entries(kpiData?.quality_metrics?.quality_distribution || {})
    .map(([key, value]) => ({
      rating: key.replace('_star', '★'),
      count: value
    }))
    .reverse(); // Show 5★ to 1★

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Trends</h3>
      
      {/* Productivity Trend */}
      {productivityData.length > 0 && (
        <SimpleBarChart
          data={productivityData}
          title="Weekly Productivity"
          valueKey="completed_tasks"
          labelKey="week"
          color="#10B981"
        />
      )}
      
      {/* Quality Distribution */}
      {qualityData.length > 0 && (
        <SimpleBarChart
          data={qualityData}
          title="Quality Rating Distribution"
          valueKey="count"
          labelKey="rating"
          color="#F59E0B"
        />
      )}

      {/* Performance Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Performance Summary</h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* On-time Completion */}
          <div className="flex justify-between">
            <span className="text-gray-600">On-time Rate:</span>
            <span className="font-medium">
              {kpiData?.task_metrics?.on_time_completion_rate 
                ? `${kpiData.task_metrics.on_time_completion_rate}%`
                : 'N/A'}
            </span>
          </div>
          
          {/* Time Variance */}
          <div className="flex justify-between">
            <span className="text-gray-600">Time Variance:</span>
            <span className={`font-medium ${
              kpiData?.efficiency_metrics?.average_time_variance_percent 
                ? kpiData.efficiency_metrics.average_time_variance_percent < 0 
                  ? 'text-green-600' 
                  : 'text-red-600'
                : ''
            }`}>
              {kpiData?.efficiency_metrics?.average_time_variance_percent 
                ? `${kpiData.efficiency_metrics.average_time_variance_percent > 0 ? '+' : ''}${kpiData.efficiency_metrics.average_time_variance_percent}%`
                : 'N/A'}
            </span>
          </div>
          
          {/* Location Compliance */}
          <div className="flex justify-between">
            <span className="text-gray-600">Location Data:</span>
            <span className="font-medium">
              {kpiData?.location_metrics?.tasks_with_location || 0} tasks
            </span>
          </div>
          
          {/* Tasks with Location */}
          <div className="flex justify-between">
            <span className="text-gray-600">Tracking Days:</span>
            <span className="font-medium">
              {locationAnalytics?.location_tracking_days || 0} days
            </span>
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Key Indicators</h4>
        
        <div className="space-y-3">
          {/* Completion Rate Indicator */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Task Completion</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${kpiData?.task_metrics?.completion_rate || 0}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12 text-right">
                {kpiData?.task_metrics?.completion_rate || 0}%
              </span>
            </div>
          </div>
          
          {/* Quality Indicator */}
          {kpiData?.quality_metrics?.average_quality_rating && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Quality Score</span>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(kpiData.quality_metrics.average_quality_rating / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {((kpiData.quality_metrics.average_quality_rating / 5) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
          
          {/* Efficiency Indicator */}
          {kpiData?.efficiency_metrics?.efficiency_score && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Efficiency</span>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${kpiData.efficiency_metrics.efficiency_score}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">
                  {kpiData.efficiency_metrics.efficiency_score}%
                </span>
              </div>
            </div>
          )}
          
          {/* Location Compliance Indicator */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Location Tracking</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${kpiData?.location_metrics?.location_compliance_rate || 0}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12 text-right">
                {kpiData?.location_metrics?.location_compliance_rate || 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Insights</h4>
        <div className="space-y-2 text-sm text-gray-600">
          {kpiData?.task_metrics?.completion_rate >= 90 && (
            <div className="flex items-center space-x-2 text-green-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Excellent task completion rate!</span>
            </div>
          )}
          
          {kpiData?.quality_metrics?.average_quality_rating >= 4.0 && (
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>High quality work maintained!</span>
            </div>
          )}
          
          {kpiData?.efficiency_metrics?.efficiency_score >= 85 && (
            <div className="flex items-center space-x-2 text-indigo-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span>Great time management efficiency!</span>
            </div>
          )}
          
          {kpiData?.location_metrics?.location_compliance_rate >= 80 && (
            <div className="flex items-center space-x-2 text-purple-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span>Consistent location tracking!</span>
            </div>
          )}
          
          {(!kpiData?.task_metrics?.completion_rate || kpiData.task_metrics.completion_rate < 70) && (
            <div className="flex items-center space-x-2 text-yellow-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Focus on completing more assigned tasks</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceCharts;