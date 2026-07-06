import React, { useEffect, useState } from 'react';
import { userService } from '../../services/users';
import { User } from '../../types';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DEFAULT_PAGE_SIZE = 50;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'USER',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let result = [...users];
    if (search) {
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.username.toLowerCase().includes(search.toLowerCase()) ||
          u.email?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (roleFilter) {
      result = result.filter((u) => u.role === roleFilter);
    }
    setFilteredUsers(result);
  }, [users, search, roleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getAll();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      setError('Failed to load users. Please try again.');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await userService.create({
        ...formData,
        username: formData.username.trim(),
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
      });
      toast.success('User created successfully');
      setShowModal(false);
      setFormData({ username: '', password: '', name: '', email: '', role: 'USER' });
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (updatingUserId) return;
    if (user.isActive && !confirm(`Deactivate ${user.name}? They will no longer be able to sign in.`)) return;
    setUpdatingUserId(user.id);
    try {
      if (user.isActive) {
        await userService.remove(user.id);
        toast.success('User deactivated');
      } else {
        await userService.update(user.id, { isActive: true });
        toast.success('User activated');
      }
      loadUsers();
    } catch (error) {
      toast.error('Failed to update user');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-700',
    MANAGER: 'bg-yellow-100 text-yellow-700',
    USER: 'bg-green-100 text-green-700',
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
  };

  return (
    <Layout>
      <div className="sleek-page p-3 lg:p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center justify-between">
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={loadUsers} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No users found</h3>
            <p className="text-gray-500 mt-1">
              {search || roleFilter ? 'Try adjusting your filters' : 'Add your first team member'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50/80 px-3 py-2">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                <div className="lg:col-span-4 relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search user"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="lg:col-span-2 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="USER">User</option>
                </select>

                <div className="lg:col-span-6 flex items-center justify-end gap-2 flex-wrap">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button
                    onClick={clearFilters}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                  >
                    Clear
                  </button>
                  <button
                    onClick={loadUsers}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-xs font-semibold"
                  >
                    Add User
                  </button>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                Showing {paginatedUsers.length} of {filteredUsers.length} filtered users ({users.length} total)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            u.role === 'ADMIN' ? 'bg-red-100' :
                            u.role === 'MANAGER' ? 'bg-yellow-100' : 'bg-green-100'
                          }`}>
                            <span className={`text-sm font-semibold ${
                              u.role === 'ADMIN' ? 'text-red-700' :
                              u.role === 'MANAGER' ? 'text-yellow-700' : 'text-green-700'
                            }`}>
                              {u.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900 text-sm leading-tight">{u.name}</p>
                            <p className="text-xs text-gray-500">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[u.role]}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-500">
                        {format(new Date(u.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={updatingUserId === u.id}
                          className={`text-sm font-medium ${
                            u.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                          } disabled:text-gray-400 disabled:cursor-not-allowed`}
                        >
                          {updatingUserId === u.id ? 'Saving...' : u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={filteredUsers.length}
              onPageChange={setPage}
            />
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="johndoe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="USER">User - Dashboard access only</option>
                      <option value="ADMIN">Admin - Full control</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {creating ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
