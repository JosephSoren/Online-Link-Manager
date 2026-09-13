import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  subtitle?: string;
  categoryBadge?: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
  subtitle,
  categoryBadge,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !url) return;

    let isMounted = true;
    setIsLoading(true);

    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    a.download = `${cleanTitle || 'linkmanager'}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  return (
    <div
      className="modal-overlay"
      id="qrCodeModalOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal qr-modal-content" style={{ maxWidth: '440px', textAlign: 'center' }}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div style={{ textAlign: 'left' }}>
            <h3 id="qrModalTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', margin: 0 }}>
              <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary-color)' }}></i> Scan & Share QR Code
            </h3>
            {categoryBadge && (
              <span className="badge" style={{ marginTop: '6px', fontSize: '0.74rem' }}>
                <i className="fa-solid fa-folder-open" style={{ marginRight: '4px' }}></i>
                {categoryBadge}
              </span>
            )}
          </div>
          <button
            className="close-btn"
            id="closeQrModalBtn"
            onClick={onClose}
            title="Close QR modal"
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '8px 0 16px 0' }}>
          <p style={{ margin: '4px 0 16px 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            {subtitle || 'Point your smartphone camera at this code to open the public links directly on your mobile browser.'}
          </p>

          {/* QR Code Container */}
          <div
            id="qrCodeDisplayWrapper"
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
              padding: '16px',
              borderRadius: '16px',
              border: '2px solid var(--border-color)',
              boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.08)',
              minHeight: '260px',
              minWidth: '260px',
              position: 'relative',
            }}
          >
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--primary-color)' }}></i>
                <span style={{ fontSize: '0.85rem' }}>Generating QR code...</span>
              </div>
            ) : qrDataUrl ? (
              <>
                <img
                  id="qrCodeImage"
                  src={qrDataUrl}
                  alt={`QR Code for ${title}`}
                  style={{
                    width: '240px',
                    height: '240px',
                    display: 'block',
                    borderRadius: '8px',
                  }}
                />
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '0.74rem',
                    color: '#64748b',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="fa-solid fa-mobile-screen"></i> Scan with mobile camera
                </div>
              </>
            ) : (
              <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
                Failed to render QR code
              </div>
            )}
          </div>

          {/* Target Title and URL Display */}
          <div style={{ marginTop: '16px', textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {title}
            </div>
            <div
              id="qrTargetUrlBox"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.78rem',
                color: 'var(--primary-color)',
                backgroundColor: 'var(--bg-color)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                wordBreak: 'break-all',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {url}
              </span>
              <button
                type="button"
                id="qrCopyUrlInlineBtn"
                onClick={handleCopy}
                title="Copy URL"
                style={{
                  background: 'none',
                  border: 'none',
                  color: hasCopied ? '#10b981' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '0.85rem',
                  flexShrink: 0,
                }}
              >
                <i className={hasCopied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            id="qrDownloadBtn"
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: '0.84rem', justifyContent: 'center' }}
            onClick={handleDownload}
            disabled={!qrDataUrl || isLoading}
          >
            <i className={downloadSuccess ? 'fa-solid fa-check' : 'fa-solid fa-download'} style={{ color: downloadSuccess ? '#10b981' : undefined }}></i>
            {downloadSuccess ? 'Saved Image!' : 'Download QR'}
          </button>
          <button
            type="button"
            id="qrCopyUrlBtn"
            className="btn btn-primary"
            style={{ flex: 1, fontSize: '0.84rem', justifyContent: 'center' }}
            onClick={handleCopy}
          >
            <i className={hasCopied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
            {hasCopied ? 'URL Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
};
