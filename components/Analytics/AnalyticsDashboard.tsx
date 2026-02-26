import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, Activity, Clock, IndianRupee, Sparkles, QrCode, Smartphone } from 'lucide-react';
import { supabase } from '../../services/db';

interface AnalyticsDashboardProps {
  clinicId?: string;
}

const COLORS = ['#6366F1', '#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#EF4444'];
const PAYMENT_COLORS: Record<string, string> = {
  Cash: '#10B981',
  UPI: '#6366F1',
  Card: '#F59E0B',
  Insurance: '#EC4899',
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ clinicId }) => {
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [revenueByPayment, setRevenueByPayment] = useState<any[]>([]);
  const [checkinChannelData, setCheckinChannelData] = useState<any[]>([]);
  const [avgWaitTime, setAvgWaitTime] = useState<string>('—');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [aiInsight, setAiInsight] = useState('');

  useEffect(() => {
    if (clinicId) fetchAnalytics();
  }, [clinicId]);

  const fetchAnalytics = async () => {
    if (!clinicId) return;
    const today = new Date();

    // ── Patient traffic (last 7 days) ──
    const trafficResult: { name: string; patients: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .gte('created_at', `${dayStr}T00:00:00`)
        .lte('created_at', `${dayStr}T23:59:59`);
      trafficResult.push({
        name: d.toLocaleDateString(undefined, { weekday: 'short' }),
        patients: count || 0,
      });
    }
    setTrafficData(trafficResult);

    // ── Diagnosis mix ── (from medical_records)
    const { data: records } = await supabase
      .from('medical_records')
      .select('diagnosis, fee_collected, payment_method, created_at')
      .eq('clinic_id', clinicId);

    if (records) {
      // Diagnosis donut
      const diagMap: Record<string, number> = {};
      records.forEach(r => {
        const d = r.diagnosis || 'Other';
        diagMap[d] = (diagMap[d] || 0) + 1;
      });
      const sortedDiag = Object.entries(diagMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }));
      setDiagnosisData(sortedDiag);

      // Revenue by day (last 7 days)
      const revResult: { name: string; revenue: number }[] = [];
      let total = 0;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        const dayRecords = records.filter(r =>
          r.created_at?.startsWith(dayStr)
        );
        const dayRev = dayRecords.reduce((s, r) => s + (Number(r.fee_collected) || 0), 0);
        total += dayRev;
        revResult.push({
          name: d.toLocaleDateString(undefined, { weekday: 'short' }),
          revenue: dayRev,
        });
      }
      setRevenueData(revResult);
      setTotalRevenue(total);

      // Revenue by payment method (donut)
      const paymentMap: Record<string, number> = {};
      records.forEach(r => {
        const pm = r.payment_method || 'Cash';
        paymentMap[pm] = (paymentMap[pm] || 0) + (Number(r.fee_collected) || 0);
      });
      setRevenueByPayment(
        Object.entries(paymentMap)
          .filter(([_, v]) => v > 0)
          .map(([name, value]) => ({ name, value }))
      );
    }

    // ── Check-in channels (QR vs Front Desk) ──
    const channelResult: { name: string; count: number; color: string }[] = [];
    const { count: qrCount } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('source', 'QR_Checkin');
    const { count: deskCount } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .neq('source', 'QR_Checkin');
    channelResult.push(
      { name: 'QR Check-In', count: qrCount || 0, color: '#6366F1' },
      { name: 'Front Desk', count: deskCount || 0, color: '#F59E0B' }
    );
    setCheckinChannelData(channelResult);

    // ── Average wait time (completed today) ──
    const todayStr = today.toISOString().split('T')[0];
    const { data: completedAppts } = await supabase
      .from('appointments')
      .select('created_at, status')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('created_at', `${todayStr}T00:00:00`);

    if (completedAppts && completedAppts.length > 0) {
      // Simplified: average time from creation to now as a proxy
      // In a real app you'd track start/end timestamps
      const waitTimes = completedAppts.map(a => {
        const created = new Date(a.created_at).getTime();
        return (Date.now() - created) / 60000; // minutes
      });
      const avg = waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length;
      if (avg < 60) {
        setAvgWaitTime(`${Math.round(avg)} min`);
      } else {
        setAvgWaitTime(`${Math.round(avg / 60)}h ${Math.round(avg % 60)}m`);
      }
    }

    // AI Insight
    const busiest = trafficResult.reduce((max, day) => day.patients > max.patients ? day : max, trafficResult[0]);
    setAiInsight(
      busiest?.patients > 0
        ? `${busiest.name} was your busiest day with ${busiest.patients} patients. Revenue over 7 days: ₹${totalRevenue.toLocaleString('en-IN')}.`
        : 'Start seeing patients to generate insights!'
    );
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4 pb-24 md:pb-8 max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6 max-w-full overflow-hidden">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">Insights from the last 7 days</p>
      </div>

      {/* AI Insight */}
      {aiInsight && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 p-5 rounded-2xl shadow-sm">
          <p className="text-sm text-indigo-800 flex items-start gap-2">
            <Sparkles size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <span>{aiInsight}</span>
          </p>
        </div>
      )}

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<TrendingUp className="text-indigo-600" size={20} />}
          label="Total Revenue (7d)"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          bg="bg-indigo-50 border-indigo-200"
        />
        <SummaryCard
          icon={<Clock className="text-amber-500" size={20} />}
          label="Avg Wait Time"
          value={avgWaitTime}
          bg="bg-amber-50 border-amber-200"
        />
        <SummaryCard
          icon={<Smartphone className="text-violet-600" size={20} />}
          label="QR Check-Ins"
          value={`${checkinChannelData.find(c => c.name === 'QR Check-In')?.count || 0}`}
          bg="bg-violet-50 border-violet-200"
        />
        <SummaryCard
          icon={<Activity className="text-emerald-600" size={20} />}
          label="Today's Patients"
          value={`${trafficData[trafficData.length - 1]?.patients || 0}`}
          bg="bg-emerald-50 border-emerald-200"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Patient Traffic */}
        <ChartCard title="Patient Traffic" subtitle="Daily patient count" icon={<TrendingUp size={16} className="text-indigo-500" />}>
          <div className="w-full" style={{ overflowX: 'hidden' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trafficData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px', padding: '8px 12px' }} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="patients" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Revenue Trend */}
        <ChartCard title="Revenue Trend" subtitle="Daily revenue (₹)" icon={<IndianRupee size={16} className="text-emerald-500" />}>
          <div className="w-full" style={{ overflowX: 'hidden' }}>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={revenueData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} tickFormatter={(v: number) => v >= 1000 ? `₹${v / 1000}k` : `₹${v}`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(value: any) => [`₹${value}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#10B981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Diagnosis Mix */}
        <ChartCard title="Diagnosis Mix" subtitle="Most common diagnoses" icon={<Activity size={16} className="text-pink-500" />}>
          {/* Mobile: simple percentage list */}
          <div className="block md:hidden">
            {diagnosisData.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No data yet</div>
            ) : (
              <div className="space-y-1">
                {diagnosisData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3 py-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                    <span className="text-xs font-bold text-slate-500">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Desktop: pie chart */}
          <div className="hidden md:block">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={diagnosisData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {diagnosisData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13, border: '1px solid #e2e8f0' }} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-slate-600 font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Revenue by Payment Method */}
        <ChartCard title="Revenue by Payment Method" subtitle="Breakdown by how patients pay" icon={<IndianRupee size={16} className="text-violet-500" />}>
          {revenueByPayment.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={revenueByPayment}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {revenueByPayment.map((entry, i) => (
                    <Cell key={i} fill={PAYMENT_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, fontSize: 13, border: '1px solid #e2e8f0' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-slate-600 font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Check-in Channels */}
        <ChartCard title="Check-In Channels" subtitle="QR vs Front Desk registrations" icon={<QrCode size={16} className="text-blue-500" />}>
          <div className="w-full" style={{ overflowX: 'hidden' }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={checkinChannelData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} width={72} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={28}>
                  {checkinChannelData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

      </div>
    </div>
  );
};

// ── Sub-components ──
const SummaryCard = ({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) => (
  <div className={`p-4 rounded-2xl border ${bg} flex flex-col gap-2`}>
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-semibold text-slate-500">{label}</span>
    </div>
    <div className="text-2xl font-black text-slate-900 tabular-nums">{value}</div>
  </div>
);

const ChartCard = ({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
    <div className="px-5 pt-5 pb-3 flex-shrink-0">
      <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">{icon} {title}</h3>
      <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
    </div>
    <div className="px-2 pb-4 overflow-hidden flex-1">
      <div className="w-full">{children}</div>
    </div>
  </div>
);

export default AnalyticsDashboard;