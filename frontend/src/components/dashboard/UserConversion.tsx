import React from 'react';
import { UserConversionData } from '../../services/dashboard';

interface UserConversionProps {
  data: UserConversionData[];
}

export default function UserConversion({ data }: UserConversionProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">User-wise Conversion</h3>
        <p className="text-sm text-gray-500 text-center py-8">No users with assigned leads</p>
      </div>
    );
  }

  const maxLeads = Math.max(...data.map((u) => u.totalLeads), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="font-semibold text-gray-900 mb-4">User-wise Conversion</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Leads</th>
              <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Contacted</th>
              <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Qualified</th>
              <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Converted</th>
              <th className="text-center py-3 px-2 text-xs font-medium text-gray-500 uppercase">Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((user) => (
              <tr key={user.userId} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 px-2">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-sm font-medium text-primary-700">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="text-sm font-semibold text-gray-900">{user.totalLeads}</span>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-gray-700">{user.contactedLeads}</span>
                    <span className="text-xs text-gray-500">{user.contactRate}%</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-gray-700">{user.leadsWithStatus}</span>
                    <span className="text-xs text-gray-500">{user.qualifiedRate}%</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-gray-700">{user.convertedLeads}</span>
                    <span className="text-xs text-gray-500">{user.conversionRate}%</span>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 mr-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${user.conversionRate}%`,
                          backgroundColor: user.conversionRate >= 50 ? '#10B981' : user.conversionRate >= 25 ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-10 text-right">
                      {user.conversionRate}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
