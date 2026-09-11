import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { Modal } from '../../components/common/Modal';
import {
  Building2,
  Plus,
  Users,
  Search,
  CheckCircle2,
  Edit3,
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building,
  Mail,
  Lock,
  User,
  FileText,
  Hash,
  X,
  Eye,
  EyeOff
} from 'lucide-react';

export const SuperAdminDashboard = () => {
  const { addToast } = useNotification();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Server-side pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrgs, setTotalOrgs] = useState(0);

  // Platform-wide aggregate stats
  const [platformStats, setPlatformStats] = useState({
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalPlatformUsers: 0
  });

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    totalLicenses: 5,
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    description: '',
    totalLicenses: 5,
    adminEmail: '',
    adminName: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOrganizations = async (pageNum = page, searchVal = searchTerm) => {
    const targetPage = typeof pageNum === 'number' && !isNaN(pageNum) ? pageNum : page;
    const targetSearch = typeof searchVal === 'string' ? searchVal : searchTerm;
    setLoading(true);
    try {
      const res = await api.get(
        `/super-admin/organizations?page=${targetPage}&limit=${limit}&search=${encodeURIComponent(targetSearch)}`
      );
      setOrganizations(res.data.data.organizations || []);
      if (res.data.data.pagination) {
        setPage(res.data.data.pagination.page);
        setTotalPages(res.data.data.pagination.totalPages);
        setTotalOrgs(res.data.data.pagination.total);
      }
      if (res.data.data.stats) {
        setPlatformStats(res.data.data.stats);
      }
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations(1, searchTerm);
  }, [searchTerm]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const name = (createForm.name || '').trim();
    const code = (createForm.code || '').trim();
    const adminName = (createForm.adminName || '').trim();
    const adminEmail = (createForm.adminEmail || '').trim();
    const adminPassword = (createForm.adminPassword || '');
    const totalLicenses = parseInt(createForm.totalLicenses, 10);

    if (!name) {
      addToast('error', 'Organization Name is required');
      return;
    }
    if (!code) {
      addToast('error', 'Org Code is required');
      return;
    }
    if (isNaN(totalLicenses) || totalLicenses < 1) {
      addToast('error', 'Total Licenses must be a valid positive integer (at least 1)');
      return;
    }
    if (!adminName) {
      addToast('error', 'Org Admin Full Name is required');
      return;
    }
    if (!adminEmail) {
      addToast('error', 'Admin Email Address is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      addToast('error', 'Please enter a valid admin email address');
      return;
    }
    if (!adminPassword || !adminPassword.trim()) {
      addToast('error', 'Admin Password is required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/super-admin/organizations', {
        ...createForm,
        name,
        code,
        adminName,
        adminEmail,
        totalLicenses,
        description: (createForm.description || '').trim()
      });
      addToast('success', 'Organization and initial Org Admin created successfully!');
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        code: '',
        description: '',
        totalLicenses: 5,
        adminName: '',
        adminEmail: '',
        adminPassword: ''
      });
      fetchOrganizations();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrg) return;

    if (editForm.adminEmail && editForm.adminEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editForm.adminEmail.trim())) {
        addToast('error', 'Please enter a valid email address.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.put(`/super-admin/organizations/${selectedOrg.id}`, {
        ...editForm,
        totalLicenses: parseInt(editForm.totalLicenses, 10),
        adminEmail: (editForm.adminEmail || '').trim(),
        adminName: (editForm.adminName || '').trim()
      });
      addToast('success', 'Organization updated successfully!');
      setShowEditModal(false);
      setSelectedOrg(null);
      fetchOrganizations();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to update organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (org) => {
    const orgId = org.id || org._id;
    const currentStatus = String(org.status || 'ACTIVE').toUpperCase();
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      setOrganizations((prev) =>
        prev.map((o) => (o.id === orgId || o._id === orgId ? { ...o, status: newStatus } : o))
      );
      await api.put(`/super-admin/organizations/${orgId}/status`, { status: newStatus });
      addToast('success', `Organization status set to ${newStatus}`);
      fetchOrganizations();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to update organization status');
      fetchOrganizations();
    }
  };

  const openEditModal = (org) => {
    setSelectedOrg(org);
    setEditForm({
      name: org.name || '',
      code: org.code || '',
      description: org.description || '',
      totalLicenses: org.totalLicenses || 5,
      adminEmail: org.adminEmail || '',
      adminName: org.adminName || ''
    });
    setShowEditModal(true);
  };

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.code.toLowerCase().includes(searchTerm.toLowerCase());
    const orgStatus = String(org.status || 'ACTIVE').toUpperCase();
    if (statusFilter === 'ACTIVE') return matchesSearch && orgStatus === 'ACTIVE';
    if (statusFilter === 'INACTIVE') return matchesSearch && orgStatus === 'INACTIVE';
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Super Admin Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
            Platform Governance Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Provision multi-tenant client organizations, manage administrative roles, and govern access across the LMS platform.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Provision New Organization</span>
          </button>
        </div>
      </div>

      {/* Platform Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4.5">
        {/* Card 1: Total Organizations */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Organizations
            </div>
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                {platformStats.totalOrganizations || totalOrgs || organizations.length}
              </h3>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Tenants
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Provisioned LMS enterprise tenants
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Active Organizations */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Organizations
            </div>
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl font-black text-emerald-600 tracking-tight font-heading">
                {platformStats.activeOrganizations}
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Operational
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Currently operational tenants
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Total Platform Users */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Platform Users
            </div>
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl font-black text-emerald-600 tracking-tight font-heading">
                {platformStats.totalPlatformUsers}
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Global
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Registered users across all tenants
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Directory Controls Toolbar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search organization by name or code..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold border border-slate-200">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({organizations.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0">
          <span className="text-xs text-slate-500 font-semibold hidden lg:inline">
            Showing <span className="text-slate-900 font-bold">{filteredOrgs.length}</span> orgs
          </span>

          <button
            onClick={() => fetchOrganizations()}
            className="py-2 px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh Directory</span>
          </button>
        </div>
      </div>

      {/* Organizations Table Container */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Organization</th>
                <th className="px-6 py-3.5">Org Code</th>
                <th className="px-6 py-3.5">Licenses (Used / Total)</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                      <p className="text-xs font-semibold text-slate-500">
                        Fetching organization directory...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Building2 className="w-10 h-10 text-slate-300" />
                      <h4 className="text-sm font-bold text-slate-800">
                        No Organizations Found
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm">
                        No tenant organizations match your current search query or filter criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => {
                  const isActive = String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
                  const orgId = org.id || org._id;

                  return (
                    <tr
                      key={orgId}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Organization Name & Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                            {org.name ? org.name.substring(0, 2).toUpperCase() : 'OG'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 truncate">
                              {org.name}
                            </div>
                            <div className="text-xs font-normal text-slate-500 truncate">
                              {org.description || 'Enterprise Tenant'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold uppercase tracking-wider">
                          {org.code}
                        </span>
                      </td>

                      {/* Licenses */}
                      <td className="px-6 py-4 text-xs font-semibold">
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          <span>{org.usedLicenses ?? 0} / {org.totalLicenses ?? 5}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5" />
                            INACTIVE
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-6 py-4 text-xs font-medium text-slate-500 font-mono">
                        {new Date(org.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(org)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Edit Details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(org)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                              isActive
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-medium">
              Showing page <span className="font-bold text-slate-900">{page}</span> of{' '}
              <span className="font-bold text-slate-900">{totalPages}</span> ({totalOrgs} total organizations)
            </div>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => fetchOrganizations(page - 1)}
                className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                {page} / {totalPages}
              </div>

              <button
                disabled={page >= totalPages || loading}
                onClick={() => fetchOrganizations(page + 1)}
                className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PROVISION NEW ORGANIZATION MODAL */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Provision New Organization"
        maxWidth="max-w-xl"
        closeOnBackdropClick={false}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <Building className="w-4 h-4" />
              <span>1. Organization Information</span>
            </div>

            {/* Org Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Organization Name *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  placeholder="Acme Corporation"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            {/* Code, Description & Total Licenses Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Org Code *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                    required
                    placeholder="ACME-101"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono uppercase tracking-wider focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Licenses *
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={createForm.totalLicenses}
                    onChange={(e) => setCreateForm({ ...createForm, totalLicenses: e.target.value })}
                    required
                    placeholder="5"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="IT & Managed Services"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <User className="w-4 h-4" />
              <span>2. Initial Organization Admin Credentials</span>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Org Admin Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={createForm.adminName}
                  onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                  required
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            {/* Admin Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={createForm.adminEmail}
                    onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                    required
                    placeholder="admin@acme.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={createForm.adminPassword}
                    onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer disabled:opacity-50 transition-all"
            >
              {submitting ? 'Provisioning...' : 'Provision Organization'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT ORGANIZATION DETAILS MODAL */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Organization Details"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Code *
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono uppercase tracking-wider focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Total Licenses *
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="number"
                min="1"
                step="1"
                value={editForm.totalLicenses}
                onChange={(e) => setEditForm({ ...editForm, totalLicenses: e.target.value })}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          {/* Org Admin Information Section */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <User className="w-4 h-4" />
              <span>Organization Admin Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Org Admin Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={editForm.adminName}
                    onChange={(e) => setEditForm({ ...editForm, adminName: e.target.value })}
                    placeholder="Admin Name"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={editForm.adminEmail}
                    onChange={(e) => setEditForm({ ...editForm, adminEmail: e.target.value })}
                    placeholder="admin@company.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer disabled:opacity-50 transition-all"
            >
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

