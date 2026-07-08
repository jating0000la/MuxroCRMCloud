import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { dashboardService, UserConversionData } from '../../services/dashboard';
import { campaignService } from '../../services/campaigns';
import { DashboardStats, Campaign, Followup } from '../../types';
import Layout from '../../components/layout/Layout';
import { format } from 'date-fns';
import { downloadCsv } from '../../utils/csv';

export default function DashboardPage() {
  const { user } = useAuth();
  const { syncWithDelay } = useNotifications();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentFollowups, setRecentFollowups] = useState<Followup[]>([]);
  const [userConversion, setUserConversion] = useState<UserConversionData[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadUserReport();
  }, [selectedCampaign, startDate, endDate]);

  const loadData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [statsData, campaignsData, followupsData] = await Promise.all([
        dashboardService.getOverview(),
        campaignService.getAll(),
        dashboardService.getFollowupDashboard(),
      ]);
      setStats(statsData);
      setCampaigns(campaignsData);
      setRecentFollowups(followupsData.slice(0, 5));
      setLastUpdated(new Date());
      syncWithDelay(500); // Sync notifications after dashboard data loads
    } catch (error) {
      console.error('Failed to load stats', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserReport = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const campaignParam = selectedCampaign || undefined;
      const conversionData = await dashboardService.getUserConversion(campaignParam, startDate, endDate);
      setUserConversion(conversionData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load user report', error);
      setAnalyticsError('User-wise report could not be loaded. Please retry.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

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

  if (error) {
    return (
      <Layout>
        <div className="p-6 lg:p-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-400 font-medium">{error}</span>
            </div>
            <button onClick={loadData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors">
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    {
      label: user?.role === 'USER' ? 'My Campaigns' : 'Total Campaigns',
      value: stats?.totalCampaigns || 0,
      iconPath: 'M9 17v-6m4 6V7m4 10V4M5 20h14',
      accent: 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white',
      cardBg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      borderColor: 'border-blue-100 dark:border-blue-800',
      note: 'Campaign overview',
      link: '/campaigns',
    },
    {
      label: user?.role === 'USER' ? 'My Leads' : 'Total Leads',
      value: stats?.totalLeads || 0,
      iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      accent: 'bg-gradient-to-br from-indigo-600 to-violet-500 text-white',
      cardBg: 'from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20',
      borderColor: 'border-indigo-100 dark:border-indigo-800',
      note: 'Lead inventory',
      link: '/followups',
    },
    {
      label: user?.role === 'USER' ? 'My Follow-ups' : "Today's Follow-ups",
      value: stats?.todayFollowups || 0,
      iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      accent: 'bg-gradient-to-br from-emerald-600 to-teal-500 text-white',
      cardBg: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20',
      borderColor: 'border-emerald-100 dark:border-emerald-800',
      note: user?.role === 'USER' ? 'Action queue' : 'Today focus',
      link: '/followups',
    },
    ...(user?.role === 'ADMIN'
      ? [
          {
            label: 'Total Users',
            value: stats?.totalUsers || 0,
            iconPath: 'M16 14a4 4 0 10-8 0m8 0v1a3 3 0 01-3 3H11a3 3 0 01-3-3v-1m11 5v-1a4 4 0 00-4-4h-6a4 4 0 00-4 4v1',
            accent: 'bg-gradient-to-br from-rose-600 to-orange-500 text-white',
            cardBg: 'from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20',
            borderColor: 'border-rose-100 dark:border-rose-800',
            note: 'Team strength',
            link: '/admin/users',
          },
        ]
      : []),
  ];

  const roleLabel = user?.role === 'ADMIN' ? 'Administrator' : 'Team Member';
  const selectedCampaignName = campaigns.find((c) => c.id === selectedCampaign)?.name;

  const applyDatePreset = (preset: 'today' | '7d' | '30d' | 'month') => {
    const now = new Date();
    const end = format(now, 'yyyy-MM-dd');
    if (preset === 'today') {
      setStartDate(end);
      setEndDate(end);
      return;
    }
    if (preset === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(monthStart, 'yyyy-MM-dd'));
      setEndDate(end);
      return;
    }
    const start = new Date(now);
    start.setDate(now.getDate() - (preset === '7d' ? 6 : 29));
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(end);
  };

  const exportUserReport = () => {
    const headers = ['User', 'Username', 'Total Leads', 'Converted', 'Conversion Ratio'];
    const rows = userConversion.map((row) => [row.name, row.username, row.totalLeads, row.convertedLeads, `${row.conversionRate}%`]);
    downloadCsv(`user-conversion-report-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
  };

  return (
    <Layout>
      <div className="sleek-page min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_transparent_35%),radial-gradient(circle_at_top_right,_#fce7f3_0%,_transparent_35%),radial-gradient(circle_at_bottom_left,_#dcfce7_0%,_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] dark:bg-[radial-gradient(circle_at_top_left,_#1e293b_0%,_transparent_35%),radial-gradient(circle_at_top_right,_#312e81_0%,_transparent_35%),radial-gradient(circle_at_bottom_left,_#064e3b_0%,_transparent_30%),linear-gradient(to_bottom,_#111827,_#1f2937)]">
        <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
          <section className="rounded-2xl border border-cyan-100 dark:border-cyan-800 bg-gradient-to-r from-cyan-50/90 via-sky-50/90 to-blue-50/90 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 backdrop-blur px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-400 font-bold">Daily Control Panel</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-gray-300 font-medium">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')} • {roleLabel}
                </p>
                {lastUpdated && (
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Last updated: {format(lastUpdated, 'MMM d, yyyy h:mm a')}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full lg:w-auto">
                <div className="min-w-0 sm:col-span-2 lg:col-span-1 lg:w-64">
                  <select
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    disabled={analyticsLoading}
                    className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-gray-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-slate-100"
                  >
                    <option value="">All campaigns</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-gray-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-gray-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />

                <button
                  onClick={loadData}
                  disabled={refreshing}
                  className="inline-flex items-center justify-center rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-cyan-800 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 disabled:opacity-60"
                >
                  <svg className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button onClick={() => applyDatePreset('today')} className="px-2.5 py-1 text-xs font-semibold border border-cyan-200 dark:border-cyan-800 rounded-md bg-white dark:bg-gray-800 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30">Today</button>
              <button onClick={() => applyDatePreset('7d')} className="px-2.5 py-1 text-xs font-semibold border border-cyan-200 dark:border-cyan-800 rounded-md bg-white dark:bg-gray-800 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30">7D</button>
              <button onClick={() => applyDatePreset('30d')} className="px-2.5 py-1 text-xs font-semibold border border-cyan-200 dark:border-cyan-800 rounded-md bg-white dark:bg-gray-800 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30">30D</button>
              <button onClick={() => applyDatePreset('month')} className="px-2.5 py-1 text-xs font-semibold border border-cyan-200 dark:border-cyan-800 rounded-md bg-white dark:bg-gray-800 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30">This Month</button>
            </div>
          </section>

          {analyticsError && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
                <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{analyticsError}</span>
              </div>
              <button onClick={loadUserReport} className="rounded-lg bg-amber-200 dark:bg-amber-700 px-3 py-1 text-xs font-semibold text-amber-900 dark:text-amber-300 hover:bg-amber-300 dark:hover:bg-amber-600">
                Retry
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <section className="xl:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {statCards.map((card, index) => (
                  <Link
                    key={index}
                    to={card.link}
                    className={`rounded-xl border bg-gradient-to-br ${card.cardBg} ${card.borderColor} p-4 shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-300">{card.label}</p>
                      <div className={`${card.accent} rounded-md p-1.5`}>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.iconPath} />
                        </svg>
                      </div>
                    </div>
                    <p className="mt-3 text-3xl font-black text-slate-900 dark:text-gray-100">{card.value.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-gray-300">{card.note}</p>
                  </Link>
                ))}
              </div>

              <section className="rounded-2xl border border-indigo-100 dark:border-indigo-800 bg-gradient-to-b from-indigo-50/60 to-white dark:from-indigo-900/20 dark:to-gray-800 p-4 shadow-sm">
                <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <h2 className="text-base font-bold text-indigo-900 dark:text-indigo-300">User-wise Conversion Report</h2>
                    <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80">
                      {selectedCampaignName ? `Campaign: ${selectedCampaignName}` : 'All campaigns'} • {startDate} to {endDate}
                    </p>
                  </div>
                  <button
                    onClick={loadUserReport}
                    disabled={analyticsLoading}
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 disabled:opacity-50"
                  >
                    Refresh report
                  </button>
                </div>
                <div className="mb-2 flex justify-end">
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={exportUserReport}
                      disabled={userConversion.length === 0}
                      className="px-2.5 py-1 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 rounded-md bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                  )}
                </div>

                {analyticsLoading ? (
                  <div className="h-56 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-xs text-slate-500 dark:text-gray-400">Loading user-wise report...</p>
                    </div>
                  </div>
                ) : userConversion.length === 0 ? (
                  <div className="h-56 rounded-xl border border-dashed border-slate-300 dark:border-gray-600 bg-slate-50 dark:bg-gray-900/50 flex items-center justify-center">
                    <p className="text-sm text-slate-500 dark:text-gray-400">No report data found for selected filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-indigo-100 dark:border-indigo-800 rounded-xl bg-white dark:bg-gray-800">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-gradient-to-r from-indigo-100 to-cyan-100 dark:from-indigo-900/30 dark:to-cyan-900/30 border-b border-indigo-200 dark:border-indigo-800">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">User</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Total Leads</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Converted</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Conversion Ratio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userConversion.map((row) => (
                          <tr key={row.userId} className="border-b border-indigo-50 dark:border-gray-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{row.name}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">@{row.username}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800 dark:text-gray-200">{row.totalLeads}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800 dark:text-gray-200">{row.convertedLeads}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex items-center justify-end rounded-md border px-2.5 py-1 text-xs font-bold ${
                                row.conversionRate >= 40
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : row.conversionRate >= 20
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              }`}>
                                {row.conversionRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </section>

            <aside className="xl:col-span-4 space-y-4">
              <section className="rounded-2xl border border-emerald-100 dark:border-emerald-800 bg-gradient-to-b from-emerald-50/70 to-white dark:from-emerald-900/20 dark:to-gray-800 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Recent Follow-ups</h3>
                  <Link to="/followups" className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 uppercase tracking-wide">
                    View all
                  </Link>
                </div>

                <div className="space-y-2">
                  {recentFollowups.length > 0 ? (
                    recentFollowups.map((followup, idx) => (
                      <div key={idx} className="rounded-lg border border-emerald-100 dark:border-emerald-800 bg-white dark:bg-gray-800 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 truncate">Follow-up #{idx + 1}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Updated in activity queue</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                            followup.status === 'Completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                            followup.status === 'Pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                            'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                          }`}>
                            {followup.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-6 text-sm text-slate-500 dark:text-gray-400">No recent follow-ups</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}
