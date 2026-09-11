import React, { useEffect, useState } from 'react';
import { getInstructorCertificates } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useNotification } from '../../context/NotificationContext';
import { CertificateCanvas, exportCertificatePNG, exportCertificatePDF } from '../../components/common/CertificateCanvas';
import { formatDate } from '../../utils/formatters';
import {
  Award,
  Search,
  Download,
  Eye,
  X,
  BookOpen,
  FileText
} from 'lucide-react';

export const InstructorCertificates = () => {
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);
  const { addToast } = useNotification();

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await getInstructorCertificates();
      setCertificates(res.data.data.certificates || []);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to load course certificates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const filteredCertificates = certificates.filter((cert) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const certId = (cert.certificateId || '').toLowerCase();
    const emp = (cert.employee?.name || '').toLowerCase();
    const title = (cert.training?.title || '').toLowerCase();
    return certId.includes(q) || emp.includes(q) || title.includes(q);
  });

  if (loading) return <LoadingSpinner text="Loading course completion certificates..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Instructor Portal</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading mt-1">Course Certificates</h1>
          <p className="text-xs text-slate-500 mt-1">
            View and download official completion certificates issued to learners in your training courses.
          </p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
          <BookOpen className="w-4 h-4" />
          <span>{certificates.length} Certificate{certificates.length === 1 ? '' : 's'} Issued</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by learner name, course title, or certificate ID..."
          className="w-full bg-transparent text-xs text-slate-900 outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-slate-600">
            Clear
          </button>
        )}
      </div>

      {/* Certificates Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider text-[11px]">
                <th className="p-4">Certificate ID</th>
                <th className="p-4">Learner Name</th>
                <th className="p-4">Department</th>
                <th className="p-4">Course Title</th>
                <th className="p-4">Completion Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    No certificates issued for your courses yet.
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-amber-700">
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
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="View Certificate"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCert(cert);
                          setTimeout(() => {
                            exportCertificatePNG(`inst_cert_${cert.id}`, `Certificate_${cert.certificateId}.png`);
                          }, 150);
                        }}
                        className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer"
                        title="Download PNG"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCert(cert);
                          setTimeout(() => {
                            exportCertificatePDF(`inst_cert_${cert.id}`, `Certificate_${cert.certificateId}.pdf`);
                          }, 150);
                        }}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer"
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

      {/* FULL VIEW MODAL */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-5xl h-[88vh] max-h-[850px] bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col shadow-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3 shrink-0">
              <div className="min-w-0 pr-2">
                <span className="text-[11px] font-bold text-amber-600 font-mono">{selectedCert.certificateId}</span>
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
                  onClick={() => exportCertificatePNG(`inst_cert_${selectedCert.id}`, `Certificate_${selectedCert.certificateId}.png`)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs inline-flex items-center cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-1.5" /> Download PNG
                </button>

                <button
                  onClick={() => exportCertificatePDF(`inst_cert_${selectedCert.id}`, `Certificate_${selectedCert.certificateId}.pdf`)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs inline-flex items-center cursor-pointer"
                >
                  <FileText className="w-4 h-4 mr-1.5" /> Download PDF
                </button>

                <button
                  onClick={() => setSelectedCert(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 min-w-0 p-3 sm:p-5 flex items-center justify-center bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden mt-4">
              <CertificateCanvas
                certificate={selectedCert}
                elementId={`inst_cert_${selectedCert.id}`}
                className="max-h-full max-w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

