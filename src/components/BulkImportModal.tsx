import React, { useState, useRef } from 'react';

export interface ExtractedLinkItem {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  isPublic: boolean;
  selected: boolean;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportLinks: (
    links: Array<{
      title: string;
      url: string;
      category: string;
      description?: string;
      isPublic?: boolean;
    }>
  ) => Promise<void>;
  availableCategories: string[];
  defaultCategory?: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportLinks,
  availableCategories,
  defaultCategory = 'Work',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted links state for review
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLinkItem[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectFile = (file: File) => {
    const validExtensions = ['.txt', '.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setErrorMessage('Please upload a .txt file, .pdf document, or image (.png, .jpg, .webp)');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('File size exceeds 25MB limit. Please upload a smaller file.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
  };

  // Helper to extract URLs and generate metadata directly on client
  const extractUrlsFromTextClient = (
    inputText: string
  ): Array<{ url: string; title: string; description: string; category: string }> => {
    if (!inputText || !inputText.trim()) return [];
    // Matches http://, https://, www., or domain names with common TLDs
    const urlRegex =
      /(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+|[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:com|org|net|io|dev|in|co|app|ai|me|edu|gov|xyz|site|online|tech|info|biz|tv|cc|to)(?:\/[^\s<>"'{}|\\^`]*)?)/gi;
    const matches = inputText.match(urlRegex) || [];
    const results: Array<{ url: string; title: string; description: string; category: string }> = [];
    const seen = new Set<string>();

    for (const m of matches) {
      let clean = m.trim().replace(/[.,;:)>\]]+$/, '');
      if (!clean.includes('.')) continue;
      let full = clean;
      if (!full.startsWith('http://') && !full.startsWith('https://')) {
        full = 'https://' + full;
      }
      const lower = full.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);

      let host = '';
      try {
        host = new URL(full).hostname.replace(/^www\./, '');
      } catch {
        host = clean;
      }

      let title = host.charAt(0).toUpperCase() + host.slice(1);
      try {
        const uObj = new URL(full);
        const pathParts = uObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = decodeURIComponent(pathParts[pathParts.length - 1]).replace(/[-_+]/g, ' ');
          if (lastPart.length > 2 && lastPart.length < 50) {
            title = `${title} - ${lastPart.charAt(0).toUpperCase() + lastPart.slice(1)}`;
          }
        }
      } catch {
        // ignore
      }

      let category = 'Work';
      const l = full.toLowerCase();
      if (l.includes('font') || l.includes('tool') || l.includes('generator') || l.includes('calc') || l.includes('convert') || l.includes('edit')) {
        category = 'Tools';
      } else if (l.includes('github') || l.includes('gitlab') || l.includes('jira') || l.includes('notion') || l.includes('slack')) {
        category = 'Work';
      } else if (l.includes('twitter') || l.includes('x.com') || l.includes('linkedin') || l.includes('instagram') || l.includes('reddit') || l.includes('youtube')) {
        category = 'Social';
      } else if (l.includes('medium') || l.includes('dev.to') || l.includes('blog') || l.includes('news') || l.includes('article') || l.includes('doc')) {
        category = 'Reading';
      }

      results.push({
        url: full,
        title,
        description: `Imported resource from ${host}`,
        category: availableCategories.includes(category) ? category : defaultCategory,
      });
    }

    return results;
  };

  // Convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Process and extract links from file or text
  const handleExtractLinks = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus('Analyzing document and extracting links...');

    try {
      let clientExtracted: Array<{ url: string; title: string; description: string; category: string }> = [];
      let payload: any = null;

      if (activeTab === 'upload') {
        if (!selectedFile) {
          setErrorMessage('Please select a file to upload.');
          setIsProcessing(false);
          return;
        }

        const isTxt = selectedFile.name.toLowerCase().endsWith('.txt') || selectedFile.type.includes('text');
        const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.type === 'application/pdf';

        if (isTxt) {
          setProcessingStatus(`Reading text file: ${selectedFile.name}...`);
          try {
            const fileText = await selectedFile.text();
            clientExtracted = extractUrlsFromTextClient(fileText);
            payload = { text: fileText };
          } catch (e) {
            console.warn('Text file read note:', e);
          }
        } else if (isPdf) {
          setProcessingStatus(`Scanning PDF: ${selectedFile.name}...`);
          try {
            const buffer = await selectedFile.arrayBuffer();
            const pdfLatinText = new TextDecoder('latin1').decode(buffer);
            // Scan for direct URLs and /URI (https://...) in PDF
            const pdfUrls = extractUrlsFromTextClient(pdfLatinText);
            const uriMatches = pdfLatinText.match(/\/URI\s*\(([^)]+)\)/g) || [];
            const additionalUrls: string[] = [];
            for (const um of uriMatches) {
              const cleaned = um.replace(/^\/URI\s*\(/, '').replace(/\)$/, '').trim();
              if (cleaned && !additionalUrls.includes(cleaned)) additionalUrls.push(cleaned);
            }
            const combinedPdfText = additionalUrls.join('\n') + '\n' + pdfLatinText;
            clientExtracted = extractUrlsFromTextClient(combinedPdfText);
          } catch (e) {
            console.warn('PDF client scan note:', e);
          }

          const base64Data = await fileToBase64(selectedFile);
          payload = {
            fileData: base64Data,
            mimeType: 'application/pdf',
            fileName: selectedFile.name,
          };
        } else {
          // Images (.png, .jpg, .jpeg, .webp)
          setProcessingStatus(`Analyzing image with AI: ${selectedFile.name}...`);
          const base64Data = await fileToBase64(selectedFile);
          payload = {
            fileData: base64Data,
            mimeType: selectedFile.type || 'image/png',
            fileName: selectedFile.name,
          };
        }
      } else {
        // Text tab
        if (!pastedText.trim()) {
          setErrorMessage('Please paste or type text containing web links.');
          setIsProcessing(false);
          return;
        }

        setProcessingStatus('Extracting links and smart descriptions...');
        clientExtracted = extractUrlsFromTextClient(pastedText);
        payload = {
          text: pastedText.trim(),
        };
      }

      // Try server extraction with AI
      let serverLinks: any[] = [];
      let apiError: string | null = null;

      if (payload) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const res = await fetch('/api/extract-links', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (res.ok && data?.links && Array.isArray(data.links) && data.links.length > 0) {
              serverLinks = data.links;
            } else if (data?.error) {
              apiError = data.error;
            }
          } else {
            console.warn('Server returned non-JSON response:', res.status, contentType);
          }
        } catch (fetchErr: any) {
          console.warn('API call skipped or failed, using local extraction:', fetchErr?.message || fetchErr);
        }
      }

      // Combine server links and client extracted links (prefer server AI links if present)
      let finalLinks: Array<{ url: string; title: string; description: string; category: string }> = [];

      if (serverLinks.length > 0) {
        finalLinks = serverLinks;
        // Merge any client-extracted links that AI may have missed
        const existing = new Set(serverLinks.map((l) => l.url.toLowerCase()));
        for (const cl of clientExtracted) {
          if (!existing.has(cl.url.toLowerCase())) {
            finalLinks.push(cl);
            existing.add(cl.url.toLowerCase());
          }
        }
      } else if (clientExtracted.length > 0) {
        finalLinks = clientExtracted;
      }

      if (finalLinks.length === 0) {
        if (apiError) {
          setErrorMessage(apiError);
        } else {
          setErrorMessage(
            activeTab === 'upload' && selectedFile?.type?.startsWith('image/')
              ? 'Could not extract links from this image. The AI image service might be busy, or no clear URL text was detected in the screenshot. Please try pasting the links directly in the "Paste Text" tab.'
              : 'No web links or URLs were found in the uploaded file/text. Please ensure it contains valid website URLs (e.g. https://example.com).'
          );
        }
        setIsProcessing(false);
        return;
      }

      // Format links for preview table
      const formatted: ExtractedLinkItem[] = finalLinks.map((item: any, idx: number) => ({
        id: `extracted-${Date.now()}-${idx}`,
        url: item.url,
        title: item.title || item.url,
        description: item.description || `Imported resource`,
        category: availableCategories.includes(item.category) ? item.category : defaultCategory,
        isPublic: false,
        selected: true,
      }));

      setExtractedLinks(formatted);
      setStep('preview');
    } catch (err: any) {
      console.error('Extraction error:', err);
      setErrorMessage(err.message || 'Error occurred while extracting links.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Preview editing handlers
  const handleToggleSelectAll = (select: boolean) => {
    setExtractedLinks((prev) => prev.map((l) => ({ ...l, selected: select })));
  };

  const handleToggleLinkSelection = (id: string) => {
    setExtractedLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, selected: !l.selected } : l))
    );
  };

  const handleUpdateLink = (id: string, field: keyof ExtractedLinkItem, value: any) => {
    setExtractedLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const handleRemoveLink = (id: string) => {
    setExtractedLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleApplyGlobalCategory = (cat: string) => {
    setExtractedLinks((prev) => prev.map((l) => ({ ...l, category: cat })));
  };

  const handleApplyGlobalPublic = (isPublic: boolean) => {
    setExtractedLinks((prev) => prev.map((l) => ({ ...l, isPublic })));
  };

  // Final submit handler
  const handleFinalImport = async () => {
    const selected = extractedLinks.filter((l) => l.selected);
    if (selected.length === 0) {
      setErrorMessage('Please select at least one link to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onImportLinks(
        selected.map((l) => ({
          title: l.title.trim() || l.url,
          url: l.url.trim(),
          category: l.category,
          description: l.description.trim(),
          isPublic: l.isPublic,
        }))
      );
      // Reset & close
      handleReset();
      onClose();
    } catch (err: any) {
      console.error('Final import error:', err);
      setErrorMessage(err.message || 'Failed to save imported links.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep('input');
    setSelectedFile(null);
    setPastedText('');
    setExtractedLinks([]);
    setErrorMessage(null);
    setIsProcessing(false);
  };

  const selectedCount = extractedLinks.filter((l) => l.selected).length;

  // Clean friendly error message formatter to prevent raw JSON dumps
  const formatFriendlyError = (raw: string | null): string => {
    if (!raw) return '';
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed?.error?.message) {
          if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE' || parsed.error.message.includes('high demand')) {
            return 'AI service is temporarily busy due to high demand. Please click "Extract Links" again to retry.';
          }
          return parsed.error.message;
        }
      }
    } catch {
      // not json
    }
    if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
      return 'AI service is temporarily experiencing high demand. Please try again in a few moments, or paste links in the text tab.';
    }
    return raw;
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: step === 'preview' ? '820px' : '620px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          transition: 'max-width 0.25s ease',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--card-bg, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i className="fa-solid fa-file-import"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {step === 'preview' ? 'Review & Import Links' : 'Bulk Import Links'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {step === 'preview'
                  ? `Found ${extractedLinks.length} links. Choose which to add to your collection.`
                  : 'Import multiple links from .txt documents, PDF files, screenshots, or pasted text.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            style={{ fontSize: '1.4rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                lineHeight: 1.4,
              }}
            >
              <i className="fa-solid fa-circle-exclamation" style={{ marginTop: '2px', flexShrink: 0 }}></i>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>Notice: </span>
                <span>{formatFriendlyError(errorMessage)}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  padding: '0 4px',
                  opacity: 0.7,
                }}
                title="Dismiss"
              >
                &times;
              </button>
            </div>
          )}

          {step === 'input' && (
            <div>
              {/* Tab Selector */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '18px',
                  backgroundColor: 'var(--bg-color)',
                  padding: '4px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('upload');
                    setErrorMessage(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: activeTab === 'upload' ? 'var(--card-bg)' : 'transparent',
                    color: activeTab === 'upload' ? 'var(--primary-color)' : 'var(--text-secondary)',
                    boxShadow: activeTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  Upload File (.txt, .pdf, image)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('text');
                    setErrorMessage(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: activeTab === 'text' ? 'var(--card-bg)' : 'transparent',
                    color: activeTab === 'text' ? 'var(--primary-color)' : 'var(--text-secondary)',
                    boxShadow: activeTab === 'text' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-align-left"></i>
                  Paste Text / Notes
                </button>
              </div>

              {/* Tab 1: Upload File */}
              {activeTab === 'upload' && (
                <div>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      padding: '36px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-color)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf,image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleSelectFile(e.target.files[0]);
                        }
                      }}
                    />

                    {selectedFile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.3rem',
                          }}
                        >
                          {selectedFile.name.endsWith('.pdf') ? (
                            <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i>
                          ) : selectedFile.type.startsWith('image/') ? (
                            <i className="fa-solid fa-file-image" style={{ color: '#3b82f6' }}></i>
                          ) : (
                            <i className="fa-solid fa-file-lines" style={{ color: '#10b981' }}></i>
                          )}
                        </div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{selectedFile.name}</h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to choose a different file
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            color: 'var(--primary-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem',
                          }}
                        >
                          <i className="fa-solid fa-cloud-arrow-up"></i>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
                            Drag and drop your file here, or <span style={{ color: 'var(--primary-color)' }}>browse</span>
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Supports text lists (.txt), PDF reports (.pdf), or screenshot images (.png, .jpg)
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                          <span className="badge" style={{ fontSize: '0.72rem' }}>
                            <i className="fa-solid fa-file-lines" style={{ marginRight: '4px' }}></i> .txt
                          </span>
                          <span className="badge" style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                            <i className="fa-solid fa-file-pdf" style={{ marginRight: '4px' }}></i> .pdf
                          </span>
                          <span className="badge" style={{ fontSize: '0.72rem', color: '#3b82f6' }}>
                            <i className="fa-solid fa-image" style={{ marginRight: '4px' }}></i> .png / .jpg
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Paste Text */}
              {activeTab === 'text' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 600 }}>Paste text containing links:</label>
                    <button
                      type="button"
                      onClick={() =>
                        setPastedText(
                          'Frontend Dev Resources:\n• React: https://react.dev - Official React documentation\n• Tailwind CSS: https://tailwindcss.com - Rapid styling\n• GitHub: https://github.com - Code hosting\n• Vite: https://vite.dev - Next generation frontend tooling'
                        )
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles"></i> Insert Example
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    className="form-control"
                    placeholder="Paste a list of URLs, chat messages, markdown links, or notes here..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    style={{ width: '100%', fontSize: '0.86rem', resize: 'vertical' }}
                  ></textarea>
                </div>
              )}

              {/* Processing Spinner */}
              {isProcessing && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '24px 0',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '3px solid var(--border-color)',
                      borderTopColor: 'var(--primary-color)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  ></div>
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                    {processingStatus || 'Extracting links with AI...'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview Extracted Links */}
          {step === 'preview' && (
            <div>
              {/* Batch Controls Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-color)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCount === extractedLinks.length && extractedLinks.length > 0}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span>Select All ({extractedLinks.length})</span>
                  </label>
                  <span className="badge" style={{ fontSize: '0.75rem' }}>
                    {selectedCount} selected
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Global Category setter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Set Category:</span>
                    <select
                      className="form-control"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleApplyGlobalCategory(e.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Choose...
                      </option>
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Global Public toggle */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => handleApplyGlobalPublic(true)}
                      title="Mark all extracted links as Public"
                    >
                      <i className="fa-solid fa-globe" style={{ color: '#10b981' }}></i> All Public
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => handleApplyGlobalPublic(false)}
                      title="Mark all extracted links as Private"
                    >
                      <i className="fa-solid fa-lock"></i> All Private
                    </button>
                  </div>
                </div>
              </div>

              {/* List of Extracted Links */}
              <div
                style={{
                  maxHeight: '380px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  backgroundColor: 'var(--card-bg)',
                }}
              >
                {extractedLinks.map((link) => {
                  let hostname = '';
                  try {
                    hostname = new URL(link.url).hostname.replace(/^www\./, '');
                  } catch {
                    hostname = link.url;
                  }
                  const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

                  return (
                    <div
                      key={link.id}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        backgroundColor: link.selected ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={link.selected}
                        onChange={() => handleToggleLinkSelection(link.id)}
                        style={{ cursor: 'pointer', marginTop: '6px', width: '16px', height: '16px' }}
                      />

                      {/* Favicon */}
                      <img
                        src={favicon}
                        alt="icon"
                        style={{ width: '20px', height: '20px', borderRadius: '4px', marginTop: '4px' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://www.google.com/s2/favicons?domain=google.com&sz=64';
                        }}
                      />

                      {/* Fields */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="form-control"
                            value={link.title}
                            onChange={(e) => handleUpdateLink(link.id, 'title', e.target.value)}
                            placeholder="Link Title"
                            style={{ flex: 1, minWidth: '180px', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 600 }}
                          />
                          <select
                            className="form-control"
                            value={link.category}
                            onChange={(e) => handleUpdateLink(link.id, 'category', e.target.value)}
                            style={{ width: '120px', padding: '4px 8px', fontSize: '0.8rem' }}
                          >
                            {availableCategories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              color: link.isPublic ? '#10b981' : 'var(--text-secondary)',
                              fontWeight: 600,
                              background: 'var(--bg-color)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={link.isPublic}
                              onChange={(e) => handleUpdateLink(link.id, 'isPublic', e.target.checked)}
                              style={{ width: '14px', height: '14px' }}
                            />
                            {link.isPublic ? 'Public' : 'Private'}
                          </label>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="form-control"
                            value={link.url}
                            onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                            placeholder="https://..."
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              color: 'var(--primary-color)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveLink(link.id)}
                            className="btn-icon-subtle"
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              fontSize: '0.85rem',
                            }}
                            title="Exclude this link"
                          >
                            <i className="fa-regular fa-trash-can"></i>
                          </button>
                        </div>

                        {link.description && (
                          <input
                            type="text"
                            className="form-control"
                            value={link.description}
                            onChange={(e) => handleUpdateLink(link.id, 'description', e.target.value)}
                            placeholder="Brief note..."
                            style={{ padding: '3px 8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--card-bg)',
          }}
        >
          {step === 'input' ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExtractLinks}
                disabled={isProcessing || (activeTab === 'upload' && !selectedFile) || (activeTab === 'text' && !pastedText.trim())}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isProcessing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <span>Extract Links</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('input')}
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-arrow-left"></i> Back / Re-upload
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFinalImport}
                  disabled={isSubmitting || selectedCount === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>Import {selectedCount} {selectedCount === 1 ? 'Link' : 'Links'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
