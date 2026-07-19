import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  dashboardService,
  KpiData,
  CampaignReportData,
  StatusReportData,
  DailyTrendData,
  MissedByUserData,
  UserConversionData,
  SalesFunnelData,
} from '../../services/dashboard';
import { campaignService } from '../../services/campaigns';
import { Followup, Lead, Campaign } from '../../types';
import Layout from '../../components/layout/Layout';
import { format } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const CHART_COLORS = ['#3b82f6', '#06b6d4', '#f97316', '#8b5cf6', '#22c55e', '#6b7280', '#ef4444', '#dc2626'];

function StatCard({ label, value, color, icon, link }: { label: string; value: string | number; color: string; icon: React.ReactNode; link?: string }) {
  const card = (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 shadow-sm hover:shadow-md transition-all h-[100px] flex flex-col justify-between`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80 leading-tight">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black text-white mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
  return link ? <Link to={link} className="block h-full">{card}</Link> : card;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [userConversion, setUserConversion] = useState<UserConversionData[]>([]);
  const [campaignReport, setCampaignReport] = useState<CampaignReportData[]>([]);
  const [statusReport, setStatusReport] = useState<StatusReportData[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendData[]>([]);
  const [missedByUser, setMissedByUser] = useState<MissedByUserData[]>([]);
  const [salesFunnel, setSalesFunnel] = useState<SalesFunnelData | null>(null);
  const [upcomingFollowups, setUpcomingFollowups] = useState<Followup[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);

  const loadKpi = async () => {
    try {
      const data = await dashboardService.getKpi(selectedCampaign || undefined, startDate, endDate);
      setKpi(data);
    } catch {
      // KPI load failure is non-critical
    }
  };

  const loadAlerts = async () => {
    try {
      const data = await dashboardService.getAlerts();
      setAlerts(data);
    } catch {
      // Alerts load failure is non-critical
    }
  };

  const loadSalesFunnel = async () => {
    try {
      const data = await dashboardService.getSalesFunnel(selectedCampaign || undefined);
      setSalesFunnel(data);
    } catch {
      // Sales funnel load failure is non-critical
    }
  };

  const loadUpcomingFollowups = async () => {
    try {
      const data = await dashboardService.getFollowupDashboard(selectedCampaign || undefined);
      setUpcomingFollowups(data.slice(0, 5));
    } catch {
      // Followups load failure is non-critical
    }
  };

  const loadRecentLeads = async () => {
    try {
      const data = await dashboardService.getAllLeadsDashboard(selectedCampaign || undefined);
      setRecentLeads(data.slice(0, 5));
    } catch {
      // Recent leads load failure is non-critical
    }
  };

  const loadUserConversion = async () => {
    try {
      const data = await dashboardService.getUserConversion(selectedCampaign || undefined, startDate, endDate);
      setUserConversion(data);
    } catch {
      // User conversion load failure is non-critical
    }
  };

  const loadCampaignReport = async () => {
    try {
      const data = await dashboardService.getCampaignReport(startDate, endDate);
      setCampaignReport(data);
    } catch {
      // Campaign report load failure is non-critical
    }
  };

  const loadStatusReport = async () => {
    try {
      const data = await dashboardService.getStatusReport(selectedCampaign || undefined);
      setStatusReport(data);
    } catch {
      // Status report load failure is non-critical
    }
  };

  const loadDailyTrend = async () => {
    try {
      const data = await dashboardService.getDailyTrend(selectedCampaign || undefined, startDate, endDate);
      setDailyTrend(data);
    } catch {
      // Daily trend load failure is non-critical
    }
  };

  const loadMissedByUser = async () => {
    try {
      const data = await dashboardService.getMissedByUser(selectedCampaign || undefined);
      setMissedByUser(data);
    } catch {
      // Missed by user load failure is non-critical
    }
  };

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const campaignList = await campaignService.getAll();
      setCampaigns(campaignList);

      await Promise.allSettled([
        loadKpi(),
        loadAlerts(),
        loadSalesFunnel(),
        loadUserConversion(),
        loadCampaignReport(),
        loadStatusReport(),
        loadDailyTrend(),
        loadMissedByUser(),
        loadUpcomingFollowups(),
        loadRecentLeads(),
      ]);
    } catch (err) {
      // Dashboard load errors are handled per-section
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCampaign, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    loadAll();
    return () => { cancelled = true; };
  }, [loadAll]);

  const dedupedStatusReport = useMemo(() => {
    const map = new Map<string, StatusReportData>();
    statusReport.forEach((s) => {
      const key = s.label;
      if (map.has(key)) {
        const existing = map.get(key)!;
        map.set(key, { ...existing, count: existing.count + s.count });
      } else {
        map.set(key, { ...s });
      }
    });
    return Array.from(map.values());
  }, [statusReport]);

  const dedupedCampaignReport = useMemo(() => {
    const map = new Map<string, CampaignReportData>();
    campaignReport.forEach((c) => {
      if (map.has(c.campaignId)) {
        const existing = map.get(c.campaignId)!;
        map.set(c.campaignId, {
          ...existing,
          totalLeads: existing.totalLeads + c.totalLeads,
          converted: existing.converted + c.converted,
          lost: existing.lost + c.lost,
        });
      } else {
        map.set(c.campaignId, { ...c });
      }
    });
    return Array.from(map.values());
  }, [campaignReport]);

  const funnelData = useMemo(() => {
    const raw = salesFunnel?.statusFunnel?.map(item => ({
      name: item.status,
      value: item.count,
      fill: item.color,
    })) ?? [
      { name: 'New Lead', value: kpi?.totalLeads ?? 0, fill: '#3b82f6' },
      { name: 'Contacted', value: Math.round((kpi?.totalLeads ?? 0) * 0.7), fill: '#06b6d4' },
      { name: 'Follow-up', value: Math.round((kpi?.totalLeads ?? 0) * 0.45), fill: '#f97316' },
      { name: 'Qualified', value: Math.round((kpi?.totalLeads ?? 0) * 0.25), fill: '#8b5cf6' },
      { name: 'Won', value: kpi?.wonDeals ?? 0, fill: '#22c55e' },
    ];
    const map = new Map<string, typeof raw[number]>();
    raw.forEach((item) => {
      if (map.has(item.name)) {
        map.get(item.name)!.value += item.value;
      } else {
        map.set(item.name, { ...item });
      }
    });
    return Array.from(map.values());
  }, [salesFunnel, kpi]);

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center h-96">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const kpiCards = [
    {
      label: 'Total Leads',
      value: kpi?.totalLeads ?? 0,
      color: 'from-blue-600 to-blue-500',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      link: '/leads',
    },
    {
      label: "Today's New Leads",
      value: kpi?.todayNewLeads ?? 0,
      color: 'from-cyan-600 to-cyan-500',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
    },
    {
      label: 'Due Follow-ups',
      value: kpi?.dueFollowups ?? 0,
      color: 'from-orange-500 to-amber-500',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      link: '/followups',
    },
    {
      label: 'Missed Follow-ups',
      value: kpi?.missedFollowups ?? 0,
      color: 'from-red-600 to-red-500',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
      link: '/followups',
    },
    {
      label: 'Won Deals',
      value: kpi?.wonDeals ?? 0,
      color: 'from-emerald-600 to-emerald-500',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Conversion %',
      value: `${kpi?.overallConversion ?? 0}%`,
      color: 'from-purple-600 to-purple-500',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-5">

          {/* ── Header + Filters ─────────────────────────────── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(), 'EEEE, MMMM d, yyyy')} • {user?.role === 'ADMIN' ? 'Administrator' : 'Team Member'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500" />
                <button onClick={loadAll} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50">
                  <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh
                </button>
              </div>
            </div>
          </section>

          {/* ── Alerts ───────────────────────────────────────── */}
          {alerts.length > 0 && (
            <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Business Alerts</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {alerts.map((alert, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-800/40 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">{alert}</span>
                ))}
              </div>
            </section>
          )}

          {/* ── KPI Cards ────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 [grid-auto-rows:1fr]">
            {kpiCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          {/* ── Charts Row ───────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* ── Daily Trend (Line Chart) ────────────────── */}
            <section className="xl:col-span-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Daily Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="colorNewLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMissed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => format(new Date(v), 'MMM d')} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')} />
                    <Legend />
                    <Area type="monotone" dataKey="newLeads" name="New Leads" stroke="#3b82f6" fill="url(#colorNewLeads)" strokeWidth={2} />
                    <Area type="monotone" dataKey="convertedLeads" name="Converted" stroke="#22c55e" fill="url(#colorConverted)" strokeWidth={2} />
                    <Area type="monotone" dataKey="missedFollowups" name="Missed" stroke="#ef4444" fill="url(#colorMissed)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── Sales Funnel ─────────────────────────────── */}
            <section className="xl:col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Sales Funnel</h3>
              <div className="space-y-3">
                {funnelData.map((item, i) => {
                  const maxVal = funnelData[0].value || 1;
                  const pct = Math.round((item.value / maxVal) * 100);
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{item.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div className="h-3 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: item.fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ── Charts Row 2 ─────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* ── User-wise Conversion (Bar Chart) ────────── */}
            <section className="xl:col-span-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">User-wise Conversion</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userConversion} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="conversionRate" name="Conversion %" radius={[0, 4, 4, 0]}>
                      {userConversion.map((entry, i) => (
                        <Cell key={i} fill={entry.conversionRate >= 40 ? '#22c55e' : entry.conversionRate >= 20 ? '#f97316' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── Status-wise (Doughnut) ──────────────────── */}
            <section className="xl:col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dedupedStatusReport}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="label"
                    >
                      {dedupedStatusReport.map((entry, i) => (
                        <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── Missed Follow-ups by User ───────────────── */}
            <section className="xl:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Missed Follow-ups</h3>
              <div className="space-y-2 overflow-y-auto max-h-64">
                {missedByUser.length > 0 ? (
                  missedByUser.map((row) => (
                    <div key={row.userId} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.userName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">@{row.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{row.missedCount}</p>
                        <p className="text-[10px] text-red-500 dark:text-red-300">Oldest: {row.oldestPending ? format(new Date(row.oldestPending), 'MMM d') : '-'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-sm text-gray-400">No missed follow-ups</p>
                )}
              </div>
            </section>
          </div>

          {/* ── Campaign Report Table + Chart ────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Campaign-wise Report</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dedupedCampaignReport}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="campaignName" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="converted" name="Converted" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lost" name="Lost" fill="#6b7280" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Campaign Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Campaign</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Leads</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Converted</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Lost</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dedupedCampaignReport.map((row) => (
                      <tr key={row.campaignId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{row.campaignName}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{row.totalLeads}</td>
                        <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{row.converted}</td>
                        <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{row.lost}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                            row.conversionRate >= 40 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            row.conversionRate >= 20 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>{row.conversionRate}%</span>
                        </td>
                      </tr>
                    ))}
                    {dedupedCampaignReport.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-6 text-gray-400">No campaign data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* ── User-wise Performance Table ─────────────────── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">User-wise Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">User</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total Leads</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Contacted</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qualified</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Converted</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Conv %</th>
                  </tr>
                </thead>
                <tbody>
                  {userConversion.map((row) => (
                    <tr key={row.userId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{row.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">@{row.username}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{row.totalLeads}</td>
                      <td className="px-3 py-2 text-right text-cyan-600 dark:text-cyan-400">{row.contactedLeads}</td>
                      <td className="px-3 py-2 text-right text-purple-600 dark:text-purple-400">{row.leadsWithStatus}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{row.convertedLeads}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                          row.conversionRate >= 40 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          row.conversionRate >= 20 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>{row.conversionRate}%</span>
                      </td>
                    </tr>
                  ))}
                  {userConversion.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-gray-400">No user data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Upcoming Follow-ups + Recent Leads ──────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Upcoming Follow-ups</h3>
                <Link to="/followups" className="text-xs font-semibold text-primary-600 hover:text-primary-700">View All</Link>
              </div>
              <div className="space-y-2">
                {upcomingFollowups.length > 0 ? (
                  upcomingFollowups.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.lead?.name || 'Unknown Lead'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{f.user?.name || 'Unassigned'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">{f.nextCallDate ? format(new Date(f.nextCallDate), 'MMM d, h:mm a') : 'No date'}</p>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">{f.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-sm text-gray-400">No upcoming follow-ups</p>
                )}
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Recent Leads</h3>
                <Link to="/leads" className="text-xs font-semibold text-primary-600 hover:text-primary-700">View All</Link>
              </div>
              <div className="space-y-2">
                {recentLeads.length > 0 ? (
                  recentLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{lead.phone || lead.email || 'No contact'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{lead.campaign?.name || '-'}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          lead.dnd ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          lead.status ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>{lead.dnd ? 'DND' : lead.status?.label || 'New'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-sm text-gray-400">No recent leads</p>
                )}
              </div>
            </section>
          </div>

        </div>
      </div>
    </Layout>
  );
}
