
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, CheckCircle, Calendar } from 'lucide-react';
import { MockDB } from '../../db';
import { VisitStatus } from '../../types';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#94a3b8', '#ec4899', '#8b5cf6'];

const AnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalVisits: 0,
    uniquePatients: 0,
    completionRate: 0,
    visitsData: [] as any[],
    diseaseData: [] as any[],
  });

  useEffect(() => {
    // Force refresh data from MockDB every time this component mounts or updates
    const fetchData = () => {
      const visits = MockDB.getVisits();
      const patients = MockDB.getPatients();

      // 1. KPI Calculations
      const totalVisits = visits.length;
      const uniquePatients = patients.length;
      const completedVisits = visits.filter(v => v.status === VisitStatus.COMPLETED).length;
      const completionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

      // 2. Patient Traffic Trends (Group by Month)
      const visitsByMonth = visits.reduce((acc, visit) => {
        const date = new Date(visit.arrivalTime);
        const month = date.toLocaleString('default', { month: 'short' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Ensure we have at least the current month
      const currentMonth = new Date().toLocaleString('default', { month: 'short' });
      if (!visitsByMonth[currentMonth]) visitsByMonth[currentMonth] = 0;

      const visitsData = Object.entries(visitsByMonth).map(([month, count]) => ({
        month,
        visits: count,
      }));

      // 3. Disease Distribution
      const diagnosisCounts = visits
        .filter(v => v.status === VisitStatus.COMPLETED && v.diagnosis)
        .reduce((acc, visit) => {
          const diagnosis = visit.diagnosis || 'Unknown';
          acc[diagnosis] = (acc[diagnosis] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const diseaseData = Object.entries(diagnosisCounts).map(([name, value]) => ({
        name,
        value,
      }));

      // Fallback for empty disease data to show *something*
      if (diseaseData.length === 0) {
        diseaseData.push({ name: 'No Data', value: 1 });
      }

      setStats({
        totalVisits,
        uniquePatients,
        completionRate,
        visitsData,
        diseaseData,
      });
    };

    fetchData();

    // Set up an interval to poll for updates (simulating real-time sync)
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Clinic Analytics</h1>
        <p className="text-slate-500 mt-1">Real-time performance and disease distribution insights.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Visits', value: stats.totalVisits, icon: <Calendar />, color: 'bg-indigo-50 text-indigo-600', trend: 'Live' },
          { label: 'Unique Patients', value: stats.uniquePatients, icon: <Users />, color: 'bg-emerald-50 text-emerald-600', trend: 'Live' },
          { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: <CheckCircle />, color: 'bg-amber-50 text-amber-600', trend: 'Live' },
          { label: 'Growth', value: '24%', icon: <TrendingUp />, color: 'bg-slate-50 text-slate-600', trend: 'Proj' }, // Keep static for now
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.color}`}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{kpi.value}</span>
                <span className="text-xs font-bold text-emerald-600">{kpi.trend}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Visit Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Patient Traffic Trends</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.visitsData}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="visits" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVisits)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Disease Distribution */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Disease Distribution</h3>
          <div className="h-[300px]">
            {stats.diseaseData.length > 0 && stats.diseaseData[0].name !== 'No Data' ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.diseaseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {stats.diseaseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                No diagnoses active yet
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {stats.diseaseData.map((entry, index) => (
              entry.name !== 'No Data' && (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-slate-600 font-medium">{entry.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{entry.value}</span>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
