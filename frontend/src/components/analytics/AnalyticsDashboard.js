import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import PerformanceCharts from './PerformanceCharts';
import LocationMap from './LocationMap';

const AnalyticsDashboard = () => {
  const [kpiData, setKpiData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [locationAnalytics, setLocationAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [activeView, setActiveView] = useState('personal');
  const { user } = useAuth();

  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod, activeView]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch personal KPI data
      const kpiResponse = await axios.get(`/analytics/kpi/overview?days=${selectedPeriod}`);
      setKpiData(kpiResponse.data);
      
      // Fetch location analytics
      const locationResponse = await axios.get(`/locations/analytics?days=${selectedPeriod}`);
      setLocationAnalytics(locationResponse.data);
      
      // Fetch team data if user is manager
      if (isManager && activeView === 'team') {
        const teamResponse = await axios.get(`/analytics/team/overview?days=${selectedPeriod}`);
        setTeamData(teamResponse.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value) => {
    return value !== null && value !== undefined ? `${value}%` : 'N/A';
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-blue-100';
    if (score >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Performance Analytics</h2>
        
        <div className="flex space-x-4">
          {/* View Toggle */}
          {isManager && (
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveView('personal')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition duration-200 ${
                  activeView === 'personal'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Personal
              </button>
              <button
                onClick={() => setActiveView('team')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition duration-200 ${
                  activeView === 'team'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Team
              </button>
            </div>
          )}
          
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {activeView === 'personal' ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          {kpiData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Task Completion Rate */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                    <p className={`text-2xl font-bold ${getScoreColor(kpiData.task_metrics.completion_rate)}`}>
                      {formatPercentage(kpiData.task_metrics.completion_rate)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {kpiData.task_metrics.completed_tasks} of {kpiData.task_metrics.total_tasks} tasks
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${getScoreBg(kpiData.task_metrics.completion_rate)} flex items-center justify-center`}>
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Quality Rating */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Avg Quality</p>
                    <p className={`text-2xl font-bold ${getScoreColor((kpiData.quality_metrics.average_quality_rating || 0) * 20)}`}>
                      {kpiData.quality_metrics.average_quality_rating 
                        ? `${kpiData.quality_metrics.average_quality_rating}/5` 
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {kpiData.quality_metrics.tasks_with_ratings} rated tasks
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${getScoreBg((kpiData.quality_metrics.average_quality_rating || 0) * 20)} flex items-center justify-center`}>
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Efficiency Score */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Efficiency</p>
                    <p className={`text-2xl font-bold ${getScoreColor(kpiData.efficiency_metrics.efficiency_score || 0)}`}>
                      {kpiData.efficiency_metrics.efficiency_score 
                        ? `${kpiData.efficiency_metrics.efficiency_score}%`
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Avg time: {formatDuration(kpiData.task_metrics.average_completion_time_minutes)}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${getScoreBg(kpiData.efficiency_metrics.efficiency_score || 0)} flex items-center justify-center`}>
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Location Compliance */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Location Tracking</p>
                    <p className={`text-2xl font-bold ${getScoreColor(kpiData.location_metrics.location_compliance_rate)}`}>
                      {formatPercentage(kpiData.location_metrics.location_compliance_rate)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {kpiData.location_metrics.distance_traveled_km}km traveled
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${getScoreBg(kpiData.location_metrics.location_compliance_rate)} flex items-center justify-center`}>
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts and Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Charts */}
            {kpiData && (
              <PerformanceCharts 
                kpiData={kpiData}
                locationAnalytics={locationAnalytics}
              />
            )}

            {/* Location Analytics */}
            {locationAnalytics && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Analytics</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Locations Logged</span>
                    <span className="font-medium">{locationAnalytics.total_locations_logged}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tracking Days</span>
                    <span className="font-medium">{locationAnalytics.location_tracking_days}</span>
                  </div>
                  
                  {locationAnalytics.average_gps_accuracy && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg GPS Accuracy</span>
                      <span className="font-medium">{Math.round(locationAnalytics.average_gps_accuracy)}m</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Distance Traveled</span>
                    <span className="font-medium">{locationAnalytics.distance_traveled_km}km</span>
                  </div>
                </div>

                {/* Most Visited Locations */}
                {locationAnalytics.most_visited_locations?.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Most Visited Locations</h4>
                    <div className="space-y-2">
                      {locationAnalytics.most_visited_locations.slice(0, 3).map((location, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600 truncate">{location.location}</span>
                          <span className="font-medium">{location.visits} visits</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quality Distribution */}
          {kpiData && Object.keys(kpiData.quality_metrics.quality_distribution).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Rating Distribution</h3>
              <div className="grid grid-cols-5 gap-4">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = kpiData.quality_metrics.quality_distribution[`${rating}_star`] || 0;
                  const total = kpiData.quality_metrics.tasks_with_ratings;
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  
                  return (
                    <div key={rating} className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <span className="text-sm font-medium mr-1">{rating}</span>
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <div className="text-lg font-bold text-gray-900">{count}</div>
                      <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Team View */
        teamData && (
          <div className="space-y-6">
            {/* Team Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600">{teamData.team_size}</p>
                  <p className="text-sm text-gray-600">Team Members</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{teamData.summary.total_completed}</p>
                  <p className="text-sm text-gray-600">Tasks Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{teamData.summary.team_completion_rate}%</p>
                  <p className="text-sm text-gray-600">Team Completion Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 truncate">{teamData.summary.top_performer}</p>
                  <p className="text-sm text-gray-600">Top Performer</p>
                </div>
              </div>
            </div>

            {/* Team Members Performance */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <h3 className="text-lg font-semibold text-gray-900 p-6 pb-0">Team Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team Member
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tasks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completion Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Quality
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Efficiency
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Activity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teamData.team_members.map((member) => (
                      <tr key={member.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.user_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {member.role}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {member.completed_tasks}/{member.total_tasks}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBg(member.completion_rate)} ${getScoreColor(member.completion_rate)}`}>
                            {member.completion_rate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.average_quality ? `${member.average_quality}/5` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {member.efficiency_score ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBg(member.efficiency_score)} ${getScoreColor(member.efficiency_score)}`}>
                              {member.efficiency_score}%
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.last_activity ? 
                            new Date(member.last_activity).toLocaleDateString() : 
                            'No activity'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default AnalyticsDashboard;