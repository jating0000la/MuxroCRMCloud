import React, { useEffect, useState } from 'react';
import { userService } from '../../services/users';
import { User } from '../../types';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DEFAULT_PAGE_SIZE = 50;

type ModalMode = 'create' | 'edit' | 'reset-password' | 'delete' | null;

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800',
  USER: 'bg-green-100 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-800',
};

const roleAvatarColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  USER: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ username: '', password: '', name: '', email: '', role: 'USER' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    let result = [...users];
    const q = search.toLowerCase();
    if (search) result = result.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    if (roleFilter) result = result.filter(u => u.role === roleFilter);
    if (statusFilter === 'active') result = result.filter(u => u.isActive);
    if (statusFilter === 'inactive') result = result.filter(u => !u.isActive);
    setFilteredUsers(result);
    setPage(1);
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const loadUsers = async () => {
    setLoading(true); setError(null);
    try { const data = await userService.getAll(); setUsers(data); }
    catch { setError('Failed to load users.'); toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setFormData({ username: '', password: '', name: '', email: '', role: 'USER' }); setSelectedUser(null); setModalMode('create'); };
  const openEdit = (u: User) => { setFormData({ username: u.username, password: '', name: u.name, email: u.email || '', role: u.role }); setSelectedUser(u); setModalMode('edit'); };
  const openResetPassword = (u: User) => { setSelectedUser(u); setNewPassword(''); setConfirmPassword(''); setShowNewPwd(false); setModalMode('reset-password'); };
  const openDelete = (u: User) => { setSelectedUser(u); setModalMode('delete'); };
  const closeModal = () => { setModalMode(null); setSelectedUser(null); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); if (saving) return; setSaving(true);
    try {
      await userService.create({ ...formData, name: formData.name.trim(), username: formData.username.trim(), email: formData.email.trim() || undefined });
      toast.success('User created successfully'); closeModal(); loadUsers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to create user'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedUser || saving) return; setSaving(true);
    try {
      const payload: any = { name: formData.name.trim(), email: formData.email.trim() || undefined, role: formData.role };
      if (formData.username.trim() !== selectedUser.username) payload.username = formData.username.trim();
      await userService.update(selectedUser.id, payload);
      toast.success('User updated'); closeModal(); loadUsers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to update user'); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); if (saving) return;
    if (newPassword.length < 6) { toast.error('Min 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try { await userService.resetPassword(selectedUser!.id, newPassword); toast.success('Password reset'); closeModal(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed to reset password'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (u: User) => {
    if (togglingUserId) return; setTogglingUserId(u.id);
    try {
      if (u.isActive) { await userService.remove(u.id); toast.success(`${u.name} deactivated`); }
      else { await userService.update(u.id, { isActive: true }); toast.success(`${u.name} activated`); }
      loadUsers();
    } catch { toast.error('Failed to update user'); }
    finally { setTogglingUserId(null); }
  };

  const handlePermanentDelete = async () => {
    if (!selectedUser || saving) return; setSaving(true);
    try { await userService.permanentDelete(selectedUser.id); toast.success(`${selectedUser.name} deleted`); closeModal(); loadUsers(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setSaving(false); }
  };

  const stats = {
    total: users.length, active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    teamUsers: users.filter(u => u.role === 'USER').length,
  };

  return (
    <Layout>
      <div className="sleek-page p-3 lg:p-4 space-y-4">
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Total', value: stats.total, cls: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-gray-900/50 dark:border-gray-700 dark:text-gray-300' },
              { label: 'Active', value: stats.active, cls: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' },
              { label: 'Inactive', value: stats.inactive, cls: 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-900/50 dark:border-gray-700 dark:text-gray-400' },
              { label: 'Admins', value: stats.admins, cls: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' },
              { label: 'Users', value: stats.teamUsers, cls: 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-900/20 dark:border-primary-800 dark:text-primary-400' },
            ].map(s => (
              <div key={s.label} className={`${s.cls} rounded-xl border px-3 py-3 text-center`}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs font-medium opacity-70 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between dark:bg-red-900/20 dark:border-red-800">
            <span className="text-red-700 text-sm dark:text-red-400">{error}</span>
            <button onClick={loadUsers} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm dark:bg-red-900/30 dark:text-red-400">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-b dark:border-gray-700 dark:bg-gray-900/50">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" placeholder="Search name, username, email" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400" />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                  <option value="">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="USER">User</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                  <option value={25}>25/page</option>
                  <option value={50}>50/page</option>
                  <option value={100}>100/page</option>
                </select>
                <button onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Clear</button>
                <button onClick={loadUsers} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 flex items-center gap-1 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh
                </button>
                <button onClick={openCreate} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-xs font-semibold">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add User
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{paginatedUsers.length} of {filteredUsers.length} users ({users.length} total)</div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm dark:text-gray-500">No users match filters</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">User</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Email</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Role</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Joined</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {paginatedUsers.map(u => (
                      <tr key={u.id} className={`hover:bg-gray-50/70 transition-colors dark:hover:bg-gray-700/50 ${!u.isActive ? 'opacity-55' : ''}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${roleAvatarColors[u.role] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm dark:text-gray-100">{u.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">{u.email || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleColors[u.role]}`}>{u.role}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`} />
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <ActionBtn onClick={() => openEdit(u)} title="Edit user" color="blue">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </ActionBtn>
                            <ActionBtn onClick={() => openResetPassword(u)} title="Reset password" color="amber">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            </ActionBtn>
                            <ActionBtn onClick={() => handleToggleActive(u)} title={u.isActive ? 'Deactivate' : 'Activate'} color={u.isActive ? 'orange' : 'green'} disabled={saving}>
                              {u.isActive
                                ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              }
                            </ActionBtn>
                            <ActionBtn onClick={() => openDelete(u)} title="Delete permanently" color="red">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </ActionBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={currentPage} pageSize={pageSize} totalItems={filteredUsers.length} onPageChange={setPage} />
          </div>
        )}
      </div>

      {modalMode === 'create' && (
        <Modal title="Add New User" onClose={closeModal}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Full Name *"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="John Doe" required /></Field>
            <Field label="Username *"><input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="input" placeholder="johndoe" required /></Field>
            <Field label="Password *"><input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="input" placeholder="Min 6 characters" required minLength={6} /></Field>
            <Field label="Email"><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="input" placeholder="john@example.com" /></Field>
            <Field label="Role *">
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="input">
                <option value="USER">User — Follow-up access only</option>
                <option value="ADMIN">Admin — Full control</option>
              </select>
            </Field>
            <ModalFooter onCancel={closeModal} saving={saving} label="Create User" />
          </form>
        </Modal>
      )}

      {modalMode === 'edit' && selectedUser && (
        <Modal title={`Edit — ${selectedUser.name}`} onClose={closeModal}>
          <form onSubmit={handleEdit} className="space-y-4">
            <Field label="Full Name *"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" required /></Field>
            <Field label="Username *"><input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="input" required /></Field>
            <Field label="Email"><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="input" /></Field>
            <Field label="Role *">
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="input">
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            <ModalFooter onCancel={closeModal} saving={saving} label="Save Changes" />
          </form>
        </Modal>
      )}

      {modalMode === 'reset-password' && selectedUser && (
        <Modal title={`Reset Password — ${selectedUser.name}`} onClose={closeModal}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
              Resetting password for <strong>@{selectedUser.username}</strong>. They must use the new password to log in.
            </div>
            <Field label="New Password *">
              <div className="relative">
                <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input pr-10" placeholder="Min 6 characters" required minLength={6} />
                <button type="button" onClick={() => setShowNewPwd(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showNewPwd
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                    }
                  </svg>
                </button>
              </div>
            </Field>
            <Field label="Confirm Password *">
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className={`input ${confirmPassword && confirmPassword !== newPassword ? 'border-red-400 dark:border-red-500' : ''}`} placeholder="Repeat password" required />
              {confirmPassword && confirmPassword !== newPassword && <p className="text-xs text-red-600 mt-1 dark:text-red-400">Passwords do not match</p>}
            </Field>
            <ModalFooter onCancel={closeModal} saving={saving} label="Reset Password" disabled={!newPassword || newPassword !== confirmPassword} />
          </form>
        </Modal>
      )}

      {modalMode === 'delete' && selectedUser && (
        <Modal title="Delete User Permanently" onClose={closeModal}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 dark:bg-red-900/20 dark:border-red-800">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              <div>
                <p className="font-semibold text-red-900 text-sm dark:text-red-300">This cannot be undone!</p>
                <p className="text-sm text-red-700 mt-1 dark:text-red-400"><strong>{selectedUser.name}</strong> (@{selectedUser.username}) and all their data will be permanently deleted. Consider <strong>Deactivating</strong> instead.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel — Keep User</button>
              <button onClick={handlePermanentDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-50">
                {saving ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}

function ActionBtn({ onClick, title, color, children, disabled }: { onClick: () => void; title: string; color: string; children: React.ReactNode; disabled?: boolean }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40',
    amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/40',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/40',
    green: 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/40',
    red: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40',
  };
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${colorMap[color] || ''}`}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 dark:hover:bg-gray-700 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">{label}</label>{children}</div>;
}

function ModalFooter({ onCancel, saving, label, disabled }: { onCancel: () => void; saving: boolean; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-t dark:border-gray-700">
      <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
      <button type="submit" disabled={saving || disabled} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-semibold">{saving ? 'Saving...' : label}</button>
    </div>
  );
}
