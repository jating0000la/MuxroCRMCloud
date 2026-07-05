import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardService, SalesFunnelData, UserConversionData } from '../../services/dashboard';
import { campaignService } from '../../services/campaigns';
import { DashboardStats, Campaign, Followup } from '../../types';
import Layout from '../../components/layout/Layout';
import SalesFunnel from '../../components/dashboard/SalesFunnel';
import UserConversion from '../../components/dashboard/UserConversion';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentFollowups, setRecentFollowups] = useState<Followup[]>([]);
  const [salesFunnel, setSalesFunnel] = useState<SalesFunnelData | null>(null);
  const [userConversion, setUserConversion] = useState<UserConversionData[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadFunnelAndConversion();
  }, [selectedCampaign]);

  const loadData = async () => {
    setError(null);
    try {
      const [statsData, campaignsData, followupsData, funnelData, conversionData] = await Promise.all([
        dashboardService.getOverview(),
        campaignService.getAll(),
        dashboardService.getFollowupDashboard(),
        dashboardService.getSalesFunnel(),
        dashboardService.getUserConversion(),
      ]);
      setStats(statsData);
      setCampaigns(campaignsData);
      setRecentFollowups(followupsData.slice(0, 5));
      setSalesFunnel(funnelData);
      setUserConversion(conversionData);
    } catch (error) {
      console.error('Failed to load stats', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadFunnelAndConversion = async () => {
    try {
      const campaignParam = selectedCampaign || undefined;
      const [funnelData, conversionData] = await Promise.all([
        dashboardService.getSalesFunnel(campaignParam),
        dashboardService.getUserConversion(campaignParam),
      ]);
      setSalesFunnel(funnelData);
      setUserConversion(conversionData);
    } catch (error) {
      console.error('Failed to load funnel data', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: user?.role === 'USER' ? 'My Campaigns' : 'Total Campaigns',
      value: stats?.totalCampaigns || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      link: '/campaigns',
    },
    {
      label: user?.role === 'USER' ? 'My Leads' : 'Total Leads',
      value: stats?.totalLeads || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      link: '/followups',
    },
    {
      label: user?.role === 'USER' ? 'My Follow-ups' : "Today's Follow-ups",
      value: stats?.todayFollowups || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      link: '/followups',
    },
    ...(user?.role === 'ADMIN'
      ? [
          {
            label: 'Total Users',
            value: stats?.totalUsers || 0,
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ),
            color: 'bg-purple-500',
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-600',
            link: '/admin/users',
          },
        ]
      : []),
  ];

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name}
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your CRM today.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, index) => (
            <Link
              key={index}
              to={card.link}
              className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center ${card.textColor} group-hover:scale-110 transition-transform`}>
                  {card.icon}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Sales Funnel & Conversion Stats */}
        {salesFunnel && (
          <div className="mb-8">
            {/* Campaign Filter */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Sales Funnel & Conversion</h2>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sales Funnel */}
              <div className="lg:col-span-2">
                <SalesFunnel data={salesFunnel} />
              </div>

              {/* Conversion Stats */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Conversion Overview</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700">Total Leads</span>
                      <span className="text-2xl font-bold text-blue-900">{salesFunnel.totalLeads}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-700">Contacted</span>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-purple-900">{salesFunnel.contactedLeads}</span>
                        <span className="text-sm text-purple-600 ml-2">({salesFunnel.contactRate}%)</span>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${salesFunnel.contactRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-amber-700">Qualified</span>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-amber-900">{salesFunnel.leadsWithStatus}</span>
                        <span className="text-sm text-amber-600 ml-2">({salesFunnel.conversionRate}%)</span>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-amber-200 rounded-full h-2">
                      <div
                        className="bg-amber-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${salesFunnel.conversionRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-700">DND</span>
                      <span className="text-2xl font-bold text-red-900">{salesFunnel.dndLeads}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User-wise Conversion */}
        {userConversion.length > 0 && (
          <div className="mb-8">
            <UserConversion data={userConversion} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {user?.role !== 'USER' && (
                <Link
                  to="/campaigns"
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Create Campaign</p>
                    <p className="text-xs text-gray-500">Start a new campaign</p>
                  </div>
                </Link>
              )}
              {user?.role !== 'USER' && (
                <Link
                  to="/followups"
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Import Leads</p>
                    <p className="text-xs text-gray-500">Bulk upload CSV</p>
                  </div>
                </Link>
              )}
              <Link
                to="/followups"
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-600 group-hover:bg-yellow-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{user?.role === 'USER' ? 'View My Follow-ups' : 'Schedule Follow-up'}</p>
                  <p className="text-xs text-gray-500">{user?.role === 'USER' ? 'Check upcoming calls' : 'Plan your next call'}</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Campaigns */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Campaigns</h3>
              <Link to="/campaigns" className="text-sm text-primary-600 hover:text-primary-700">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {campaigns.slice(0, 5).map((campaign) => (
                <Link
                  key={campaign.id}
                  to={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {campaign.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{campaign.name}</p>
                      <p className="text-xs text-gray-500">{campaign._count?.leads || 0} leads</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${campaign.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {campaign.isActive ? 'Active' : 'Inactive'}
                  </span>
                </Link>
              ))}
              {campaigns.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No campaigns yet</p>
              )}
            </div>
          </div>

          {/* Recent Follow-ups */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Follow-ups</h3>
              <Link to="/followups" className="text-sm text-primary-600 hover:text-primary-700">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {recentFollowups.map((followup) => (
                <div key={followup.id} className="p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{followup.lead?.name}</p>
                      <p className="text-xs text-gray-500">{followup.lead?.campaign?.name}</p>
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700">
                      {followup.status}
                    </span>
                  </div>
                  {followup.nextCallDate && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Next: {format(new Date(followup.nextCallDate), 'MMM d, h:mm a')}
                    </p>
                  )}
                </div>
              ))}
              {recentFollowups.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No recent follow-ups</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
