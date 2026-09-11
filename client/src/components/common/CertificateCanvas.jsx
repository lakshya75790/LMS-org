import React from 'react';
import { formatDate } from '../../utils/formatters';
import { jsPDF } from 'jspdf';

/**
 * Render SVG element onto an offscreen 2400x1700 canvas (2x resolution of 1200x850)
 */
export const renderCertificateToCanvas = (svgId) => {
  return new Promise((resolve) => {
    const svgElement = document.getElementById(svgId);
    if (!svgElement) {
      console.error(`SVG element #${svgId} not found`);
      return resolve(null);
    }

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetWidth = 2400;
      const targetHeight = 1700;
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      // Fill canvas background white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Draw SVG image scaled to exact 2400x1700 canvas
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = (err) => {
      console.error('Error loading SVG into Image for export:', err);
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
};

/**
 * Export high-resolution PNG image
 */
export const exportCertificatePNG = async (svgId, filename = 'Certificate.png') => {
  const canvas = await renderCertificateToCanvas(svgId);
  if (!canvas) return;

  const pngUrl = canvas.toDataURL('image/png', 1.0);
  const downloadLink = document.createElement('a');
  downloadLink.href = pngUrl;
  downloadLink.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};

// Backward compatibility alias
export const downloadCertificateAsPNG = exportCertificatePNG;

/**
 * Export single-page landscape PDF document
 */
export const exportCertificatePDF = async (svgId, filename = 'Certificate.pdf') => {
  const canvas = await renderCertificateToCanvas(svgId);
  if (!canvas) return;

  const pngUrl = canvas.toDataURL('image/png', 1.0);

  // Standard A4 landscape: 297mm x 210mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  pdf.addImage(pngUrl, 'PNG', 0, 0, 297, 210);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
};

/**
 * Helper to split long training titles into max 2 balanced lines
 */
const formatTrainingTitleLines = (titleStr) => {
  if (!titleStr) return [{ text: '""', y: 515, fontSize: 32 }];
  if (titleStr.length <= 42) {
    return [{ text: `"${titleStr}"`, y: 515, fontSize: 32 }];
  }

  const words = titleStr.split(' ');
  let line1 = '';
  let line2 = '';
  const mid = Math.ceil(titleStr.length / 2);
  let current = '';

  for (let i = 0; i < words.length; i++) {
    if ((current + ' ' + words[i]).length <= mid || i === 0) {
      current += (current ? ' ' : '') + words[i];
    } else {
      line1 = current;
      line2 = words.slice(i).join(' ');
      break;
    }
  }

  if (!line1) line1 = titleStr;

  const fontSize = titleStr.length > 70 ? 24 : 28;
  return [
    { text: `"${line1}`, y: 495, fontSize },
    { text: `${line2}"`, y: 495 + fontSize + 8, fontSize }
  ];
};

/**
 * Dynamic Font Size calculation for Employee Name
 */
const getEmployeeNameFontSize = (nameStr) => {
  if (!nameStr) return 48;
  if (nameStr.length <= 22) return 48;
  if (nameStr.length <= 32) return 38;
  if (nameStr.length <= 42) return 30;
  return 24;
};

/**
 * Dynamic Font Size calculation for Organization Name
 */
const getOrgNameFontSize = (orgStr) => {
  if (!orgStr) return 26;
  if (orgStr.length <= 28) return 26;
  if (orgStr.length <= 42) return 22;
  return 18;
};

export const CertificateCanvas = ({
  certificate,
  sampleData,
  templateSettings,
  elementId = 'certificate-svg-canvas',
  className = ''
}) => {
  const snapshot = certificate?.templateSnapshot || templateSettings || {};

  const orgName = certificate?.organization?.name || snapshot.organizationName || templateSettings?.organization?.name || sampleData?.organizationName || 'Enterprise Organization';
  const empName = certificate?.employee?.name || sampleData?.employeeName || 'John Doe';
  const trainingTitle = certificate?.training?.title || sampleData?.trainingTitle || 'Advanced Corporate Compliance & Security';
  const certId = certificate?.certificateId || sampleData?.certificateId || 'CERT-2026-SAMPLE';
  const dateVal = certificate?.completionDate || sampleData?.completionDate || new Date();

  const title = snapshot.title || 'CERTIFICATE OF COMPLETION';
  const primaryColor = snapshot.primaryColor || '#1E3A8A';
  const accentColor = snapshot.accentColor || '#D97706';
  const selectedFont = snapshot.fontFamily || 'Inter';
  const borderStyle = snapshot.borderStyle || 'classic_gold';

  const logoUrl = snapshot.logoUrl || sampleData?.logoUrl || null;
  const logoPosition = (snapshot.logoPosition || sampleData?.logoPosition || 'center').toLowerCase();
  const logoWidth = Number(snapshot.logoWidth || sampleData?.logoWidth || 130);
  const logoHeight = Math.round(logoWidth * 0.45);

  const signatureUrl = snapshot.signatureUrl || sampleData?.signatureUrl || null;
  const signatureName = snapshot.signatureName !== undefined ? snapshot.signatureName : (sampleData?.signatureName || '');

  const fontFamily = `${selectedFont}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  const formattedDate = formatDate(dateVal);

  const titleLines = formatTrainingTitleLines(trainingTitle);
  const empNameFontSize = getEmployeeNameFontSize(empName);
  const orgNameFontSize = getOrgNameFontSize(orgName);

  // Logo X/Y coordinates
  let logoX = 600 - logoWidth / 2;
  let logoY = 46;
  if (logoPosition === 'left') {
    logoX = 70;
    logoY = 55;
  } else if (logoPosition === 'right') {
    logoX = 1130 - logoWidth;
    logoY = 55;
  }

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 text-slate-900 mx-auto transition-all ${className}`}
      style={{
        aspectRatio: '1200 / 850',
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: 'auto'
      }}
    >
      <svg
        id={elementId}
        viewBox="0 0 1200 850"
        width="1200"
        height="850"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full object-contain select-none block"
        style={{ fontFamily }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`${elementId}_bgGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>

          <pattern id={`${elementId}_gridPattern`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.3" />
          </pattern>
        </defs>

        {/* Background Layer */}
        <rect width="1200" height="850" fill={`url(#${elementId}_bgGradient)`} />
        <rect width="1200" height="850" fill={`url(#${elementId}_gridPattern)`} />

        {/* BORDER STYLES */}
        {borderStyle === 'classic_gold' && (
          <g>
            <rect x="25" y="25" width="1150" height="800" fill="none" stroke={primaryColor} strokeWidth="6" rx="12" />
            <rect x="35" y="35" width="1130" height="780" fill="none" stroke={accentColor} strokeWidth="2" rx="8" />
            {/* Corner Ornaments */}
            <path d="M 45 65 L 65 45 M 65 45 L 95 45 M 65 45 L 65 95" stroke={accentColor} strokeWidth="3" fill="none" />
            <path d="M 1155 65 L 1135 45 M 1135 45 L 1105 45 M 1135 45 L 1135 95" stroke={accentColor} strokeWidth="3" fill="none" />
            <path d="M 45 785 L 65 805 M 65 805 L 95 805 M 65 805 L 65 755" stroke={accentColor} strokeWidth="3" fill="none" />
            <path d="M 1155 785 L 1135 805 M 1135 805 L 1105 805 M 1135 805 L 1135 755" stroke={accentColor} strokeWidth="3" fill="none" />
          </g>
        )}

        {borderStyle === 'modern_slate' && (
          <g>
            <rect x="20" y="20" width="1160" height="810" fill="none" stroke={primaryColor} strokeWidth="12" rx="16" />
            <rect x="40" y="40" width="1120" height="770" fill="none" stroke="#64748B" strokeWidth="1" strokeDasharray="6 4" rx="10" />
          </g>
        )}

        {borderStyle === 'minimal_navy' && (
          <g>
            <rect x="30" y="30" width="1140" height="790" fill="none" stroke={primaryColor} strokeWidth="3" rx="4" />
            <line x1="30" y1="50" x2="1170" y2="50" stroke={accentColor} strokeWidth="4" />
            <line x1="30" y1="800" x2="1170" y2="800" stroke={accentColor} strokeWidth="4" />
          </g>
        )}

        {borderStyle === 'double_emerald' && (
          <g>
            <rect x="20" y="20" width="1160" height="810" fill="none" stroke={primaryColor} strokeWidth="8" rx="8" />
            <rect x="34" y="34" width="1132" height="782" fill="none" stroke={accentColor} strokeWidth="4" rx="6" />
          </g>
        )}

        {borderStyle === 'single_classic' && (
          <g>
            <rect x="30" y="30" width="1140" height="790" fill="none" stroke={primaryColor} strokeWidth="4" rx="4" />
            <rect x="40" y="40" width="1120" height="770" fill="none" stroke={accentColor} strokeWidth="1.5" rx="2" />
          </g>
        )}

        {borderStyle === 'double_classic' && (
          <g>
            <rect x="25" y="25" width="1150" height="800" fill="none" stroke={primaryColor} strokeWidth="5" />
            <rect x="35" y="35" width="1130" height="780" fill="none" stroke={accentColor} strokeWidth="2" />
            <rect x="42" y="42" width="1116" height="766" fill="none" stroke={primaryColor} strokeWidth="1" />
          </g>
        )}

        {borderStyle === 'rounded_border' && (
          <g>
            <rect x="25" y="25" width="1150" height="800" fill="none" stroke={primaryColor} strokeWidth="6" rx="24" />
          </g>
        )}

        {borderStyle === 'elegant_inner' && (
          <g>
            <rect x="20" y="20" width="1160" height="810" fill="none" stroke={primaryColor} strokeWidth="10" rx="8" />
            <rect x="38" y="38" width="1124" height="774" fill="none" stroke={accentColor} strokeWidth="2" rx="4" />
          </g>
        )}

        {borderStyle === 'minimal_border' && (
          <g>
            <rect x="35" y="35" width="1130" height="780" fill="none" stroke={primaryColor} strokeWidth="2" rx="2" />
          </g>
        )}

        {borderStyle === 'decorative_corner' && (
          <g>
            <rect x="30" y="30" width="1140" height="790" fill="none" stroke={primaryColor} strokeWidth="3" rx="6" />
            <path d="M 20 50 L 20 20 L 50 20" fill="none" stroke={accentColor} strokeWidth="4" />
            <path d="M 1180 50 L 1180 20 L 1150 20" fill="none" stroke={accentColor} strokeWidth="4" />
            <path d="M 20 800 L 20 830 L 50 830" fill="none" stroke={accentColor} strokeWidth="4" />
            <path d="M 1180 800 L 1180 830 L 1150 830" fill="none" stroke={accentColor} strokeWidth="4" />
          </g>
        )}

        {borderStyle === 'formal_academic' && (
          <g>
            <rect x="25" y="25" width="1150" height="800" fill="none" stroke={primaryColor} strokeWidth="7" />
            <rect x="36" y="36" width="1128" height="778" fill="none" stroke={accentColor} strokeWidth="3" />
            <rect x="20" y="20" width="20" height="20" fill={accentColor} />
            <rect x="1160" y="20" width="20" height="20" fill={accentColor} />
            <rect x="20" y="810" width="20" height="20" fill={accentColor} />
            <rect x="1160" y="810" width="20" height="20" fill={accentColor} />
          </g>
        )}

        {/* HEADER: Organization Logo & Name */}
        <g>
          {logoUrl && (
            <image
              href={logoUrl}
              x={logoX}
              y={logoY}
              width={logoWidth}
              height={logoHeight}
              preserveAspectRatio="xMidYMid meet"
            />
          )}

          <text
            x="600"
            y={logoUrl && logoPosition === 'center' ? Math.max(130, logoY + logoHeight + 20) : 130}
            textAnchor="middle"
            fill={primaryColor}
            fontSize={orgNameFontSize}
            fontWeight="800"
            letterSpacing="3"
          >
            {orgName.toUpperCase()}
          </text>
          <line x1="450" y1="150" x2="750" y2="150" stroke={accentColor} strokeWidth="2" />
        </g>

        {/* MAIN CERTIFICATE TITLE */}
        <g>
          <text
            x="600"
            y="225"
            textAnchor="middle"
            fill={primaryColor}
            fontSize="42"
            fontWeight="900"
            letterSpacing="4"
          >
            {title.toUpperCase()}
          </text>

          <text
            x="600"
            y="270"
            textAnchor="middle"
            fill="#64748B"
            fontSize="15"
            fontWeight="600"
            letterSpacing="2"
          >
            THIS IS PROUDLY PRESENTED TO
          </text>
        </g>

        {/* RECIPIENT / EMPLOYEE NAME */}
        <g>
          <text
            x="600"
            y="360"
            textAnchor="middle"
            fill="#0F172A"
            fontSize={empNameFontSize}
            fontWeight="900"
          >
            {empName}
          </text>

          {/* Underline Flourish */}
          <path d="M 350 385 Q 600 405 850 385" fill="none" stroke={accentColor} strokeWidth="3" />
        </g>

        {/* DESCRIPTION / COURSE TITLE */}
        <g>
          <text
            x="600"
            y="440"
            textAnchor="middle"
            fill="#475569"
            fontSize="17"
            fontWeight="500"
          >
            for successfully completing the official corporate training course
          </text>

          {titleLines.map((line, idx) => (
            <text
              key={idx}
              x="600"
              y={line.y}
              textAnchor="middle"
              fill={primaryColor}
              fontSize={line.fontSize}
              fontWeight="800"
            >
              {line.text}
            </text>
          ))}
        </g>

        {/* BADGE / EMBLEM CENTERING */}
        <g transform="translate(560, 575)">
          <circle cx="40" cy="40" r="28" fill={accentColor} opacity="0.15" />
          <circle cx="40" cy="40" r="22" fill="none" stroke={accentColor} strokeWidth="2" />
          <path d="M 32 40 L 38 46 L 48 32" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* FOOTER SECTION: Date, Badge text, Signature */}
        <g transform="translate(0, 10)">
          {/* Left Column: Date */}
          <g transform="translate(100, 680)">
            <text x="0" y="0" fill="#64748B" fontSize="13" fontWeight="600" letterSpacing="1">COMPLETED DATE</text>
            <text x="0" y="24" fill="#0F172A" fontSize="17" fontWeight="800">{formattedDate}</text>
            <line x1="0" y1="34" x2="220" y2="34" stroke="#CBD5E1" strokeWidth="1" />
          </g>

          {/* Center Column: Verification Seal */}
          <g transform="translate(600, 695)" textAnchor="middle">
            <text x="0" y="0" textAnchor="middle" fill="#64748B" fontSize="12" fontWeight="700" letterSpacing="2">
              OFFICIAL LMS CERTIFICATION
            </text>
            <text x="0" y="18" textAnchor="middle" fill="#94A3B8" fontSize="10">
              Verified & Issued via Enterprise Learning Platform
            </text>
          </g>

          {/* Right Column: Signature Block */}
          <g transform="translate(880, 680)">
            {signatureUrl && (
              <image
                href={signatureUrl}
                x="20"
                y="-48"
                width="180"
                height="45"
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            <line x1="0" y1="34" x2="220" y2="34" stroke="#CBD5E1" strokeWidth="1" />
            {signatureName && (
              <text x="110" y="54" textAnchor="middle" fill="#0F172A" fontSize="15" fontWeight="700">
                {signatureName}
              </text>
            )}
          </g>

          {/* Dedicated Bottom-Center: Certificate ID */}
          <g transform="translate(600, 778)" textAnchor="middle">
            <text x="0" y="0" textAnchor="middle" fill="#64748B" fontSize="12" fontWeight="600" letterSpacing="1">
              CERTIFICATE ID: <tspan fill={primaryColor} fontSize="13" fontWeight="800" fontFamily="monospace">{certId}</tspan>
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
