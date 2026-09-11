import React, { useEffect, useState } from 'react';
import {
  getOrgCertificates,
  getCertificateTemplate,
  updateCertificateTemplate,
  resetCertificateTemplate,
  getBackfillEligible,
  backfillCertificates,
  uploadImage,
  deleteMedia
} from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { CertificateCanvas, exportCertificatePNG, exportCertificatePDF } from '../../components/common/CertificateCanvas';
import { formatDate } from '../../utils/formatters';
import {
  Award,
  Search,
  Download,
  Eye,
  X,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FileText,
  Upload,
  Trash2,
  Image as ImageIcon,
  FileSignature,
  Sliders,
  CheckCircle2,
  Loader2,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

/**
 * Helper to automatically make signature image background transparent (client-side HTML canvas processing)
 */
const processTransparentSignature = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const minChannel = Math.min(r, g, b);
            if (minChannel > 200) {
              const brightness = (r + g + b) / 3;
              if (brightness > 240) {
                data[i + 3] = 0; // Fully transparent
              } else if (brightness > 200) {
                const alpha = Math.floor((240 - brightness) / 40 * 255);
                data[i + 3] = Math.min(data[i + 3], alpha);
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '_transparent.png', {
                type: 'image/png'
              });
              resolve(processedFile);
            } else {
              resolve(file);
            }
          }, 'image/png');
        } catch (err) {
          console.warn('Transparent signature canvas processing fallback:', err);
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export const AdminCertificates = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('issued'); // 'issued' | 'designer'
  const [designerSubTab, setDesignerSubTab] = useState('assets'); // 'assets' | 'styling'
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotification();

  // Issued Certificates State
  const [certificates, setCertificates] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);

  // Template Designer State
  const [template, setTemplate] = useState({
    title: 'CERTIFICATE OF COMPLETION',
    primaryColor: '#1E3A8A',
    accentColor: '#D97706',
    fontFamily: 'Inter',
    borderStyle: 'classic_gold',
    layoutStyle: 'centered',
    logoUrl: '',
    logoPublicId: '',
    logoPosition: 'center',
    logoWidth: 130,
    signatureUrl: '',
    signaturePublicId: '',
    signatureName: ''
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Backfill State
  const [backfillCount, setBackfillCount] = useState(0);
  const [runningBackfill, setRunningBackfill] = useState(false);

  const fetchCertificatesData = async () => {
    try {
      const [certRes, tplRes, backfillRes] = await Promise.all([
        getOrgCertificates({ search }),
        getCertificateTemplate(),
        getBackfillEligible()
      ]);
      setCertificates(certRes.data.data.certificates || []);
      if (tplRes.data.data.template) {
        setTemplate(prev => ({
          ...prev,
          ...tplRes.data.data.template
        }));
      }
      setBackfillCount(backfillRes.data.data.count || 0);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to load certification data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificatesData();
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    getOrgCertificates({ search: val })
      .then(res => setCertificates(res.data.data.certificates || []))
      .catch(() => {});
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please select a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await uploadImage(formData);
      const { url, publicId } = res.data.data;

      const oldPublicId = template.logoPublicId;
      setTemplate(prev => ({ ...prev, logoUrl: url, logoPublicId: publicId }));
      addToast('success', 'Organization logo uploaded successfully!');

      if (oldPublicId && oldPublicId !== publicId) {
        deleteMedia(oldPublicId, 'image').catch(err => console.warn('Failed to delete old logo asset:', err));
      }
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to upload logo image');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleLogoDelete = async () => {
    const oldPublicId = template.logoPublicId;
    setTemplate(prev => ({ ...prev, logoUrl: null, logoPublicId: null }));
    addToast('info', 'Logo removed from certificate template');

    if (oldPublicId) {
      try {
        await deleteMedia(oldPublicId, 'image');
      } catch (err) {
        console.warn('Failed to delete logo asset from Cloudinary:', err);
      }
    }
  };

  const handleSignatureUpload = async (e) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    if (!originalFile.type.startsWith('image/')) {
      addToast('error', 'Please select a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    setUploadingSignature(true);

    try {
      // Process client-side transparent background removal
      const fileToUpload = await processTransparentSignature(originalFile);

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await uploadImage(formData);
      const { url, publicId } = res.data.data;

      const oldPublicId = template.signaturePublicId;
      setTemplate(prev => ({ ...prev, signatureUrl: url, signaturePublicId: publicId }));
      addToast('success', 'Transparent signature image uploaded successfully!');

      if (oldPublicId && oldPublicId !== publicId) {
        deleteMedia(oldPublicId, 'image').catch(err => console.warn('Failed to delete old signature asset:', err));
      }
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to upload signature image');
    } finally {
      setUploadingSignature(false);
      e.target.value = '';
    }
  };

  const handleSignatureDelete = async () => {
    const oldPublicId = template.signaturePublicId;
    setTemplate(prev => ({ ...prev, signatureUrl: null, signaturePublicId: null }));
    addToast('info', 'Signature image removed');

    if (oldPublicId) {
      try {
        await deleteMedia(oldPublicId, 'image');
      } catch (err) {
        console.warn('Failed to delete signature asset from Cloudinary:', err);
      }
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      const res = await updateCertificateTemplate(template);
      setTemplate(prev => ({ ...prev, ...res.data.data.template }));
      addToast('success', 'Certificate template settings saved successfully!');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to save template settings');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!window.confirm('Reset certificate template to default colors, layout, and clear uploaded assets?')) return;
    setSavingTemplate(true);
    try {
      const res = await resetCertificateTemplate();
      setTemplate(prev => ({ ...prev, ...res.data.data.template }));
      addToast('success', 'Template settings reset to default values.');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to reset template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleRunBackfill = async () => {
    setRunningBackfill(true);
    try {
      const res = await backfillCertificates();
      addToast('success', res.data.message || 'Backfill completed!');
      await fetchCertificatesData();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to execute backfill');
    } finally {
      setRunningBackfill(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading organization certificates & settings..." />;

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Organization Governance</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading mt-1">Certificates & Designer</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage organization completion certificates, customize template logos, signatures, styles, and trigger backfill generation.
          </p>
        </div>

        {/* Main Tab Navigation Controls */}
        <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('issued')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'issued'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Issued Certificates ({certificates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('designer')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'designer'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Certificate Designer</span>
          </button>
        </div>
      </div>

      {/* BACKFILL NOTICE BANNER FOR MISSING CERTIFICATES */}
      {backfillCount > 0 && (
        <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-scale-up">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <RefreshCw className={`w-5 h-5 ${runningBackfill ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-emerald-800 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Missing Certificates Found ({backfillCount})
              </h4>
              <p className="text-xs text-slate-700 mt-0.5">
                {backfillCount} completed training assignment{backfillCount === 1 ? '' : 's'} in your organization do not have certificates issued yet.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunBackfill}
            disabled={runningBackfill}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
          >
            {runningBackfill ? 'Generating Certificates...' : `Generate ${backfillCount} Missing Certificate${backfillCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {/* TAB 1: ISSUED CERTIFICATES TABLE */}
      {activeTab === 'issued' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by Employee name, Training title, or Certificate ID..."
              className="w-full bg-transparent text-xs text-slate-900 outline-none"
            />
            {search && (
              <button onClick={() => { setSearch(''); getOrgCertificates().then(res => setCertificates(res.data.data.certificates || [])); }} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider text-[11px]">
                    <th className="p-4">Certificate ID</th>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Training Title</th>
                    <th className="p-4">Completion Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {certificates.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        No organization certificates found.
                      </td>
                    </tr>
                  ) : (
                    certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-mono font-bold text-emerald-700">
                          {cert.certificateId}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          {cert.employee?.name}
                        </td>
                        <td className="p-4 text-slate-500">
                          {cert.employee?.department?.name || 'N/A'}
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          {cert.training?.title}
                        </td>
                        <td className="p-4 text-slate-500 font-mono">
                          {formatDate(cert.completionDate)}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedCert(cert)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer inline-flex items-center"
                            title="View Certificate"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCert(cert);
                              setTimeout(() => {
                                exportCertificatePNG(`admin_cert_${cert.id}`, `Certificate_${cert.certificateId}.png`);
                              }, 150);
                            }}
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer inline-flex items-center border border-emerald-200"
                            title="Download PNG"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCert(cert);
                              setTimeout(() => {
                                exportCertificatePDF(`admin_cert_${cert.id}`, `Certificate_${selectedCert.certificateId}.pdf`);
                              }, 150);
                            }}
                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer inline-flex items-center border border-red-200"
                            title="Download PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CERTIFICATE DESIGNER */}
      {activeTab === 'designer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form */}
          <form onSubmit={handleSaveTemplate} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center">
                    <Palette className="w-4.5 h-4.5 mr-2 text-emerald-600" /> Certificate Designer
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customize assets, signatures, colors, borders, and font typography.
                  </p>
                </div>
              </div>

              {/* 2 SUB-TABS */}
              <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDesignerSubTab('assets')}
                  className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    designerSubTab === 'assets'
                      ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Assets & Signature</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDesignerSubTab('styling')}
                  className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    designerSubTab === 'styling'
                      ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Template Styling</span>
                </button>
              </div>

              {/* SUB-TAB 1: ASSETS & SIGNATURE */}
              {designerSubTab === 'assets' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Organization Logo Upload & Placement Controls */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center"><ImageIcon className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Organization Logo</span>
                      {template.logoUrl && <span className="text-[11px] text-emerald-600 font-semibold flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</span>}
                    </label>

                    {template.logoUrl ? (
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                            <img src={template.logoUrl} alt="Org Logo" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">Organization Logo</p>
                            <p className="text-[11px] text-slate-400">Renders on upper certificate header</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <label className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center">
                            <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                          </label>
                          <button
                            type="button"
                            onClick={handleLogoDelete}
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                            title="Delete Logo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-emerald-50/30 transition-all cursor-pointer group">
                        {uploadingLogo ? (
                          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin my-1" />
                        ) : (
                          <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors my-1" />
                        )}
                        <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700 mt-1">
                          {uploadingLogo ? 'Uploading Logo...' : 'Click to Upload Organization Logo'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, SVG or WebP (Max 5MB)</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" />
                      </label>
                    )}

                    {/* Logo Position Controls (Left / Center / Right) & Logo Width */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          Logo Alignment / Position
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setTemplate({ ...template, logoPosition: 'left' })}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                              (template.logoPosition || 'center') === 'left'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <AlignLeft className="w-3.5 h-3.5" />
                            <span>Left</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTemplate({ ...template, logoPosition: 'center' })}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                              (template.logoPosition || 'center') === 'center'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <AlignCenter className="w-3.5 h-3.5" />
                            <span>Center</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTemplate({ ...template, logoPosition: 'right' })}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                              (template.logoPosition || 'center') === 'right'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <AlignRight className="w-3.5 h-3.5" />
                            <span>Right</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>Logo Width</span>
                          <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{template.logoWidth || 130} px</span>
                        </div>
                        <input
                          type="range"
                          min="60"
                          max="250"
                          step="5"
                          value={template.logoWidth || 130}
                          onChange={(e) => setTemplate({ ...template, logoWidth: Number(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Signature Image Upload */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center"><FileSignature className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Authorized Signature Image</span>
                      {template.signatureUrl && <span className="text-[11px] text-emerald-600 font-semibold flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</span>}
                    </label>

                    {template.signatureUrl ? (
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-20 h-12 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:8px_8px]">
                            <img src={template.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">Signature Image</p>
                            <p className="text-[11px] text-emerald-600 font-medium">Automatic background transparency applied</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <label className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center">
                            <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                            <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                          </label>
                          <button
                            type="button"
                            onClick={handleSignatureDelete}
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                            title="Delete Signature"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-emerald-50/30 transition-all cursor-pointer group">
                        {uploadingSignature ? (
                          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin my-1" />
                        ) : (
                          <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors my-1" />
                        )}
                        <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700 mt-1">
                          {uploadingSignature ? 'Processing Transparency...' : 'Click to Upload Signature Image'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">White paper background automatically removed</span>
                        <input type="file" accept="image/*" onChange={handleSignatureUpload} disabled={uploadingSignature} className="hidden" />
                      </label>
                    )}
                  </div>

                  {/* Signature Name Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Signature Name
                    </label>
                    <p className="text-[11px] text-slate-500 mb-1.5">
                      The entered name will render strictly underneath the signature line in the footer.
                    </p>
                    <input
                      type="text"
                      value={template.signatureName || ''}
                      onChange={(e) => setTemplate({ ...template, signatureName: e.target.value })}
                      placeholder="e.g. Lakshya Joshi"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:border-emerald-600 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: TEMPLATE STYLING */}
              {designerSubTab === 'styling' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Certificate Heading Title
                    </label>
                    <input
                      type="text"
                      value={template.title}
                      onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:border-emerald-600 outline-none"
                    />
                  </div>

                  {/* Primary Color */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Brand Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={template.primaryColor || '#1E3A8A'}
                        onChange={(e) => setTemplate({ ...template, primaryColor: e.target.value })}
                        className="w-9 h-9 rounded-xl border-none cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={template.primaryColor || '#1E3A8A'}
                        onChange={(e) => setTemplate({ ...template, primaryColor: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Accent Line / Gold Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={template.accentColor || '#D97706'}
                        onChange={(e) => setTemplate({ ...template, accentColor: e.target.value })}
                        className="w-9 h-9 rounded-xl border-none cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={template.accentColor || '#D97706'}
                        onChange={(e) => setTemplate({ ...template, accentColor: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  {/* Border Style */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Frame Border Style
                    </label>
                    <select
                      value={template.borderStyle || 'classic_gold'}
                      onChange={(e) => setTemplate({ ...template, borderStyle: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 outline-none"
                    >
                      <option value="classic_gold">Classic Gold Frame</option>
                      <option value="modern_slate">Modern Slate Dashed</option>
                      <option value="minimal_navy">Minimalist Navy Bars</option>
                      <option value="double_emerald">Double Rounded Frame</option>
                      <option value="single_classic">Single Classic Border</option>
                      <option value="double_classic">Double Classic Border</option>
                      <option value="rounded_border">Rounded Border</option>
                      <option value="elegant_inner">Elegant Inner Border</option>
                      <option value="minimal_border">Minimal Border</option>
                      <option value="decorative_corner">Decorative Corner Border</option>
                      <option value="formal_academic">Formal Academic Border</option>
                    </select>
                  </div>

                  {/* Font Family */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Typography Font Family
                    </label>
                    <select
                      value={template.fontFamily || 'Inter'}
                      onChange={(e) => setTemplate({ ...template, fontFamily: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 outline-none"
                    >
                      <option value="Inter">Inter (Clean Modern)</option>
                      <option value="Georgia, serif">Georgia (Classic Serif)</option>
                      <option value="Roboto, sans-serif">Roboto (Corporate Sans)</option>
                      <option value="Playfair Display, serif">Playfair (Elegant Display)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 space-y-1 mt-4">
                <p className="font-bold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Immutability Guarantee:
                </p>
                <p className="opacity-90">
                  Updating template settings will apply to future certificates. Already issued certificates retain their frozen snapshot.
                </p>
              </div>
            </div>

            {/* Submit / Reset Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 mt-4">
              <button
                type="button"
                onClick={handleResetTemplate}
                disabled={savingTemplate}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer flex items-center"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
              </button>

              <button
                type="submit"
                disabled={savingTemplate}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" /> {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>

          {/* LIVE PREVIEW CANVAS */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Live Certificate Preview (Sample Data)
              </h3>
              <span className="text-[11px] text-emerald-600 font-bold flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                Real-time Rendering
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <CertificateCanvas
                templateSettings={template}
                sampleData={{
                  organizationName: user?.organization?.name || template?.organization?.name || 'Enterprise Organization',
                  employeeName: 'Sarah Jenkins',
                  trainingTitle: 'Enterprise Cloud Architecture & Compliance',
                  certificateId: 'CERT-2026-SAMPLE',
                  completionDate: new Date(),
                  logoUrl: template.logoUrl,
                  logoPosition: template.logoPosition,
                  logoWidth: template.logoWidth,
                  signatureUrl: template.signatureUrl,
                  signatureName: template.signatureName
                }}
                elementId="template_preview_canvas"
              />
            </div>
          </div>
        </div>
      )}

      {/* FULL VIEW MODAL */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-5xl h-[88vh] max-h-[850px] bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col shadow-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3 shrink-0">
              <div className="min-w-0 pr-2">
                <span className="text-[11px] font-bold text-emerald-700 font-mono">{selectedCert.certificateId}</span>
                <h2
                  className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 truncate"
                  title={`${selectedCert.employee?.name ? `${selectedCert.employee.name} • ` : ''}${selectedCert.training?.title || ''}`}
                >
                  {selectedCert.employee?.name ? `${selectedCert.employee.name} • ` : ''}
                  {selectedCert.training?.title}
                </h2>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => exportCertificatePNG(`admin_cert_${selectedCert.id}`, `Certificate_${selectedCert.certificateId}.png`)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs inline-flex items-center cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-1.5" /> Download PNG
                </button>

                <button
                  onClick={() => exportCertificatePDF(`admin_cert_${selectedCert.id}`, `Certificate_${selectedCert.certificateId}.pdf`)}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs inline-flex items-center cursor-pointer"
                >
                  <FileText className="w-4 h-4 mr-1.5" /> Download PDF
                </button>

                <button
                  onClick={() => setSelectedCert(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 min-w-0 p-3 sm:p-5 flex items-center justify-center bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden mt-4">
              <CertificateCanvas
                certificate={selectedCert}
                elementId={`admin_cert_${selectedCert.id}`}
                className="max-h-full max-w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
