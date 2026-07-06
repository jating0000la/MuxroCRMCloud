import React from 'react';
import { SalesFunnelData } from '../../services/dashboard';

interface SalesFunnelProps {
  data: SalesFunnelData;
}

export default function SalesFunnel({ data }: SalesFunnelProps) {
  const funnelStages = [
    { label: 'Total Leads', count: data.totalLeads, color: '#3B82F6', width: '100%' },
    { label: 'Contacted', count: data.contactedLeads, color: '#8B5CF6', width: `${data.contactRate}%` },
    { label: 'Qualified', count: data.leadsWithStatus, color: '#F59E0B', width: `${data.conversionRate}%` },
    ...data.statusFunnel.map((s) => ({
      label: s.status,
      count: s.count,
      color: s.color,
      width: `${s.percentage}%`,
    })),
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <h3 className="font-semibold text-gray-900 mb-4 text-sm">Sales Funnel</h3>

      {/* Funnel Visualization */}
      <div className="space-y-2.5">
        {funnelStages.map((stage, index) => (
          <div key={index} className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">{stage.label}</span>
              <span className="text-sm font-bold text-gray-900">{stage.count}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                style={{
                  width: stage.width || '0%',
                  backgroundColor: stage.color,
                  minWidth: stage.count > 0 ? '40px' : '0px',
                }}
              >
                {stage.count > 0 && (
                  <span className="text-xs font-semibold text-white">
                    {data.totalLeads > 0 ? Math.round((stage.count / data.totalLeads) * 100) : 0}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Rates */}
      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3">
        <div className="text-center">
          <p className="text-xl font-bold text-blue-600">{data.contactRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Contact Rate</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-600">{data.conversionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Conversion Rate</p>
        </div>
      </div>
    </div>
  );
}
