import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from 'recharts';
import {
  TrendingUp, Activity, Clock, IndianRupee, Sparkles,
  QrCode, Smartphone, Loader2, Download, Users, ArrowUpRight,
} from 'lucide-react';
import { supabase } from '../../services/db';
import { toast } from 'react-hot-toast';
import { downloadAnalyticsReport } from '../../services/analyticsReport';

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

// ─── helpers ──────────────────────────────────────────────────────────────────
function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function shortDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label, prefix = '' }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl text-xs font-bold border border-slate-700">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill || '#fff' }}>
          {prefix}{typeof p.value === 'number' && prefix === '₹'
            ? p.value.toLocaleString('en-IN')
            : p.value}
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ clinicId }) => {
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [revenueByPayment, setRevenueByPayment] = useState<any[]>([]);
  const [checkinChannelData, setCheckinChannelData] = useState<any[]>([]);
  const [avgWaitTime, setAvgWaitTime] = useState<string>('—');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [aiInsight, setAiInsight] = useState('');
  const [loading, setLoading] = useState(true);  // BUG FIX 4: was missing
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!clinicId) return;
    setDownloading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const docName = user?.user_metadata?.full_name
        ?? user?.user_metadata?.first_name
        ?? user?.email?.split('@')[0]
        ?? 'Doctor';
      const { data } = await supabase.from('clinics').select('name').eq('id', clinicId).single();
      await downloadAnalyticsReport(clinicId, data?.name ?? 'Clinic', docName);
      toast.success('Report downloaded!');
    } catch (err: any) {
      toast.error('Failed to generate report');
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    if (clinicId) fetchAnalytics();
  }, [clinicId]);

  const fetchAnalytics = async () => {
    if (!clinicId) return;
    setLoading(true);

    const days = last7Days();
    const rangeStart = days[0].toISOString().split('T')[0] + 'T00:00:00';
    const rangeEnd = days[6].toISOString().split('T')[0] + 'T23:59:59';

    // ── BUG FIX 1: Replace 7 sequential loop queries with 2 parallel batch queries ──
    const [patientsRes, recordsRes, qrRes, deskRes, completedRes] = await Promise.all([
      // All patients in the last 7 days
      supabase
        .from('patients')
        .select('created_at')
        .eq('clinic_id', clinicId)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),

      // All medical records ever (for diagnosis + revenue)
      supabase
        .from('medical_records')
        .select('diagnosis, fee_collected, payment_method, created_at')
        .eq('clinic_id', clinicId),

      // QR check-in count
      supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('source', 'QR_Checkin'),

      // Front desk count
      supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .neq('source', 'QR_Checkin'),

      // Today's completed appointments (for wait time)
      supabase
        .from('appointments')
        .select('created_at, updated_at')
        .eq('clinic_id', clinicId)
        .eq('status', 'completed')
        .gte('created_at', days[6].toISOString().split('T')[0] + 'T00:00:00'),
    ]);

    // ── Traffic: group patients by day in JS (no loop queries) ──
    const trafficMap: Record<string, number> = {};
    days.forEach(d => { trafficMap[d.toISOString().split('T')[0]] = 0; });
    (patientsRes.data ?? []).forEach((p: any) => {
      const key = p.created_at?.split('T')[0];
      if (key && trafficMap[key] !== undefined) trafficMap[key]++;
    });
    const trafficResult = days.map(d => ({
      name: shortDay(d),
      patients: trafficMap[d.toISOString().split('T')[0]],
    }));
    setTrafficData(trafficResult);
    setTotalPatients((patientsRes.data ?? []).length);

    // ── Medical records processing ──
    const records = recordsRes.data ?? [];

    // Diagnosis donut
    const diagMap: Record<string, number> = {};
    records.forEach((r: any) => {
      const d = r.diagnosis || 'Other';
      diagMap[d] = (diagMap[d] || 0) + 1;
    });
    setDiagnosisData(
      Object.entries(diagMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }))
    );

    // Revenue by day
    let total = 0;
    const revenueResult = days.map(d => {
      const dayStr = d.toISOString().split('T')[0];
      const dayRev = records
        .filter((r: any) => r.created_at?.startsWith(dayStr))
        .reduce((s: number, r: any) => s + (Number(r.fee_collected) || 0), 0);
      total += dayRev;
      return { name: shortDay(d), revenue: dayRev };
    });
    setRevenueData(revenueResult);
    setTotalRevenue(total);

    // Revenue by payment method
    const paymentMap: Record<string, number> = {};
    records.forEach((r: any) => {
      const pm = r.payment_method || 'Cash';
      paymentMap[pm] = (paymentMap[pm] || 0) + (Number(r.fee_collected) || 0);
    });
    setRevenueByPayment(
      Object.entries(paymentMap)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    );

    // ── Check-in channels ──
    setCheckinChannelData([
      { name: 'QR Check-In', count: qrRes.count ?? 0, color: '#6366F1' },
      { name: 'Front Desk', count: deskRes.count ?? 0, color: '#F59E0B' },
    ]);

    // ── Avg wait time ──
    // NOTE: We use updated_at - created_at as a proxy for actual wait duration.
    // This is an approximation; ideally you'd store a separate consultation_started_at timestamp.
    const appts = completedRes.data ?? [];
    if (appts.length > 0) {
      const waitMins = appts
        .map((a: any) => {
          const start = new Date(a.created_at).getTime();
          const end = a.updated_at ? new Date(a.updated_at).getTime() : Date.now();
          return (end - start) / 60000;
        })
        .filter((m: number) => m > 0 && m < 480); // ignore outliers > 8h
      if (waitMins.length > 0) {
        const avg = waitMins.reduce((s: number, v: number) => s + v, 0) / waitMins.length;
        setAvgWaitTime(avg < 60 ? `${Math.round(avg)} min` : `${Math.round(avg / 60)}h ${Math.round(avg % 60)}m`);
      }
    }

    // ── BUG FIX 2: Use local `total` not `totalRevenue` state (still 0 here) ──
    const busiest = trafficResult.reduce(
      (max, day) => day.patients > max.patients ? day : max,
      trafficResult[0]
    );
    setAiInsight(
      busiest?.patients > 0
        ? `${busiest.name} was your busiest day with ${busiest.patients} patients. 7-day revenue: ₹${total.toLocaleString('en-IN')}.`
        : 'Start seeing patients to generate insights here!'
    );

    setLoading(false);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-24 space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-40 bg-slate-200 rounded-xl" />
            <div className="h-4 w-52 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-10 w-44 bg-slate-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-64 bg-slate-200 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const todayPatients = trafficData[trafficData.length - 1]?.patients ?? 0;
  const qrCount = checkinChannelData.find(c => c.name === 'QR Check-In')?.count ?? 0;

  return (
    // BUG FIX 3: removed conflicting max-w-full that was overriding max-w-7xl
    <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-24 md:pb-10 space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-slate-400 mt-0.5 text-sm font-medium">Last 7 days · Live data</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-indigo-500/25"
        >
          {downloading
            ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
            : <><Download size={15} /> Download Report</>}
        </button>
      </div>

      {/* ── AI Insight strip ── */}
      {aiInsight && (
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-5 py-4 shadow-lg shadow-indigo-500/20">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <p className="text-sm text-white font-semibold leading-relaxed">{aiInsight}</p>
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={<IndianRupee size={18} />}
          label="7-Day Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          accent="#6366f1"
          bg="from-indigo-50 to-violet-50"
          border="border-indigo-100"
        />
        <MetricCard
          icon={<Users size={18} />}
          label="7-Day Patients"
          value={String(totalPatients)}
          accent="#0891b2"
          bg="from-cyan-50 to-sky-50"
          border="border-cyan-100"
        />
        <MetricCard
          icon={<Clock size={18} />}
          label="Avg Wait"
          value={avgWaitTime}
          accent="#f59e0b"
          bg="from-amber-50 to-yellow-50"
          border="border-amber-100"
        />
        <MetricCard
          icon={<Smartphone size={18} />}
          label="QR Check-Ins"
          value={String(qrCount)}
          accent="#10b981"
          bg="from-emerald-50 to-teal-50"
          border="border-emerald-100"
        />
      </div>

      {/* ── Charts grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Patient Traffic — Area chart (more modern than bars) */}
        <ChartCard
          title="Patient Traffic"
          subtitle="Daily visits over 7 days"
          icon={<TrendingUp size={14} className="text-indigo-500" />}
          accent="#6366f1"
        >
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={trafficData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<DarkTooltip />} />
              <Area type="monotone" dataKey="patients" stroke="#6366f1" strokeWidth={2.5}
                fill="url(#trafficGrad)" dot={false} activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue Trend — Area chart */}
        <ChartCard
          title="Revenue Trend"
          subtitle="Daily collections (₹)"
          icon={<IndianRupee size={14} className="text-emerald-500" />}
          accent="#10b981"
        >
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={revenueData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36}
                tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : String(v)} />
              <Tooltip content={<DarkTooltip prefix="₹" />} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5}
                fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Diagnosis Mix */}
        <ChartCard
          title="Diagnosis Mix"
          subtitle="Most frequent diagnoses"
          icon={<Activity size={14} className="text-pink-500" />}
          accent="#ec4899"
        >
          {diagnosisData.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Mobile: bar list */}
              <div className="block md:hidden space-y-2 py-2">
                {diagnosisData.map((item, i) => {
                  const total = diagnosisData.reduce((s, d) => s + d.value, 0);
                  const pct = Math.round((item.value / total) * 100);
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-600 truncate max-w-[65%]">{item.name}</span>
                        <span className="text-xs font-black text-slate-500">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop: donut */}
              <div className="hidden md:block">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={diagnosisData} cx="50%" cy="45%" innerRadius={52} outerRadius={82}
                      dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {diagnosisData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={7}
                      formatter={(v) => <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </ChartCard>

        {/* Revenue by Payment */}
        <ChartCard
          title="Payment Methods"
          subtitle="Revenue split by payment type"
          icon={<IndianRupee size={14} className="text-violet-500" />}
          accent="#8b5cf6"
        >
          {revenueByPayment.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Payment method legend pills */}
              <div className="flex flex-wrap gap-2 mb-3">
                {revenueByPayment.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold"
                    style={{
                      borderColor: (PAYMENT_COLORS[entry.name] || '#6366f1') + '40',
                      background: (PAYMENT_COLORS[entry.name] || '#6366f1') + '12',
                      color: PAYMENT_COLORS[entry.name] || '#6366f1',
                    }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: PAYMENT_COLORS[entry.name] || '#6366f1' }} />
                    {entry.name} · ₹{Number(entry.value).toLocaleString('en-IN')}
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={revenueByPayment} cx="50%" cy="45%" innerRadius={52} outerRadius={82}
                    dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {revenueByPayment.map((entry, i) => (
                      <Cell key={i} fill={PAYMENT_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </ChartCard>

        {/* Check-In Channels — styled horizontal bars */}
        <ChartCard
          title="Check-In Channels"
          subtitle="How patients register"
          icon={<QrCode size={14} className="text-blue-500" />}
          accent="#3b82f6"
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={checkinChannelData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} width={78} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                  {checkinChannelData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Channel summary cards */}
            <div className="flex flex-col gap-3">
              {checkinChannelData.map(ch => {
                const total = checkinChannelData.reduce((s, c) => s + c.count, 0);
                const pct = total > 0 ? Math.round((ch.count / total) * 100) : 0;
                return (
                  <div key={ch.name} className="flex items-center gap-4 p-3.5 rounded-xl border"
                    style={{ borderColor: ch.color + '30', background: ch.color + '08' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: ch.color + '20' }}>
                      {ch.name === 'QR Check-In' ? <QrCode size={18} style={{ color: ch.color }} /> : <Users size={18} style={{ color: ch.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-700">{ch.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ch.color }} />
                        </div>
                        <span className="text-xs font-black shrink-0" style={{ color: ch.color }}>{pct}%</span>
                      </div>
                    </div>
                    <p className="text-2xl font-black tabular-nums" style={{ color: ch.color }}>{ch.count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>

      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const MetricCard = ({
  icon, label, value, accent, bg, border,
}: {
  icon: React.ReactNode; label: string; value: string;
  accent: string; bg: string; border: string;
}) => (
  <div className={`relative overflow-hidden p-4 md:p-5 rounded-2xl border bg-gradient-to-br ${bg} ${border} flex flex-col gap-3`}>
    <div className="flex items-center justify-between">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: accent + '20', color: accent }}>
        {icon}
      </div>
      <ArrowUpRight size={14} style={{ color: accent + '80' }} />
    </div>
    <div>
      <p className="text-xs font-bold text-slate-400 mb-0.5">{label}</p>
      <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{value}</p>
    </div>
    {/* subtle accent corner blob */}
    <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full opacity-10"
      style={{ background: accent }} />
  </div>
);

const ChartCard = ({
  title, subtitle, icon, accent, children, className = '',
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  accent: string; children: React.ReactNode; className?: string;
}) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
    {/* accent top bar */}
    <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}44)` }} />
    <div className="px-5 pt-4 pb-3 flex-shrink-0 border-b border-slate-50">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + '15' }}>
          {icon}
        </div>
        <div>
          <h3 className="font-black text-slate-900 text-sm leading-tight">{title}</h3>
          <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>
    </div>
    <div className="p-4 flex-1 overflow-hidden">{children}</div>
  </div>
);

const EmptyState = () => (
  <div className="h-48 flex flex-col items-center justify-center gap-2">
    <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center">
      <Activity size={18} className="text-slate-300" />
    </div>
    <p className="text-sm font-bold text-slate-300">No data yet</p>
  </div>
);

export default AnalyticsDashboard;