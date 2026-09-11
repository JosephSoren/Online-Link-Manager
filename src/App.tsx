import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import jsPDF from 'jspdf';

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: 'Work' | 'Social' | 'Tools' | 'Reading' | 'Personal' | string;
  description?: string;
  createdAt: string;
  userId?: string;
  isPublic?: boolean;
}

const INITIAL_LINKS: LinkItem[] = [
  {
    id: '1',
    title: 'Google Search Engine',
    url: 'https://google.com',
    category: 'Tools',
    description: 'Quick web access for inquiries and searching.',
    createdAt: new Date().toISOString(),
    isPublic: true,
  },
  {
    id: '2',
    title: 'GitHub Repository',
    url: 'https://github.com',
    category: 'Work',
    description: 'Source code management and version control.',
    createdAt: new Date().toISOString(),
    isPublic: true,
  }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Modals state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCategory, setFormCategory] = useState('Work');
  const [formDescription, setFormDescription] = useState('');
  const [formIsPublic, setFormIsPublic] = useState(false);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<LinkItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Share to Public Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingLink, setSharingLink] = useState<LinkItem | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Shared Link Viewer (for incoming ?share=... links)
  const [sharedViewerLink, setSharedViewerLink] = useState<LinkItem | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const isDark = savedTheme === 'dark';
    setIsDarkMode(isDark);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync links
  useEffect(() => {
    if (authLoading) return;

    if (currentUser) {
      // Sync from Firestore: users/{uid}/links
      const linksRef = collection(db, 'users', currentUser.uid, 'links');
      const q = query(linksRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: LinkItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            items.push({
              id: docSnap.id,
              title: data.title || '',
              url: data.url || '',
              category: data.category || 'Work',
              description: data.description || '',
              createdAt: data.createdAt || new Date().toISOString(),
              userId: currentUser.uid,
              isPublic: Boolean(data.isPublic),
            });
          });

          // If new user with no links, seed with initial demo links
          if (items.length === 0 && !snapshot.metadata.hasPendingWrites) {
            const localData = localStorage.getItem('linkmanager_data');
            const toSeed: LinkItem[] = localData ? JSON.parse(localData) : INITIAL_LINKS;

            const batch = writeBatch(db);
            toSeed.forEach((item) => {
              const newRef = doc(collection(db, 'users', currentUser.uid, 'links'));
              batch.set(newRef, {
                title: item.title,
                url: item.url,
                category: item.category,
                description: item.description || '',
                createdAt: item.createdAt || new Date().toISOString(),
                isPublic: Boolean(item.isPublic),
              });
            });
            batch.commit().catch(console.error);
          } else {
            setLinks(items);
          }
        },
        (err) => {
          console.error('Firestore snapshot error:', err);
        }
      );

      return () => unsubscribe();
    } else {
      // Load from LocalStorage
      const saved = localStorage.getItem('linkmanager_data');
      if (saved) {
        try {
          setLinks(JSON.parse(saved));
        } catch {
          setLinks(INITIAL_LINKS);
        }
      } else {
        setLinks(INITIAL_LINKS);
        localStorage.setItem('linkmanager_data', JSON.stringify(INITIAL_LINKS));
      }
    }
  }, [currentUser, authLoading]);

  // Check for incoming shared link in URL (e.g. ?share=... &uid=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    const shareUid = params.get('uid');

    if (shareId) {
      // First check in currently loaded links
      const found = links.find((l) => l.id === shareId);
      if (found) {
        setSharedViewerLink(found);
      } else if (shareUid) {
        // Fetch public document from Firestore
        getDoc(doc(db, 'users', shareUid, 'links', shareId))
          .then((snap) => {
            if (snap.exists()) {
              const d = snap.data();
              setSharedViewerLink({
                id: snap.id,
                title: d.title || '',
                url: d.url || '',
                category: d.category || 'Work',
                description: d.description || '',
                createdAt: d.createdAt || new Date().toISOString(),
                userId: shareUid,
                isPublic: Boolean(d.isPublic),
              });
            }
          })
          .catch((err) => {
            console.error('Could not fetch shared link:', err);
          });
      }
    }
  }, [links]);

  const saveLocalLinks = (newLinks: LinkItem[]) => {
    setLinks(newLinks);
    localStorage.setItem('linkmanager_data', JSON.stringify(newLinks));
  };

  // Helper domain
  const getDomain = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return url.hostname.replace('www.', '');
    } catch {
      return urlStr;
    }
  };

  // Copy to clipboard
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopyNotification('URL copied to clipboard!');
      setTimeout(() => setCopyNotification(null), 2200);
    });
  };

  // Open add/edit modal
  const handleOpenAddModal = () => {
    setEditingLink(null);
    setFormTitle('');
    setFormUrl('');
    setFormCategory('Work');
    setFormDescription('');
    setFormIsPublic(false);
    setIsLinkModalOpen(true);
  };

  const handleOpenEditModal = (link: LinkItem) => {
    setEditingLink(link);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormCategory(link.category);
    setFormDescription(link.description || '');
    setFormIsPublic(Boolean(link.isPublic));
    setIsLinkModalOpen(true);
  };

  // Submit link
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();

    let url = formUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (editingLink) {
      // Update
      if (currentUser) {
        const linkRef = doc(db, 'users', currentUser.uid, 'links', editingLink.id);
        await updateDoc(linkRef, {
          title: formTitle.trim(),
          url: url,
          category: formCategory,
          description: formDescription.trim(),
          isPublic: formIsPublic,
        });
      } else {
        const updated = links.map((l) =>
          l.id === editingLink.id
            ? {
                ...l,
                title: formTitle.trim(),
                url: url,
                category: formCategory,
                description: formDescription.trim(),
                isPublic: formIsPublic,
              }
            : l
        );
        saveLocalLinks(updated);
      }
    } else {
      // Add
      if (currentUser) {
        const newRef = doc(collection(db, 'users', currentUser.uid, 'links'));
        await setDoc(newRef, {
          title: formTitle.trim(),
          url: url,
          category: formCategory,
          description: formDescription.trim(),
          isPublic: formIsPublic,
          createdAt: new Date().toISOString(),
        });
      } else {
        const newLink: LinkItem = {
          id: Date.now().toString(),
          title: formTitle.trim(),
          url: url,
          category: formCategory,
          description: formDescription.trim(),
          isPublic: formIsPublic,
          createdAt: new Date().toISOString(),
        };
        saveLocalLinks([newLink, ...links]);
      }
    }

    setIsLinkModalOpen(false);
  };

  // Delete modal handlers
  const handleOpenDeleteModal = (link: LinkItem) => {
    setLinkToDelete(link);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!linkToDelete) return;
    setIsDeleting(true);
    try {
      if (currentUser) {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'links', linkToDelete.id));
      } else {
        const updated = links.filter((l) => l.id !== linkToDelete.id);
        saveLocalLinks(updated);
      }
      setIsDeleteModalOpen(false);
      setLinkToDelete(null);
      setCopyNotification('Bookmark deleted successfully');
      setTimeout(() => setCopyNotification(null), 2200);
    } catch (err) {
      console.error('Delete error:', err);
      setCopyNotification('Failed to delete bookmark');
      setTimeout(() => setCopyNotification(null), 2200);
    } finally {
      setIsDeleting(false);
    }
  };

  // Share handlers
  const handleOpenShareModal = (link: LinkItem) => {
    setSharingLink(link);
    setShareCopied(false);
    setIsShareModalOpen(true);
  };

  const handleTogglePublic = async (link: LinkItem) => {
    const newStatus = !link.isPublic;
    const updated = links.map((l) => (l.id === link.id ? { ...l, isPublic: newStatus } : l));
    setLinks(updated);
    setSharingLink({ ...link, isPublic: newStatus });

    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'links', link.id);
        await updateDoc(docRef, { isPublic: newStatus });
      } catch (err) {
        console.error('Error updating public status:', err);
      }
    } else {
      saveLocalLinks(updated);
    }

    setCopyNotification(newStatus ? 'Link is now publicly accessible!' : 'Link set to private');
    setTimeout(() => setCopyNotification(null), 2200);
  };

  const getPublicShareUrl = (link: LinkItem) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const uidPart = link.userId || (currentUser ? currentUser.uid : '');
    const uidQuery = uidPart ? `&uid=${encodeURIComponent(uidPart)}` : '';
    return `${origin}${pathname}?share=${encodeURIComponent(link.id)}${uidQuery}`;
  };

  const handleCopyShareUrl = (link: LinkItem) => {
    const url = getPublicShareUrl(link);
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setCopyNotification('Public share link copied to clipboard!');
      setTimeout(() => setShareCopied(false), 2500);
      setTimeout(() => setCopyNotification(null), 2500);
    });
  };

  const handleNativeShare = async (link: LinkItem) => {
    const shareUrl = getPublicShareUrl(link);
    if (navigator.share) {
      try {
        await navigator.share({
          title: link.title,
          text: link.description || `Check out ${link.title} on LinkManager:`,
          url: shareUrl,
        });
      } catch {
        // User closed share dialog
      }
    } else {
      handleCopyShareUrl(link);
    }
  };

  // Save a shared link into user's own collection
  const handleSaveSharedToMyLinks = async (sharedItem: LinkItem) => {
    if (currentUser) {
      try {
        const newRef = doc(collection(db, 'users', currentUser.uid, 'links'));
        await setDoc(newRef, {
          title: sharedItem.title,
          url: sharedItem.url,
          category: sharedItem.category,
          description: sharedItem.description || '',
          isPublic: false,
          createdAt: new Date().toISOString(),
        });
        setCopyNotification('Bookmark added to your collection!');
        setTimeout(() => setCopyNotification(null), 2200);
        setSharedViewerLink(null);
      } catch (err) {
        console.error('Save shared link error:', err);
      }
    } else {
      const newLink: LinkItem = {
        id: Date.now().toString(),
        title: sharedItem.title,
        url: sharedItem.url,
        category: sharedItem.category,
        description: sharedItem.description || '',
        isPublic: false,
        createdAt: new Date().toISOString(),
      };
      saveLocalLinks([newLink, ...links]);
      setCopyNotification('Bookmark added to your collection!');
      setTimeout(() => setCopyNotification(null), 2200);
      setSharedViewerLink(null);
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(links, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'linkmanager_backup.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export PDF
  const handleExportPDF = () => {
    const itemsToExport = filteredLinks.length > 0 ? filteredLinks : links;
    if (itemsToExport.length === 0) {
      setCopyNotification('No links available to export');
      setTimeout(() => setCopyNotification(null), 2200);
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;

      let currentY = 22;

      const drawHeader = (pageNumber: number) => {
        if (pageNumber === 1) {
          // Brand title
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(22);
          doc.setTextColor(37, 99, 235); // Blue
          doc.text('LinkManager', margin, currentY);
          const brandWidth = doc.getTextWidth('LinkManager');
          doc.setTextColor(16, 185, 129); // Green
          doc.text('.in', margin + brandWidth, currentY);

          // Subtitle
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(100, 116, 139); // Slate-500
          doc.text(
            currentCategory === 'All'
              ? 'Complete Bookmarks & Web Resources Export'
              : `Bookmarks Export • ${currentCategory} Category`,
            margin,
            currentY + 6.5
          );

          // Meta on top right
          const nowStr = new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`Exported: ${nowStr} • ${itemsToExport.length} links`, pageWidth - margin, currentY + 3, {
            align: 'right',
          });

          // Divider rule
          currentY += 12;
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.4);
          doc.line(margin, currentY, pageWidth - margin, currentY);
          currentY += 8;
        } else {
          // Running header on page 2+
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(37, 99, 235);
          doc.text('LinkManager.in', margin, 14);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          doc.text('Bookmarks Report', margin + 34, 14);

          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(margin, 17, pageWidth - margin, 17);
          currentY = 24;
        }
      };

      drawHeader(1);

      itemsToExport.forEach((item) => {
        const title = item.title || 'Untitled Link';
        const url = item.url || '';
        const category = item.category || 'General';
        const description = item.description?.trim() || '';

        // Calculate height needed
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const descLines = description ? doc.splitTextToSize(description, contentWidth - 8) : [];
        const descHeight = descLines.length > 0 ? descLines.length * 4.2 + 2 : 0;
        const blockHeight = 16 + descHeight;

        // Check page boundary
        if (currentY + blockHeight > pageHeight - 18) {
          doc.addPage();
          drawHeader(doc.getNumberOfPages());
        }

        // Card box background
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, currentY, contentWidth, blockHeight, 2, 2, 'FD');

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        const maxTitleWidth = contentWidth - 42;
        let displayTitle = title;
        while (doc.getTextWidth(displayTitle) > maxTitleWidth && displayTitle.length > 5) {
          displayTitle = displayTitle.slice(0, -4) + '...';
        }
        doc.text(displayTitle, margin + 4, currentY + 6);

        // Category Tag
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const badgeWidth = doc.getTextWidth(category) + 8;
        const badgeX = pageWidth - margin - badgeWidth - 4;
        doc.setFillColor(238, 242, 255);
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(badgeX, currentY + 2.5, badgeWidth, 5, 1.2, 1.2, 'FD');
        doc.setTextColor(37, 99, 235);
        doc.text(category, badgeX + 4, currentY + 6);

        // URL Link
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(37, 99, 235);
        const displayUrl = url.length > 80 ? url.slice(0, 78) + '...' : url;
        doc.text(displayUrl, margin + 4, currentY + 11.5);
        doc.link(margin + 4, currentY + 8, contentWidth - 8, 5, { url });

        // Description
        if (descLines.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          let descY = currentY + 16.5;
          descLines.forEach((line: string) => {
            doc.text(line, margin + 4, descY);
            descY += 4.2;
          });
        }

        currentY += blockHeight + 3;
      });

      // Running page footers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.text('Generated from LinkManager.in', margin, pageHeight - 7);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, {
          align: 'right',
        });
      }

      const fileCategory = currentCategory === 'All' ? 'All_Links' : currentCategory.replace(/\s+/g, '_');
      doc.save(`LinkManager_${fileCategory}_${new Date().toISOString().slice(0, 10)}.pdf`);

      setCopyNotification('PDF exported successfully!');
      setTimeout(() => setCopyNotification(null), 2200);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setCopyNotification('Error generating PDF');
      setTimeout(() => setCopyNotification(null), 2200);
    }
  };

  // Auth actions
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message || 'Google Sign-in failed');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        const res = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (authName.trim()) {
          await updateProfile(res.user, { displayName: authName.trim() });
        }
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      let msg = err.message || 'Authentication error';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Email already registered. Please sign in.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Filtered links
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      const matchesCategory =
        currentCategory === 'All' || link.category === currentCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        link.title.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        (link.description && link.description.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [links, currentCategory, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: links.length,
      Work: 0,
      Social: 0,
      Tools: 0,
      Reading: 0,
      Personal: 0,
    };
    links.forEach((l) => {
      if (map[l.category] !== undefined) {
        map[l.category]++;
      }
    });
    return map;
  }, [links]);

  return (
    <>
      {/* Toast Notification */}
      {copyNotification && (
        <div
          id="copyToast"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-check" style={{ color: '#10b981' }}></i>
          <span>{copyNotification}</span>
        </div>
      )}

      {/* Navigation / Header */}
      <header className="navbar" id="navbar">
        <div className="logo" id="appLogo">
          <i className="fa-solid fa-link logo-icon"></i>
          <span>
            LinkManager<span className="domain">.in</span>
          </span>
        </div>

        <div className="nav-controls">
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              id="searchInput"
              placeholder="Search links or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            id="themeToggleBtn"
            className="icon-btn"
            title="Toggle Dark/Light Mode"
            onClick={toggleTheme}
          >
            <i className={isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
          </button>

          {/* Firebase Authentication Button / Profile */}
          {currentUser ? (
            <div className="user-profile-badge" id="userProfileBadge">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="avatar"
                  className="user-avatar"
                />
              ) : (
                <div className="user-avatar">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
              <button
                id="signOutBtn"
                onClick={handleSignOut}
                title="Sign out"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
              </button>
            </div>
          ) : (
            <button
              id="authOpenBtn"
              className="btn btn-secondary"
              onClick={() => {
                setIsLoginMode(true);
                setAuthError(null);
                setIsAuthModalOpen(true);
              }}
              title="Sign in with Firebase to sync your links"
            >
              <i className="fa-solid fa-user"></i> Sign In
            </button>
          )}

          <button id="addLinkBtn" className="btn btn-primary" onClick={handleOpenAddModal}>
            <i className="fa-solid fa-plus"></i> Add Link
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="app-container" id="appContainer">
        {/* Sidebar: Categories */}
        <aside className="sidebar" id="sidebar">
          <div className="sidebar-header">
            <h3>Categories</h3>
          </div>
          <ul className="category-list" id="categoryList">
            <li
              className={currentCategory === 'All' ? 'active' : ''}
              data-category="All"
              id="catAll"
              onClick={() => setCurrentCategory('All')}
            >
              <i className="fa-solid fa-border-all"></i> All Links{' '}
              <span className="count-badge" id="countAll">
                {counts.All}
              </span>
            </li>
            <li
              className={currentCategory === 'Work' ? 'active' : ''}
              data-category="Work"
              id="catWork"
              onClick={() => setCurrentCategory('Work')}
            >
              <i className="fa-solid fa-briefcase"></i> Work{' '}
              <span className="count-badge" id="countWork">
                {counts.Work}
              </span>
            </li>
            <li
              className={currentCategory === 'Social' ? 'active' : ''}
              data-category="Social"
              id="catSocial"
              onClick={() => setCurrentCategory('Social')}
            >
              <i className="fa-solid fa-hashtag"></i> Social{' '}
              <span className="count-badge" id="countSocial">
                {counts.Social}
              </span>
            </li>
            <li
              className={currentCategory === 'Tools' ? 'active' : ''}
              data-category="Tools"
              id="catTools"
              onClick={() => setCurrentCategory('Tools')}
            >
              <i className="fa-solid fa-wrench"></i> Tools{' '}
              <span className="count-badge" id="countTools">
                {counts.Tools}
              </span>
            </li>
            <li
              className={currentCategory === 'Reading' ? 'active' : ''}
              data-category="Reading"
              id="catReading"
              onClick={() => setCurrentCategory('Reading')}
            >
              <i className="fa-solid fa-book-bookmark"></i> Reading{' '}
              <span className="count-badge" id="countReading">
                {counts.Reading}
              </span>
            </li>
            <li
              className={currentCategory === 'Personal' ? 'active' : ''}
              data-category="Personal"
              id="catPersonal"
              onClick={() => setCurrentCategory('Personal')}
            >
              <i className="fa-solid fa-user"></i> Personal{' '}
              <span className="count-badge" id="countPersonal">
                {counts.Personal}
              </span>
            </li>
          </ul>

          <div className="sidebar-footer" id="sidebarFooter">
            <button id="exportPdfBtn" className="btn btn-outline-sm" onClick={handleExportPDF} title="Export bookmarks as a PDF document">
              <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i> Export PDF
            </button>
            <button id="exportDataBtn" className="btn btn-outline-sm" onClick={handleExportJSON} title="Export bookmarks as a JSON backup">
              <i className="fa-solid fa-file-code"></i> Export JSON
            </button>
          </div>
        </aside>

        {/* Main Content Grid */}
        <main className="main-content" id="mainContent">
          <div className="content-header" id="contentHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 id="currentCategoryTitle">
                {currentCategory === 'All' ? 'All Links' : `${currentCategory} Links`}
              </h2>
              <span id="totalLinksSubtitle" className="subtitle">
                {filteredLinks.length} items saved
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                id="headerExportPdfBtn"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                onClick={handleExportPDF}
                title="Export current view as PDF"
              >
                <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i> Export PDF
              </button>
            </div>
          </div>

          {/* Link Cards Grid Container */}
          <div className="links-grid" id="linksGrid">
            {filteredLinks.map((link) => {
              const domain = getDomain(link.url);
              const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

              return (
                <div className="card" key={link.id} id={`card-${link.id}`}>
                  <div>
                    <div className="card-header">
                      <img
                        src={faviconUrl}
                        className="favicon"
                        alt="Icon"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://www.google.com/s2/favicons?domain=google.com&sz=64';
                        }}
                      />
                      <div className="card-title-area">
                        <h4>{link.title}</h4>
                        <span className="domain-tag">{domain}</span>
                      </div>
                    </div>
                    <p className="card-description">
                      {link.description || 'No description added.'}
                    </p>
                  </div>
                  <div className="card-footer">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className="badge">{link.category}</span>
                      {link.isPublic && (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                          }}
                          onClick={() => handleOpenShareModal(link)}
                          title="This bookmark is shared publicly. Click to manage sharing."
                        >
                          <i className="fa-solid fa-globe" style={{ fontSize: '0.65rem' }}></i> Public
                        </span>
                      )}
                    </div>
                    <div className="card-actions">
                      <button
                        id={`copyBtn-${link.id}`}
                        onClick={() => copyToClipboard(link.url)}
                        title="Copy URL"
                      >
                        <i className="fa-regular fa-copy"></i>
                      </button>
                      <button
                        id={`shareBtn-${link.id}`}
                        onClick={() => handleOpenShareModal(link)}
                        title="Share link to public"
                        style={{ color: link.isPublic ? 'var(--accent-green)' : undefined }}
                      >
                        <i className="fa-solid fa-share-nodes"></i>
                      </button>
                      <a
                        id={`openBtn-${link.id}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Link in New Tab"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                      <button
                        id={`editBtn-${link.id}`}
                        onClick={() => handleOpenEditModal(link)}
                        title="Edit Link"
                      >
                        <i className="fa-regular fa-pen-to-square"></i>
                      </button>
                      <button
                        id={`deleteBtn-${link.id}`}
                        className="delete-btn"
                        onClick={() => handleOpenDeleteModal(link)}
                        title="Delete Link"
                      >
                        <i className="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State View */}
          {filteredLinks.length === 0 && (
            <div className="empty-state" id="emptyState">
              <i className="fa-solid fa-link-slash"></i>
              <h3>No links found</h3>
              <p>
                Click &quot;Add Link&quot; to save your first bookmark or clear your search query.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Modal Dialog: Add / Edit Link */}
      {isLinkModalOpen && (
        <div
          className="modal-overlay"
          id="linkModal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLinkModalOpen(false);
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h3 id="modalTitle">{editingLink ? 'Edit Link' : 'Add New Link'}</h3>
              <button
                className="close-btn"
                id="closeModalBtn"
                onClick={() => setIsLinkModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form id="linkForm" onSubmit={handleSaveLink}>
              <div className="form-group">
                <label htmlFor="linkTitle">Title</label>
                <input
                  type="text"
                  id="linkTitle"
                  placeholder="e.g. GitHub Dashboard"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="linkUrl">URL</label>
                <input
                  type="text"
                  id="linkUrl"
                  placeholder="https://github.com"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="linkCategory">Category</label>
                <select
                  id="linkCategory"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  <option value="Work">Work</option>
                  <option value="Social">Social</option>
                  <option value="Tools">Tools</option>
                  <option value="Reading">Reading</option>
                  <option value="Personal">Personal</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="linkDescription">Notes / Description (Optional)</label>
                <textarea
                  id="linkDescription"
                  rows={3}
                  placeholder="Brief note about this link..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                ></textarea>
              </div>

              <div className="public-switch-bar" style={{ marginBottom: '1.25rem', marginTop: 0 }}>
                <div className="switch-label">
                  <span className="title">Public Access</span>
                  <span className="desc">Allow this bookmark to be shared publicly with others</span>
                </div>
                <label className="toggle-switch" htmlFor="formIsPublicToggle">
                  <input
                    type="checkbox"
                    id="formIsPublicToggle"
                    checked={formIsPublic}
                    onChange={(e) => setFormIsPublic(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  id="cancelModalBtn"
                  onClick={() => setIsLinkModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" id="saveModalSubmitBtn">
                  {editingLink ? 'Update Link' : 'Save Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Firebase Authentication */}
      {isAuthModalOpen && (
        <div
          className="modal-overlay"
          id="authModal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAuthModalOpen(false);
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h3 id="authModalTitle">
                {isLoginMode ? 'Sign in to LinkManager' : 'Create an Account'}
              </h3>
              <button
                className="close-btn"
                id="closeAuthModalBtn"
                onClick={() => setIsAuthModalOpen(false)}
              >
                &times;
              </button>
            </div>

            {authError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--accent-red)',
                  border: '1px solid var(--accent-red)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                {authError}
              </div>
            )}

            {/* Google Sign-In */}
            <button
              id="googleSignInBtn"
              type="button"
              className="btn btn-secondary"
              onClick={handleGoogleSignIn}
              disabled={authSubmitting}
              style={{
                width: '100%',
                justifyContent: 'center',
                marginBottom: '1rem',
                gap: '10px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.24v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.24C.45 8.16 0 9.92 0 12s.45 3.84 1.24 5.41l4.04-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.15c.95-2.84 3.6-4.99 6.72-4.99z"
                />
              </svg>
              Continue with Google
            </button>

            <div
              style={{
                textAlign: 'center',
                margin: '1rem 0',
                position: 'relative',
              }}
            >
              <span
                style={{
                  background: 'var(--card-bg)',
                  padding: '0 8px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                }}
              >
                or with email
              </span>
            </div>

            <form onSubmit={handleEmailAuth}>
              {!isLoginMode && (
                <div className="form-group">
                  <label htmlFor="authName">Name</label>
                  <input
                    type="text"
                    id="authName"
                    placeholder="Your Name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="authEmail">Email</label>
                <input
                  type="email"
                  id="authEmail"
                  placeholder="name@example.com"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="authPassword">Password</label>
                <input
                  type="password"
                  id="authPassword"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAuthModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={authSubmitting}
                >
                  {authSubmitting
                    ? 'Loading...'
                    : isLoginMode
                    ? 'Sign In'
                    : 'Sign Up'}
                </button>
              </div>
            </form>

            <div
              style={{
                marginTop: '1rem',
                textAlign: 'center',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              {isLoginMode ? (
                <>
                  Don&apos;t have an account?{' '}
                  <span
                    onClick={() => {
                      setIsLoginMode(false);
                      setAuthError(null);
                    }}
                    style={{
                      color: 'var(--primary-color)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Sign up
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span
                    onClick={() => {
                      setIsLoginMode(true);
                      setAuthError(null);
                    }}
                    style={{
                      color: 'var(--primary-color)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Sign in
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Delete Confirmation */}
      {isDeleteModalOpen && linkToDelete && (
        <div
          className="modal-overlay"
          id="deleteConfirmModal"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setIsDeleteModalOpen(false);
              setLinkToDelete(null);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 id="deleteModalTitle" style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Delete Bookmark
              </h3>
              <button
                className="close-btn"
                id="closeDeleteModalBtn"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setLinkToDelete(null);
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '0.5rem', marginBottom: '1rem' }}>
              <div className="danger-icon-badge" id="dangerIconBadge">
                <i className="fa-solid fa-trash-can"></i>
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Are you sure you want to delete this link?
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                This action cannot be undone and will permanently remove the bookmark.
              </p>
            </div>

            {/* Target Link Preview Box */}
            <div className="preview-card-box" id="deleteLinkPreview">
              <img
                src={`https://www.google.com/s2/favicons?domain=${getDomain(linkToDelete.url)}&sz=64`}
                className="favicon"
                alt="Icon"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=google.com&sz=64';
                }}
              />
              <div className="preview-card-details">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <h4>{linkToDelete.title}</h4>
                  <span className="badge" style={{ fontSize: '0.7rem' }}>{linkToDelete.category}</span>
                </div>
                <p>{getDomain(linkToDelete.url)}</p>
                {linkToDelete.description && (
                  <p style={{ marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {linkToDelete.description}
                  </p>
                )}
              </div>
            </div>

            {/* Alternative Option: Share Instead */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-color)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              <span>Need to share this link with others?</span>
              <button
                type="button"
                id="deleteModalShareInsteadBtn"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={() => {
                  const target = linkToDelete;
                  setIsDeleteModalOpen(false);
                  setLinkToDelete(null);
                  handleOpenShareModal(target);
                }}
              >
                <i className="fa-solid fa-share-nodes" style={{ color: 'var(--accent-green)' }}></i> Share Publicly
              </button>
            </div>

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                id="cancelDeleteBtn"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setLinkToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                id="confirmDeleteBtn"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className="fa-solid fa-trash-can"></i>
                {isDeleting ? 'Deleting...' : 'Delete Bookmark'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Share to Public */}
      {isShareModalOpen && sharingLink && (
        <div
          className="modal-overlay"
          id="shareModal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsShareModalOpen(false);
          }}
        >
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 id="shareModalTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-share-nodes" style={{ color: 'var(--primary-color)' }}></i> Share Bookmark
              </h3>
              <button
                className="close-btn"
                id="closeShareModalBtn"
                onClick={() => setIsShareModalOpen(false)}
              >
                &times;
              </button>
            </div>

            {/* Target Link Preview Card */}
            <div className="preview-card-box" id="shareLinkPreview">
              <img
                src={`https://www.google.com/s2/favicons?domain=${getDomain(sharingLink.url)}&sz=64`}
                className="favicon"
                alt="Icon"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=google.com&sz=64';
                }}
              />
              <div className="preview-card-details">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <h4>{sharingLink.title}</h4>
                  <span className="badge" style={{ fontSize: '0.7rem' }}>{sharingLink.category}</span>
                </div>
                <p>{getDomain(sharingLink.url)}</p>
                {sharingLink.description && (
                  <p style={{ marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {sharingLink.description}
                  </p>
                )}
              </div>
            </div>

            {/* Public Access Toggle Switch */}
            <div className="public-switch-bar" id="publicAccessToggleBar">
              <div className="switch-label">
                <span className="title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-globe" style={{ color: sharingLink.isPublic ? 'var(--accent-green)' : 'var(--text-secondary)' }}></i>
                  Public Access {sharingLink.isPublic ? '(Enabled)' : '(Private)'}
                </span>
                <span className="desc">
                  {sharingLink.isPublic
                    ? 'Anyone with the link can view and save this bookmark'
                    : 'Turn on to let anyone view and access this bookmark'}
                </span>
              </div>
              <label className="toggle-switch" htmlFor="shareModalPublicToggle">
                <input
                  type="checkbox"
                  id="shareModalPublicToggle"
                  checked={Boolean(sharingLink.isPublic)}
                  onChange={() => handleTogglePublic(sharingLink)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Shareable URL Input Field */}
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Public Share Link
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  id="publicShareUrlInput"
                  value={getPublicShareUrl(sharingLink)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  id="copyShareUrlBtn"
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '8px 14px', whiteSpace: 'nowrap' }}
                  onClick={() => handleCopyShareUrl(sharingLink)}
                >
                  <i className={shareCopied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>{' '}
                  {shareCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Quick 1-Click Social Sharing */}
            <div style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>
                Quick Share to Socials
              </label>
              <div className="share-buttons-grid">
                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Check out this link: ${sharingLink.title} - ${getPublicShareUrl(sharingLink)}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-share-btn"
                  id="shareWhatsAppBtn"
                  title="Share via WhatsApp"
                >
                  <i className="fa-brands fa-whatsapp" style={{ color: '#25D366' }}></i>
                  <span>WhatsApp</span>
                </a>

                {/* X / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `Found this useful bookmark: ${sharingLink.title}`
                  )}&url=${encodeURIComponent(getPublicShareUrl(sharingLink))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-share-btn"
                  id="shareTwitterBtn"
                  title="Share on X / Twitter"
                >
                  <i className="fa-brands fa-x-twitter"></i>
                  <span>X / Twitter</span>
                </a>

                {/* LinkedIn */}
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getPublicShareUrl(sharingLink))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-share-btn"
                  id="shareLinkedInBtn"
                  title="Share on LinkedIn"
                >
                  <i className="fa-brands fa-linkedin" style={{ color: '#0A66C2' }}></i>
                  <span>LinkedIn</span>
                </a>

                {/* Email */}
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Bookmark: ${sharingLink.title}`)}&body=${encodeURIComponent(
                    `Hi,\n\nCheck out this link on LinkManager:\n${sharingLink.title}\n${getPublicShareUrl(sharingLink)}\n\nOriginal URL:\n${sharingLink.url}${
                      sharingLink.description ? `\n\nNotes:\n${sharingLink.description}` : ''
                    }`
                  )}`}
                  className="social-share-btn"
                  id="shareEmailBtn"
                  title="Share via Email"
                >
                  <i className="fa-solid fa-envelope" style={{ color: '#ea4335' }}></i>
                  <span>Email</span>
                </a>
              </div>
            </div>

            {/* Extra Options: Native Device Share & Direct URL */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                id="nativeShareBtn"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.82rem', justifyContent: 'center' }}
                onClick={() => handleNativeShare(sharingLink)}
              >
                <i className="fa-solid fa-arrow-up-from-bracket"></i> Device Share
              </button>
              <button
                type="button"
                id="copyOriginalUrlBtn"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.82rem', justifyContent: 'center' }}
                onClick={() => copyToClipboard(sharingLink.url)}
              >
                <i className="fa-solid fa-link"></i> Direct URL
              </button>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                id="closeShareModalActionBtn"
                onClick={() => setIsShareModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Shared Bookmark Viewer (When opened from ?share=...) */}
      {sharedViewerLink && (
        <div
          className="modal-overlay"
          id="sharedViewerModal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSharedViewerLink(null);
          }}
        >
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 id="sharedViewerModalTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-globe" style={{ color: 'var(--accent-green)' }}></i> Shared Bookmark
              </h3>
              <button
                className="close-btn"
                id="closeSharedViewerModalBtn"
                onClick={() => setSharedViewerLink(null)}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '4px 0 12px 0' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--accent-green)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  marginBottom: '1rem',
                }}
              >
                <i className="fa-solid fa-check"></i> Publicly shared link
              </div>

              <div className="preview-card-box" style={{ marginTop: 0 }}>
                <img
                  src={`https://www.google.com/s2/favicons?domain=${getDomain(sharedViewerLink.url)}&sz=64`}
                  className="favicon"
                  alt="Icon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=google.com&sz=64';
                  }}
                />
                <div className="preview-card-details">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <h4>{sharedViewerLink.title}</h4>
                    <span className="badge" style={{ fontSize: '0.7rem' }}>{sharedViewerLink.category}</span>
                  </div>
                  <p>{getDomain(sharedViewerLink.url)}</p>
                  {sharedViewerLink.description && (
                    <p style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {sharedViewerLink.description}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <a
                  href={sharedViewerLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  id="openSharedLinkBtn"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i> Visit Website
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  id="saveSharedToMyLinksBtn"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleSaveSharedToMyLinks(sharedViewerLink)}
                >
                  <i className="fa-solid fa-bookmark"></i> Save to My Links
                </button>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                id="closeSharedViewerActionBtn"
                onClick={() => setSharedViewerLink(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
