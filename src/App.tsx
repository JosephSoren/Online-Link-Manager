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
  getDocs,
  where,
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
import { QrCodeModal } from './components/QrCodeModal';
import { LandingPage } from './components/LandingPage';

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: 'Work' | 'Social' | 'Tools' | 'Reading' | 'Personal' | string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
  userId?: string;
  isPublic?: boolean;
  isFavorite?: boolean;
  order?: number;
}

export interface PublicUserProfile {
  username: string;
  displayName: string;
  photoURL?: string;
  email?: string;
  uid?: string;
}

const INITIAL_LINKS: LinkItem[] = [
  {
    id: '1',
    title: 'Google Search Engine',
    url: 'https://google.com',
    category: 'Tools',
    description: 'Quick web access for inquiries and searching.',
    createdAt: new Date(Date.now() - 60000).toISOString(),
    isPublic: true,
    isFavorite: true,
    order: 0,
  },
  {
    id: '2',
    title: 'GitHub Repository',
    url: 'https://github.com',
    category: 'Work',
    description: 'Source code management and version control.',
    createdAt: new Date().toISOString(),
    isPublic: true,
    isFavorite: false,
    order: 1,
  }
];

// Default categories
const DEFAULT_CATEGORIES = ['Work', 'Social', 'Tools', 'Reading', 'Personal'];

// Slugify category for URLs (e.g. "Exam Links" -> "exam-links", "Favorites" -> "favourites")
const slugifyCategory = (category: string): string => {
  const c = (category || '').toLowerCase().trim();
  if (c === 'favourites' || c === 'favorites' || c === 'fav' || c === 'favorite') return 'favourites';
  if (c === 'all') return 'all';
  return c.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

// Resolve category from slug against available categories
const resolveCategoryFromSlug = (slug: string, availableCategories: string[]): string => {
  const clean = (slug || '').toLowerCase().trim();
  if (clean === 'favourites' || clean === 'favorites' || clean === 'fav' || clean === 'favorite') {
    return 'Favourites';
  }
  if (clean === 'all') return 'All';

  // Direct match by slug
  const matched = availableCategories.find(
    (c) => slugifyCategory(c) === clean || c.toLowerCase() === clean.replace(/-/g, ' ') || c.toLowerCase() === clean
  );
  if (matched) return matched;

  // Title-case fallback, e.g. "exam-links" -> "Exam Links"
  return clean
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
};

interface ProfileRoute {
  username: string;
  categorySlug?: string;
}

// Helper to extract username & optional category slug from URL
// Supports: /rohitkumar, /rohitkumar/favourites, /rohitkumar/exam-links, or ?u=rohitkumar&cat=exam-links
const getProfileRouteFromUrl = (): ProfileRoute | null => {
  const params = new URLSearchParams(window.location.search);
  const uParam = params.get('u');
  const catParam = params.get('cat') || params.get('category');
  if (uParam) {
    return {
      username: uParam.toLowerCase().trim(),
      categorySlug: catParam ? catParam.toLowerCase().trim() : undefined,
    };
  }

  const pathParts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const first = pathParts[0]?.toLowerCase().trim();
  const reserved = ['', 'index.html', 'api', 'assets', 'dashboard', 'settings', 'landing'];
  if (first && !reserved.includes(first)) {
    const second = pathParts[1]?.toLowerCase().trim();
    return {
      username: first,
      categorySlug: second && !reserved.includes(second) ? second : undefined,
    };
  }
  return null;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Custom Categories state (synced with localStorage & Firestore)
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lm_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAddCategorySidebar, setShowAddCategorySidebar] = useState(false);
  const [sidebarCategoryInput, setSidebarCategoryInput] = useState('');
  const [isAddingCustomCategoryInModal, setIsAddingCustomCategoryInModal] = useState(false);
  const [modalNewCategoryText, setModalNewCategoryText] = useState('');

  // View Navigation: 'landing' | 'dashboard' | 'settings' | 'public_profile'
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'settings' | 'public_profile'>(() => {
    const params = new URLSearchParams(window.location.search);
    const vParam = params.get('view');
    if (vParam === 'landing') return 'landing';
    if (vParam === 'dashboard') return 'dashboard';
    if (vParam === 'settings') return 'settings';

    const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (path === 'landing') return 'landing';
    if (path === 'dashboard') return 'dashboard';
    if (path === 'settings') return 'settings';

    const profileRoute = getProfileRouteFromUrl();
    if (profileRoute) return 'public_profile';

    // Check saved preference; default to 'landing' for SEO & new users
    const pref = localStorage.getItem('lm_preferred_view');
    if (pref === 'dashboard') return 'dashboard';
    return 'landing';
  });
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  // Drag and drop reordering state
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null);
  const [draggableCardId, setDraggableCardId] = useState<string | null>(null);

  // User Profile & Custom Subfolder Handle (e.g. josephsoren)
  const [userUsername, setUserUsername] = useState<string>('josephsoren');
  const [editUsernameInput, setEditUsernameInput] = useState<string>('josephsoren');
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Public Profile Viewing State (for https://linkmanager.in/{username} & /{username}/{category})
  const [publicProfileUsername, setPublicProfileUsername] = useState<string>('josephsoren');
  const [publicProfileUser, setPublicProfileUser] = useState<PublicUserProfile | null>(null);
  const [publicLinks, setPublicLinks] = useState<LinkItem[]>([]);
  const [publicProfileLoading, setPublicProfileLoading] = useState(false);
  const [publicCategory, setPublicCategory] = useState<string>('All');
  const [publicSearch, setPublicSearch] = useState<string>('');

  // Settings view filters
  const [settingsSearch, setSettingsSearch] = useState<string>('');
  const [settingsVisibilityFilter, setSettingsVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [settingsCategoryFilter, setSettingsCategoryFilter] = useState<string>('All');

  // Modals state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCategory, setFormCategory] = useState('Work');
  const [formDescription, setFormDescription] = useState('');
  const [formThumbnail, setFormThumbnail] = useState('');
  const [thumbnailStyle, setThumbnailStyle] = useState('modern');
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [formIsPublic, setFormIsPublic] = useState(false);
  const [formIsFavorite, setFormIsFavorite] = useState(false);

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

  // QR Code Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrModalData, setQrModalData] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    categoryBadge?: string;
  }>({
    url: '',
    title: '',
    subtitle: '',
    categoryBadge: '',
  });

  const handleOpenQrModal = (
    url: string,
    title: string,
    subtitle?: string,
    categoryBadge?: string
  ) => {
    setQrModalData({ url, title, subtitle, categoryBadge });
    setIsQrModalOpen(true);
  };

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
              thumbnail: data.thumbnail || undefined,
              createdAt: data.createdAt || new Date().toISOString(),
              userId: currentUser.uid,
              isPublic: Boolean(data.isPublic),
              isFavorite: Boolean(data.isFavorite),
              order: typeof data.order === 'number' ? data.order : undefined,
            });
          });

          // If new user with no links, seed with initial demo links
          if (items.length === 0 && !snapshot.metadata.hasPendingWrites) {
            const localData = localStorage.getItem('linkmanager_data');
            const toSeed: LinkItem[] = localData ? JSON.parse(localData) : INITIAL_LINKS;

            const batch = writeBatch(db);
            toSeed.forEach((item, idx) => {
              const newRef = doc(collection(db, 'users', currentUser.uid, 'links'));
              batch.set(newRef, {
                title: item.title,
                url: item.url,
                category: item.category,
                description: item.description || '',
                thumbnail: item.thumbnail || '',
                createdAt: item.createdAt || new Date().toISOString(),
                isPublic: Boolean(item.isPublic),
                isFavorite: Boolean(item.isFavorite),
                order: typeof item.order === 'number' ? item.order : idx,
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
                thumbnail: d.thumbnail || undefined,
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

  // Sync user profile, handle, and custom categories on auth change
  useEffect(() => {
    if (!currentUser) {
      const storedHandle = localStorage.getItem('lm_username') || 'josephsoren';
      setUserUsername(storedHandle);
      setEditUsernameInput(storedHandle);
      return;
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    getDoc(userDocRef)
      .then((snap) => {
        let chosenUsername = '';
        if (snap.exists()) {
          const uData = snap.data();
          if (uData.username) {
            chosenUsername = uData.username;
          }
          if (uData.customCategories && Array.isArray(uData.customCategories)) {
            setCustomCategories(uData.customCategories);
            localStorage.setItem('lm_custom_categories', JSON.stringify(uData.customCategories));
          }
        }

        if (!chosenUsername) {
          // Derive from email or displayName
          const emailPrefix = currentUser.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || '';
          const nameClean = (currentUser.displayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          chosenUsername = nameClean || (emailPrefix.startsWith('josephsoren') ? 'josephsoren' : emailPrefix) || 'user';

          // Save username mappings
          setDoc(
            userDocRef,
            {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || chosenUsername,
              photoURL: currentUser.photoURL || '',
              username: chosenUsername,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(console.error);

          setDoc(
            doc(db, 'usernames', chosenUsername),
            {
              uid: currentUser.uid,
              username: chosenUsername,
              displayName: currentUser.displayName || chosenUsername,
              photoURL: currentUser.photoURL || '',
            },
            { merge: true }
          ).catch(console.error);
        }

        setUserUsername(chosenUsername);
        setEditUsernameInput(chosenUsername);
        localStorage.setItem('lm_username', chosenUsername);
      })
      .catch((err) => {
        console.error('Error fetching user profile:', err);
        setUserUsername('josephsoren');
        setEditUsernameInput('josephsoren');
      });
  }, [currentUser]);

  // Merged dynamic category list (default + custom added categories + any categories in links)
  const allCategories = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...customCategories]);
    links.forEach((l) => {
      if (l.category && l.category !== 'All' && l.category !== 'Favorites' && l.category !== 'Favourites') {
        set.add(l.category);
      }
    });
    return Array.from(set);
  }, [customCategories, links]);

  // Admin add new category
  const handleAddCategory = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    if (
      allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase()) ||
      trimmed.toLowerCase() === 'all' ||
      trimmed.toLowerCase() === 'favorites' ||
      trimmed.toLowerCase() === 'favourites'
    ) {
      setCopyNotification(`Category "${trimmed}" is already available`);
      setTimeout(() => setCopyNotification(null), 2000);
      return trimmed;
    }
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    localStorage.setItem('lm_custom_categories', JSON.stringify(updated));
    if (currentUser) {
      setDoc(doc(db, 'users', currentUser.uid), { customCategories: updated }, { merge: true }).catch(console.error);
    }
    setCopyNotification(`Category "${trimmed}" added!`);
    setTimeout(() => setCopyNotification(null), 2200);
    return trimmed;
  };

  const getCategoryShareUrl = (categoryName: string, usernameOverride?: string) => {
    const targetUser = usernameOverride || userUsername || 'josephsoren';
    if (categoryName !== 'All') {
      const slug = slugifyCategory(categoryName);
      return `${window.location.origin}/${targetUser}/${slug}`;
    }
    return `${window.location.origin}/${targetUser}`;
  };

  const getProfileShareUrl = (usernameOverride?: string) => {
    const targetUser = usernameOverride || userUsername || 'josephsoren';
    return `${window.location.origin}/${targetUser}`;
  };

  // Copy direct category share link (e.g. https://linkmanager.in/rohitkumar/exam-links)
  const handleCopyCategoryShareUrl = (categoryName: string, usernameOverride?: string) => {
    const shareUrl = getCategoryShareUrl(categoryName, usernameOverride);
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopyNotification(`Copied category link: ${shareUrl}`);
      setTimeout(() => setCopyNotification(null), 2500);
    });
  };

  // Load public profile with optional initial category slug
  const loadPublicProfile = async (targetSlug: string, initialCategorySlug?: string) => {
    setPublicProfileLoading(true);
    setPublicProfileUsername(targetSlug);
    try {
      const usernameSnap = await getDoc(doc(db, 'usernames', targetSlug));
      let targetUid = '';
      let profileData: PublicUserProfile = {
        username: targetSlug,
        displayName: targetSlug,
        photoURL: '',
      };

      if (usernameSnap.exists()) {
        const uData = usernameSnap.data();
        targetUid = uData.uid || '';
        profileData = {
          username: uData.username || targetSlug,
          displayName: uData.displayName || targetSlug,
          photoURL: uData.photoURL || '',
          email: uData.email || '',
          uid: targetUid,
        };
      } else if (currentUser && (userUsername === targetSlug || currentUser.uid === targetSlug)) {
        targetUid = currentUser.uid;
        profileData = {
          username: userUsername,
          displayName: currentUser.displayName || userUsername,
          photoURL: currentUser.photoURL || '',
          email: currentUser.email || '',
          uid: currentUser.uid,
        };
      }

      setPublicProfileUser(profileData);

      let fetchedItems: LinkItem[] = [];
      if (targetUid) {
        const publicLinksQuery = query(
          collection(db, 'users', targetUid, 'links'),
          where('isPublic', '==', true)
        );
        const linksSnap = await getDocs(publicLinksQuery);
        const pubItems: LinkItem[] = [];
        linksSnap.forEach((docSnap) => {
          const d = docSnap.data();
          pubItems.push({
            id: docSnap.id,
            title: d.title || '',
            url: d.url || '',
            category: d.category || 'Work',
            description: d.description || '',
            thumbnail: d.thumbnail || undefined,
            createdAt: d.createdAt || new Date().toISOString(),
            userId: targetUid,
            isPublic: true,
            isFavorite: Boolean(d.isFavorite),
          });
        });
        pubItems.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        fetchedItems = pubItems;
        setPublicLinks(pubItems);
      } else {
        // Fallback for local demo links
        if (targetSlug === userUsername || targetSlug === 'josephsoren') {
          fetchedItems = links.filter((l) => l.isPublic);
          setPublicLinks(fetchedItems);
        } else {
          setPublicLinks([]);
        }
      }

      // Resolve category filter from initial category slug
      if (initialCategorySlug) {
        const pool = [
          ...DEFAULT_CATEGORIES,
          ...customCategories,
          ...fetchedItems.map((item) => item.category),
        ];
        const resolved = resolveCategoryFromSlug(initialCategorySlug, pool);
        setPublicCategory(resolved);
      } else {
        setPublicCategory('All');
      }
    } catch (err) {
      console.error('Error loading public profile:', err);
      if (targetSlug === userUsername || targetSlug === 'josephsoren') {
        const fallback = links.filter((l) => l.isPublic);
        setPublicLinks(fallback);
        if (initialCategorySlug) {
          const resolved = resolveCategoryFromSlug(initialCategorySlug, [
            ...DEFAULT_CATEGORIES,
            ...customCategories,
            ...fallback.map((item) => item.category),
          ]);
          setPublicCategory(resolved);
        } else {
          setPublicCategory('All');
        }
      }
    } finally {
      setPublicProfileLoading(false);
    }
  };

  // URL route listener on mount
  useEffect(() => {
    const route = getProfileRouteFromUrl();
    if (route) {
      loadPublicProfile(route.username, route.categorySlug);
      setCurrentView('public_profile');
    }
  }, []);

  // Popstate listener for browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const route = getProfileRouteFromUrl();
      if (route) {
        loadPublicProfile(route.username, route.categorySlug);
        setCurrentView('public_profile');
      } else {
        const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
        if (path === 'settings') {
          setCurrentView('settings');
        } else if (path === 'dashboard') {
          setCurrentView('dashboard');
        } else if (path === 'landing') {
          setCurrentView('landing');
        } else {
          const pref = localStorage.getItem('lm_preferred_view');
          setCurrentView(pref === 'dashboard' ? 'dashboard' : 'landing');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [userUsername, links, customCategories]);

  // Handle public category selection with URL synchronization
  const handleSelectPublicCategory = (cat: string) => {
    setPublicCategory(cat);
    const targetUser = publicProfileUsername || userUsername || 'josephsoren';
    if (cat === 'All') {
      window.history.pushState(null, '', `/${targetUser}`);
    } else {
      const slug = slugifyCategory(cat);
      window.history.pushState(null, '', `/${targetUser}/${slug}`);
    }
  };

  const handleBackToAllCategories = () => {
    handleSelectPublicCategory('All');
  };

  // Click outside to close header dropdown menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#headerThreeDotsBtn') && !target.closest('#headerDropdownMenu')) {
        setIsHeaderMenuOpen(false);
      }
    };
    if (isHeaderMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isHeaderMenuOpen]);

  const handleNavigateToPublicProfile = (slug?: string, category?: string) => {
    const target = slug || userUsername || 'josephsoren';
    if (category && category !== 'All') {
      const catSlug = slugifyCategory(category);
      window.history.pushState(null, '', `/${target}/${catSlug}`);
      loadPublicProfile(target, catSlug);
    } else {
      window.history.pushState(null, '', `/${target}`);
      loadPublicProfile(target);
    }
    setCurrentView('public_profile');
  };

  const handleBackToDashboard = () => {
    localStorage.setItem('lm_preferred_view', 'dashboard');
    window.history.pushState(null, '', '/dashboard');
    setCurrentView('dashboard');
  };

  const handleGoToLanding = () => {
    localStorage.setItem('lm_preferred_view', 'landing');
    window.history.pushState(null, '', '/');
    setCurrentView('landing');
  };

  const handleCopyProfileUrl = (slug?: string) => {
    const target = slug || userUsername || 'josephsoren';
    const profileUrl = `${window.location.origin}/${target}`;
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopyNotification(`Public page link copied: ${profileUrl}`);
      setTimeout(() => setCopyNotification(null), 2500);
    });
  };

  const handleSaveUsername = async () => {
    const clean = editUsernameInput.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (!clean) return;
    setIsSavingUsername(true);
    try {
      if (currentUser) {
        const existingDoc = await getDoc(doc(db, 'usernames', clean));
        if (existingDoc.exists() && existingDoc.data().uid !== currentUser.uid) {
          setCopyNotification('This username is already taken. Please choose another.');
          setTimeout(() => setCopyNotification(null), 3000);
          setIsSavingUsername(false);
          return;
        }

        await setDoc(doc(db, 'usernames', clean), {
          uid: currentUser.uid,
          username: clean,
          displayName: currentUser.displayName || clean,
          photoURL: currentUser.photoURL || '',
          email: currentUser.email || '',
        });

        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            username: clean,
          },
          { merge: true }
        );
      }
      setUserUsername(clean);
      localStorage.setItem('lm_username', clean);
      setCopyNotification(`Username updated to @${clean}!`);
      setTimeout(() => setCopyNotification(null), 2500);
    } catch (err) {
      console.error('Error updating username:', err);
      setCopyNotification('Failed to update username');
      setTimeout(() => setCopyNotification(null), 2500);
    } finally {
      setIsSavingUsername(false);
    }
  };

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
    setFormThumbnail('');
    setThumbnailError(null);
    setShowCustomUrlInput(false);
    setFormIsPublic(false);
    setFormIsFavorite(false);
    setIsAddingCustomCategoryInModal(false);
    setModalNewCategoryText('');
    setIsLinkModalOpen(true);
  };

  const handleOpenEditModal = (link: LinkItem) => {
    setEditingLink(link);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormCategory(link.category);
    setFormDescription(link.description || '');
    setFormThumbnail(link.thumbnail || '');
    setThumbnailError(null);
    setShowCustomUrlInput(false);
    setFormIsPublic(Boolean(link.isPublic));
    setFormIsFavorite(Boolean(link.isFavorite));
    setIsAddingCustomCategoryInModal(false);
    setModalNewCategoryText('');
    setIsLinkModalOpen(true);
  };

  // Generate preview thumbnail using Gemini AI
  const handleGenerateThumbnail = async () => {
    if (!formTitle.trim() && !formUrl.trim()) {
      setThumbnailError('Please provide a title or URL before generating a thumbnail.');
      return;
    }

    setIsGeneratingThumbnail(true);
    setThumbnailError(null);

    try {
      const res = await fetch('/api/generate-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim(),
          url: formUrl.trim(),
          category: formCategory,
          style: thumbnailStyle,
        }),
      });

      const data = await res.json();
      if (res.ok && data.thumbnail) {
        setFormThumbnail(data.thumbnail);
        setThumbnailError(null);
      } else {
        setThumbnailError(data.error || 'Failed to generate thumbnail. Please try again.');
      }
    } catch (err: any) {
      console.error('Error generating thumbnail:', err);
      setThumbnailError(err?.message || 'Network error while generating thumbnail.');
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  // Toggle favorite / pin to top
  const handleToggleFavorite = async (link: LinkItem) => {
    const newFav = !link.isFavorite;
    const updated = links.map((l) => (l.id === link.id ? { ...l, isFavorite: newFav } : l));
    setLinks(updated);

    if (currentUser) {
      try {
        const linkRef = doc(db, 'users', currentUser.uid, 'links', link.id);
        await updateDoc(linkRef, {
          isFavorite: newFav,
        });
      } catch (err) {
        console.error('Error toggling favorite:', err);
      }
    } else {
      saveLocalLinks(updated);
    }
    setCopyNotification(newFav ? 'Pinned to top as favorite!' : 'Removed from favorites');
    setTimeout(() => setCopyNotification(null), 2000);
  };

  // Drag-and-drop handlers for links reordering
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLinkId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverLinkId !== targetId) {
      setDragOverLinkId(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetId: string) => {
    if (dragOverLinkId === targetId) {
      setDragOverLinkId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverLinkId(null);
    const sourceId = draggedLinkId || e.dataTransfer.getData('text/plain');
    setDraggedLinkId(null);

    if (!sourceId || sourceId === targetId) return;

    const sourceItem = links.find((l) => l.id === sourceId);
    const targetItem = links.find((l) => l.id === targetId);
    if (!sourceItem || !targetItem) return;

    // We reorder within filteredLinks
    const currentList = [...filteredLinks];
    const sourceIdx = currentList.findIndex((l) => l.id === sourceId);
    const targetIdx = currentList.findIndex((l) => l.id === targetId);

    if (sourceIdx === -1 || targetIdx === -1) return;

    // Moving between favorite status if dragged into a different zone
    const targetIsFavorite = Boolean(targetItem.isFavorite);
    const [moved] = currentList.splice(sourceIdx, 1);
    const updatedMoved = { ...moved, isFavorite: targetIsFavorite };
    currentList.splice(targetIdx, 0, updatedMoved);

    // Reassign order numbers to the new sequence
    const updatedIdsMap = new Map<string, { order: number; isFavorite: boolean }>();
    currentList.forEach((item, idx) => {
      updatedIdsMap.set(item.id, {
        order: idx,
        isFavorite: item.id === sourceId ? targetIsFavorite : Boolean(item.isFavorite),
      });
    });

    // Update overall links array
    const updatedAllLinks = links.map((link) => {
      const updated = updatedIdsMap.get(link.id);
      if (updated) {
        return {
          ...link,
          order: updated.order,
          isFavorite: updated.isFavorite,
        };
      }
      return link;
    });

    // Optimistically update React state
    setLinks(updatedAllLinks);

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        updatedIdsMap.forEach((val, linkId) => {
          const ref = doc(db, 'users', currentUser.uid, 'links', linkId);
          batch.update(ref, {
            order: val.order,
            isFavorite: val.isFavorite,
          });
        });
        await batch.commit();
        setCopyNotification('Links reordered successfully');
        setTimeout(() => setCopyNotification(null), 2000);
      } catch (err) {
        console.error('Error saving reordered links:', err);
      }
    } else {
      saveLocalLinks(updatedAllLinks);
      setCopyNotification('Links reordered successfully');
      setTimeout(() => setCopyNotification(null), 2000);
    }
  };

  const handleDragEnd = () => {
    setDraggedLinkId(null);
    setDragOverLinkId(null);
    setDraggableCardId(null);
  };

  // Submit link
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();

    let url = formUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    let finalCategory = formCategory;
    if (isAddingCustomCategoryInModal && modalNewCategoryText.trim()) {
      finalCategory = modalNewCategoryText.trim();
      handleAddCategory(finalCategory);
    }

    if (editingLink) {
      // Update
      if (currentUser) {
        const linkRef = doc(db, 'users', currentUser.uid, 'links', editingLink.id);
        await updateDoc(linkRef, {
          title: formTitle.trim(),
          url: url,
          category: finalCategory,
          description: formDescription.trim(),
          thumbnail: formThumbnail.trim() || '',
          isPublic: formIsPublic,
          isFavorite: formIsFavorite,
        });
      } else {
        const updated = links.map((l) =>
          l.id === editingLink.id
            ? {
                ...l,
                title: formTitle.trim(),
                url: url,
                category: finalCategory,
                description: formDescription.trim(),
                thumbnail: formThumbnail.trim() || undefined,
                isPublic: formIsPublic,
                isFavorite: formIsFavorite,
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
          category: finalCategory,
          description: formDescription.trim(),
          thumbnail: formThumbnail.trim() || '',
          isPublic: formIsPublic,
          isFavorite: formIsFavorite,
          order: 0,
          createdAt: new Date().toISOString(),
        });
      } else {
        const newLink: LinkItem = {
          id: Date.now().toString(),
          title: formTitle.trim(),
          url: url,
          category: finalCategory,
          description: formDescription.trim(),
          thumbnail: formThumbnail.trim() || undefined,
          isPublic: formIsPublic,
          isFavorite: formIsFavorite,
          order: 0,
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
          thumbnail: sharedItem.thumbnail || '',
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
        thumbnail: sharedItem.thumbnail || undefined,
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
      handleBackToDashboard();
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
      handleBackToDashboard();
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

  // Filtered links (Favorites pinned to top of grid, then by drag-and-drop order)
  const filteredLinks = useMemo(() => {
    const list = links.filter((link) => {
      const matchesCategory =
        currentCategory === 'All'
          ? true
          : currentCategory === 'Favorites'
          ? Boolean(link.isFavorite)
          : link.category === currentCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        link.title.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        (link.description && link.description.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });

    // Pinned Favorites ALWAYS sort to the top of the grid!
    return list.sort((a, b) => {
      const aFav = Boolean(a.isFavorite);
      const bFav = Boolean(b.isFavorite);
      if (aFav !== bFav) {
        return aFav ? -1 : 1; // Pinned favorites first
      }
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order;
      }
      if (typeof a.order === 'number') return -1;
      if (typeof b.order === 'number') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [links, currentCategory, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: links.length,
      Favorites: 0,
    };
    allCategories.forEach((c) => {
      map[c] = 0;
    });
    links.forEach((l) => {
      if (l.isFavorite) {
        map.Favorites = (map.Favorites || 0) + 1;
      }
      if (l.category) {
        map[l.category] = (map[l.category] || 0) + 1;
      }
    });
    return map;
  }, [links, allCategories]);

  // Settings view filtered links
  const settingsFilteredLinks = useMemo(() => {
    return links.filter((link) => {
      if (settingsVisibilityFilter === 'public' && !link.isPublic) return false;
      if (settingsVisibilityFilter === 'private' && link.isPublic) return false;
      if (settingsCategoryFilter !== 'All' && link.category !== settingsCategoryFilter) return false;
      if (settingsSearch) {
        const q = settingsSearch.toLowerCase().trim();
        const matchesTitle = link.title.toLowerCase().includes(q);
        const matchesUrl = link.url.toLowerCase().includes(q);
        const matchesDesc = (link.description || '').toLowerCase().includes(q);
        return matchesTitle || matchesUrl || matchesDesc;
      }
      return true;
    });
  }, [links, settingsVisibilityFilter, settingsCategoryFilter, settingsSearch]);

  // Public profile filtered links
  const publicFilteredLinks = useMemo(() => {
    return publicLinks.filter((link) => {
      if (publicCategory !== 'All') {
        if (publicCategory === 'Favourites' || publicCategory === 'Favorites') {
          if (!link.isFavorite) return false;
        } else {
          const catMatches =
            link.category.toLowerCase() === publicCategory.toLowerCase() ||
            slugifyCategory(link.category) === slugifyCategory(publicCategory) ||
            link.category.toLowerCase().replace(/[-_]/g, ' ') === publicCategory.toLowerCase().replace(/[-_]/g, ' ');
          if (!catMatches) return false;
        }
      }
      if (publicSearch) {
        const q = publicSearch.toLowerCase().trim();
        const matchesTitle = link.title.toLowerCase().includes(q);
        const matchesUrl = link.url.toLowerCase().includes(q);
        const matchesDesc = (link.description || '').toLowerCase().includes(q);
        return matchesTitle || matchesUrl || matchesDesc;
      }
      return true;
    });
  }, [publicLinks, publicCategory, publicSearch]);

  // Derived available public categories & favorites presence
  const availablePublicCategories = useMemo(() => {
    const set = new Set<string>();
    publicLinks.forEach((l) => {
      if (l.category && l.category !== 'All' && l.category !== 'Favorites' && l.category !== 'Favourites') {
        set.add(l.category);
      }
    });
    const list = Array.from(set);
    return list.length > 0 ? list : DEFAULT_CATEGORIES;
  }, [publicLinks]);

  const hasPublicFavorites = useMemo(() => {
    return publicLinks.some((l) => l.isFavorite);
  }, [publicLinks]);

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

      {/* Navigation / Header (visible on Dashboard and Settings) */}
      {(currentView === 'dashboard' || currentView === 'settings') && (
        <header className="navbar" id="navbar">
          <div
            className="logo"
            id="appLogo"
            onClick={handleGoToLanding}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="LinkManager.in - Go to Home Page"
          >
            <i className="fa-solid fa-link logo-icon"></i>
            <span>
              LinkManager<span className="domain">.in</span>
            </span>
            {currentView === 'settings' && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginLeft: '4px' }}>
                / Settings
              </span>
            )}
          </div>

          <div className="nav-controls">
            {/* Desktop Controls: Search, Theme, Settings, Public Profile, User Badge */}
            <div className="nav-desktop-controls">
              {currentView === 'dashboard' && (
                <div className="search-box nav-search-desktop">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    type="text"
                    id="searchInput"
                    placeholder="Search links or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
              )}

              {/* Product Home Button */}
              <button
                id="navLandingBtn"
                className="btn btn-secondary"
                title="Go to Home Page & Overview"
                onClick={handleGoToLanding}
                style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-house" style={{ color: 'var(--primary-color)' }}></i>
                <span>Home</span>
              </button>

              <button
                id="themeToggleBtn"
                className="icon-btn"
                title="Toggle Dark/Light Mode"
                onClick={toggleTheme}
              >
                <i className={isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
              </button>

              {/* Quick Link Settings Button */}
              <button
                id="navLinkSettingsBtn"
                className="icon-btn"
                title="Link Settings"
                onClick={() => setCurrentView(currentView === 'settings' ? 'dashboard' : 'settings')}
                style={{ color: currentView === 'settings' ? 'var(--primary-color)' : undefined }}
              >
                <i className="fa-solid fa-sliders"></i>
              </button>

              {/* Quick Public Page View Button */}
              <button
                id="navViewPublicBtn"
                className="icon-btn"
                title={`View your public page (/${userUsername})`}
                onClick={() => handleNavigateToPublicProfile()}
              >
                <i className="fa-solid fa-globe"></i>
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
            </div>

            {/* Top Right Add Link Button - Always in Navbar */}
            <button id="addLinkBtn" className="btn btn-primary" onClick={handleOpenAddModal}>
              <i className="fa-solid fa-plus"></i> Add Link
            </button>
          </div>
        </header>
      )}

      {/* Mobile Sub-Header: Placed immediately after header in mobile screen sizes */}
      {(currentView === 'dashboard' || currentView === 'settings') && (
        <div className="mobile-header-subbar" id="mobileHeaderSubbar">
          <div className="mobile-subbar-controls">
            <button
              id="mobileNavLandingBtn"
              className="btn btn-secondary"
              title="Go to Home Page & Overview"
              onClick={handleGoToLanding}
              style={{ fontSize: '0.78rem', padding: '4px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <i className="fa-solid fa-house" style={{ color: 'var(--primary-color)' }}></i>
              <span>Home</span>
            </button>

            <button
              id="mobileThemeToggleBtn"
              className="icon-btn"
              title="Toggle Dark/Light Mode"
              onClick={toggleTheme}
            >
              <i className={isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
            </button>

            <button
              id="mobileNavLinkSettingsBtn"
              className="icon-btn"
              title="Link Settings"
              onClick={() => setCurrentView(currentView === 'settings' ? 'dashboard' : 'settings')}
              style={{ color: currentView === 'settings' ? 'var(--primary-color)' : undefined }}
            >
              <i className="fa-solid fa-sliders"></i>
            </button>

            <button
              id="mobileNavViewPublicBtn"
              className="icon-btn"
              title={`View your public page (/${userUsername})`}
              onClick={() => handleNavigateToPublicProfile()}
            >
              <i className="fa-solid fa-globe"></i>
            </button>

            {currentUser ? (
              <div className="user-profile-badge" id="mobileUserProfileBadge">
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
                <button
                  id="mobileSignOutBtn"
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
                id="mobileAuthOpenBtn"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
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
          </div>
        </div>
      )}

      {/* VIEW 0: SEO-Optimized Landing Page for New Visitors & Search Crawlers */}
      {currentView === 'landing' && (
        <LandingPage
          onLaunchDashboard={handleBackToDashboard}
          onOpenAuth={() => {
            setIsLoginMode(false);
            setIsAuthModalOpen(true);
          }}
          currentUser={currentUser}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          userUsername={userUsername}
          onViewPublicProfile={handleNavigateToPublicProfile}
        />
      )}

      {/* VIEW 1: Dashboard Main Container */}
      {currentView === 'dashboard' && (
        <div className="app-container" id="appContainer">
          {/* Sidebar: Categories */}
          <aside className="sidebar" id="sidebar">
            {/* Quick Home navigation button */}
            <div style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <button
                id="sidebarGoHomeBtn"
                onClick={handleGoToLanding}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'flex-start',
                  fontSize: '0.82rem',
                  padding: '7px 12px',
                  borderRadius: '6px',
                }}
                title="Go to LinkManager.in Home & Features Overview"
              >
                <i className="fa-solid fa-house" style={{ color: 'var(--primary-color)' }}></i>
                <span>Home Page / Overview</span>
              </button>
            </div>

            <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3>Categories</h3>
              <button
                id="toggleAddCategoryBtn"
                className="btn-icon-subtle"
                title="Add New Category"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setShowAddCategorySidebar(!showAddCategorySidebar)}
              >
                <i className={`fa-solid ${showAddCategorySidebar ? 'fa-minus' : 'fa-plus'}`}></i>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>New</span>
              </button>
            </div>

            {showAddCategorySidebar && (
              <div className="sidebar-category-add-container">
                <form
                  className="sidebar-category-add-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (sidebarCategoryInput.trim()) {
                      const newCat = sidebarCategoryInput.trim();
                      handleAddCategory(newCat);
                      setCurrentCategory(newCat);
                      setSidebarCategoryInput('');
                      setShowAddCategorySidebar(false);
                    }
                  }}
                >
                  <input
                    type="text"
                    id="sidebarCategoryInput"
                    className="sidebar-category-input"
                    placeholder="e.g. Exam Links"
                    value={sidebarCategoryInput}
                    onChange={(e) => setSidebarCategoryInput(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    id="sidebarSubmitCategoryBtn"
                    className="btn btn-primary sidebar-category-add-btn"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    id="sidebarCancelCategoryBtn"
                    className="sidebar-category-cancel-btn"
                    onClick={() => {
                      setShowAddCategorySidebar(false);
                      setSidebarCategoryInput('');
                    }}
                    title="Cancel"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </form>
              </div>
            )}

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
                className={currentCategory === 'Favorites' ? 'active' : ''}
                data-category="Favorites"
                id="catFavorites"
                onClick={() => setCurrentCategory('Favorites')}
              >
                <i className="fa-solid fa-star" style={{ color: '#f59e0b' }}></i> Favorites{' '}
                <span className="count-badge" id="countFavorites">
                  {counts.Favorites}
                </span>
              </li>

              {allCategories.map((cat) => {
                let iconClass = 'fa-solid fa-folder';
                if (cat === 'Work') iconClass = 'fa-solid fa-briefcase';
                else if (cat === 'Social') iconClass = 'fa-solid fa-hashtag';
                else if (cat === 'Tools') iconClass = 'fa-solid fa-wrench';
                else if (cat === 'Reading') iconClass = 'fa-solid fa-book-bookmark';
                else if (cat === 'Personal') iconClass = 'fa-solid fa-user';
                else if (cat.toLowerCase().includes('exam') || cat.toLowerCase().includes('study')) iconClass = 'fa-solid fa-graduation-cap';
                else if (cat.toLowerCase().includes('code') || cat.toLowerCase().includes('dev')) iconClass = 'fa-solid fa-code';
                else if (cat.toLowerCase().includes('video') || cat.toLowerCase().includes('media')) iconClass = 'fa-solid fa-play';

                return (
                  <li
                    key={cat}
                    className={currentCategory === cat ? 'active' : ''}
                    data-category={cat}
                    id={`cat-${slugifyCategory(cat)}`}
                    onClick={() => setCurrentCategory(cat)}
                  >
                    <i className={iconClass}></i> {cat}{' '}
                    <span className="count-badge" id={`count-${slugifyCategory(cat)}`}>
                      {counts[cat] || 0}
                    </span>
                  </li>
                );
              })}

              {/* Quick Add Category Pill for Mobile Ribbon */}
              <li
                className="category-ribbon-new-item"
                id="catRibbonNewBtn"
                onClick={() => setShowAddCategorySidebar(!showAddCategorySidebar)}
                title="Add New Category"
              >
                <i className={`fa-solid ${showAddCategorySidebar ? 'fa-xmark' : 'fa-plus'}`}></i>
                <span>{showAddCategorySidebar ? 'Close' : 'New'}</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span id="totalLinksSubtitle" className="subtitle">
                    {filteredLinks.length} items saved
                  </span>
                  {counts.Favorites > 0 && (
                    <span className="badge badge-favorite" id="pinnedCounterBadge" style={{ fontSize: '0.72rem' }}>
                      <i className="fa-solid fa-thumbtack"></i> {counts.Favorites} Pinned to Top
                    </span>
                  )}
                  <span
                    id="dragReorderNotice"
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'var(--bg-color)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                    }}
                    title="Drag and drop cards using the grip icon to reorder links"
                  >
                    <i className="fa-solid fa-grip-vertical"></i> Drag to reorder
                  </span>
                </div>
              </div>
              <div className="header-actions-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                <button
                  id="shareCurrentCategoryBtn"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  onClick={() => handleCopyCategoryShareUrl(currentCategory)}
                  title={`Copy share link for ${currentCategory === 'All' ? 'all public links' : currentCategory + ' category'}`}
                >
                  <i className="fa-solid fa-share-nodes" style={{ color: 'var(--primary-color)' }}></i> Share {currentCategory === 'All' ? 'All' : currentCategory}
                </button>
                <button
                  id="headerCategoryQrBtn"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  onClick={() =>
                    handleOpenQrModal(
                      getCategoryShareUrl(currentCategory),
                      currentCategory === 'All' ? `@${userUsername || 'josephsoren'}'s Public Links` : `${currentCategory} Links`,
                      `Scan to open ${currentCategory === 'All' ? 'all bookmarks' : currentCategory + ' category'} on your mobile phone`,
                      currentCategory !== 'All' ? currentCategory : undefined
                    )
                  }
                  title={`Show QR Code for ${currentCategory === 'All' ? 'all public links' : currentCategory + ' category'}`}
                >
                  <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary-color)' }}></i> QR Code
                </button>
                <button
                  id="headerExportPdfBtn"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  onClick={handleExportPDF}
                  title="Export current view as PDF"
                >
                  <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i> Export PDF
                </button>

                {/* Three Vertical Dots Button beside Export PDF */}
                <div style={{ position: 'relative' }}>
                  <button
                    id="headerThreeDotsBtn"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.9rem', padding: '6px 11px', cursor: 'pointer' }}
                    onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                    title="Link Settings & Public Page Options"
                  >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>

                  {/* Three Dots Dropdown Menu */}
                  {isHeaderMenuOpen && (
                    <div className="dropdown-menu" id="headerDropdownMenu">
                      <button
                        className="dropdown-item"
                        id="menuLinkSettingsBtn"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          setCurrentView('settings');
                        }}
                      >
                        <i className="fa-solid fa-sliders" style={{ color: 'var(--primary-color)' }}></i> Link Settings
                      </button>
                      <button
                        className="dropdown-item"
                        id="menuViewPublicPageBtn"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          handleNavigateToPublicProfile();
                        }}
                      >
                        <i className="fa-solid fa-globe" style={{ color: 'var(--accent-green)' }}></i> View Public Page
                      </button>
                      <button
                        className="dropdown-item"
                        id="menuLandingOverviewBtn"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          handleGoToLanding();
                        }}
                      >
                        <i className="fa-solid fa-house" style={{ color: '#6366f1' }}></i> Product Overview
                      </button>
                      <button
                        className="dropdown-item"
                        id="menuCopyPublicUrlBtn"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          handleCopyProfileUrl();
                        }}
                      >
                        <i className="fa-regular fa-copy"></i> Copy Public Page Link
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Search Area: Positioned immediately after this action bar on mobile devices */}
              <div className="mobile-search-area" id="mobileSearchArea">
                <div className="search-box mobile-search-box">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    type="text"
                    id="mobileSearchInput"
                    placeholder="Search links or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      id="clearMobileSearchBtn"
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Link Cards Grid Container (Drag and Drop Reordering, Favorite Pinned, Only Copy & Open Link icon) */}
            <div className="links-grid" id="linksGrid">
              {filteredLinks.map((link) => {
                const domain = getDomain(link.url);
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                return (
                  <div
                    className={`card ${link.isFavorite ? 'is-favorite' : ''} ${draggedLinkId === link.id ? 'is-dragging' : ''} ${dragOverLinkId === link.id ? 'drag-over' : ''}`}
                    key={link.id}
                    id={`card-${link.id}`}
                    draggable={draggableCardId === link.id}
                    onDragStart={(e) => handleDragStart(e, link.id)}
                    onDragOver={(e) => handleDragOver(e, link.id)}
                    onDragLeave={(e) => handleDragLeave(e, link.id)}
                    onDrop={(e) => handleDrop(e, link.id)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Card Top Control Bar: Drag Handle & Favorite Pin Star */}
                    <div className="card-top-controls" id={`cardTopControls-${link.id}`}>
                      <div
                        className="card-drag-handle"
                        id={`dragHandle-${link.id}`}
                        title="Drag to reorder card"
                        onMouseEnter={() => setDraggableCardId(link.id)}
                        onMouseLeave={() => {
                          if (!draggedLinkId) setDraggableCardId(null);
                        }}
                      >
                        <i className="fa-solid fa-grip-vertical"></i>
                      </div>
                      <button
                        type="button"
                        className={`favorite-star-btn ${link.isFavorite ? 'is-active' : ''}`}
                        id={`favBtn-${link.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(link);
                        }}
                        title={link.isFavorite ? 'Pinned Favorite (Click to unpin)' : 'Pin to top as favorite'}
                        aria-label="Toggle Favorite"
                      >
                        <i className={link.isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star'}></i>
                      </button>
                    </div>

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
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="card-title-link"
                            id={`cardTitleLink-${link.id}`}
                            title={`Open ${link.title}`}
                          >
                            <h4>{link.title}</h4>
                          </a>
                          <span className="domain-tag">{domain}</span>
                        </div>
                      </div>
                      <p className="card-description">
                        {link.description || 'No description added.'}
                      </p>
                    </div>
                    <div className="card-footer">
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                              fontSize: '0.72rem',
                            }}
                            title="This link is public and visible on your public page"
                          >
                            <i className="fa-solid fa-globe" style={{ fontSize: '0.65rem' }}></i> Public
                          </span>
                        )}
                      </div>

                      {/* Card actions: ONLY Copy and Open Link Icon as requested */}
                      <div className="card-actions">
                        <button
                          id={`copyBtn-${link.id}`}
                          onClick={() => copyToClipboard(link.url)}
                          title="Copy URL"
                        >
                          <i className="fa-regular fa-copy"></i>
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
      )}

      {/* VIEW 2: Link Settings & Privacy Management Page */}
      {currentView === 'settings' && (
        <div className="settings-container" id="settingsContainer">
          {/* Top Bar with Back Button */}
          <div className="settings-top-bar">
            <button
              id="backToDashboardBtn"
              className="btn btn-secondary"
              onClick={handleBackToDashboard}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-arrow-left"></i> Back to Dashboard
            </button>
            <div>
              <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>Link Settings & Management</h2>
              <span className="subtitle">
                Configure your public handle, toggle public/private visibility, and edit bookmark details
              </span>
            </div>
          </div>

          {/* Personal Public Page & Subfolder Setup */}
          <div className="settings-profile-card" id="profileSettingsCard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <i className="fa-solid fa-globe" style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }}></i>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>Your Public Page & Subfolder</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, maxWidth: '600px' }}>
                  When you share your subfolder link, visitors can browse all bookmarks you’ve marked as <strong>Public</strong>.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  id="copySettingsPublicUrlBtn"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => handleCopyProfileUrl()}
                >
                  <i className="fa-regular fa-copy"></i> Copy Public URL
                </button>
                <button
                  id="viewSettingsPublicPageBtn"
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => handleNavigateToPublicProfile()}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i> View Public Page
                </button>
              </div>
            </div>

            {/* Subfolder Handle Configuration */}
            <div className="profile-url-box" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Public Subfolder Link
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.95rem' }}>
                    https://linkmanager.in/
                  </span>
                  <input
                    type="text"
                    id="editUsernameInput"
                    className="form-control"
                    style={{ width: '170px', padding: '6px 10px', fontSize: '0.9rem', fontWeight: 600 }}
                    value={editUsernameInput}
                    onChange={(e) => setEditUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                  />
                  <button
                    id="saveUsernameBtn"
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    onClick={handleSaveUsername}
                    disabled={isSavingUsername || editUsernameInput === userUsername}
                  >
                    {isSavingUsername ? 'Saving...' : 'Save Handle'}
                  </button>
                  <button
                    id="subfolderQrBtn"
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    onClick={() =>
                      handleOpenQrModal(
                        getProfileShareUrl(userUsername),
                        `@${userUsername}'s Public Page`,
                        'Scan with any mobile camera to open and access your public bookmark collection'
                      )
                    }
                    title="Show QR Code for your public page"
                  >
                    <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary-color)' }}></i> QR Code
                  </button>
                  <button
                    id="subfolderCopyBtn"
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    onClick={() => handleCopyProfileUrl(userUsername)}
                    title="Copy public page URL"
                  >
                    <i className="fa-regular fa-copy"></i> Copy Link
                  </button>
                </div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Active preview route: {window.location.origin}/{userUsername}
                </span>
              </div>

              {/* Stats Summary */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="badge" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  <strong>{links.length}</strong> Total Links
                </div>
                <div
                  className="badge"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <i className="fa-solid fa-globe"></i> <strong>{links.filter((l) => l.isPublic).length}</strong> Public
                </div>
                <div
                  className="badge"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    backgroundColor: 'rgba(100, 116, 139, 0.12)',
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <i className="fa-solid fa-lock"></i> <strong>{links.filter((l) => !l.isPublic).length}</strong> Private
                </div>
              </div>
            </div>

            {/* Category Share Links Card */}
            <div className="category-manager-card" id="settingsCategoryCard" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <i className="fa-solid fa-folder-tree" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                    Category Public Share Links
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Share specific category links directly with viewers (e.g., /exam-links, /favourites, /tools).
                  </p>
                </div>
                <button
                  id="settingsAddCategoryToggleBtn"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => setShowAddCategorySidebar(!showAddCategorySidebar)}
                >
                  <i className="fa-solid fa-plus"></i> Add Category
                </button>
              </div>

              {showAddCategorySidebar && (
                <div style={{ background: 'var(--card-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (sidebarCategoryInput.trim()) {
                        handleAddCategory(sidebarCategoryInput.trim());
                        setSidebarCategoryInput('');
                        setShowAddCategorySidebar(false);
                      }
                    }}
                    style={{ display: 'flex', gap: '8px' }}
                  >
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Category name, e.g. Exam Links"
                      value={sidebarCategoryInput}
                      onChange={(e) => setSidebarCategoryInput(e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem' }}
                      autoFocus
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      onClick={() => setShowAddCategorySidebar(false)}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}

              <div className="category-share-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                {/* Favorites link */}
                <div className="category-share-item">
                  <div className="category-share-item-header">
                    <span style={{ fontWeight: 600, fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-star" style={{ color: '#f59e0b' }}></i> Favourites
                    </span>
                    <span className="badge" style={{ fontSize: '0.7rem' }}>
                      {counts.Favorites} items
                    </span>
                  </div>
                  <div className="category-share-url-preview">
                    https://linkmanager.in/{userUsername}/favourites
                  </div>
                  <div className="category-share-item-actions">
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                      onClick={() => handleCopyCategoryShareUrl('Favourites')}
                    >
                      <i className="fa-regular fa-copy"></i> Copy Link
                    </button>
                    <button
                      className="btn btn-secondary"
                      id="settingsFavouritesQrBtn"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() =>
                        handleOpenQrModal(
                          getCategoryShareUrl('Favourites'),
                          'Favourites Links',
                          'Scan to open favourite bookmarks directly on your mobile device',
                          'Favourites'
                        )
                      }
                      title="Show QR Code for Favourites"
                    >
                      <i className="fa-solid fa-qrcode"></i> QR
                    </button>
                    <button
                      className="btn btn-outline-sm"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => handleNavigateToPublicProfile(userUsername, 'favourites')}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i> View
                    </button>
                  </div>
                </div>

                {/* All categories */}
                {allCategories.map((cat) => {
                  const slug = slugifyCategory(cat);
                  const count = counts[cat] || 0;
                  return (
                    <div className="category-share-item" key={cat}>
                      <div className="category-share-item-header">
                        <span style={{ fontWeight: 600, fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-folder-open" style={{ color: 'var(--primary-color)' }}></i> {cat}
                        </span>
                        <span className="badge" style={{ fontSize: '0.7rem' }}>
                          {count} items
                        </span>
                      </div>
                      <div className="category-share-url-preview">
                        https://linkmanager.in/{userUsername}/{slug}
                      </div>
                      <div className="category-share-item-actions">
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                          onClick={() => handleCopyCategoryShareUrl(cat)}
                        >
                          <i className="fa-regular fa-copy"></i> Copy Link
                        </button>
                        <button
                          className="btn btn-secondary"
                          id={`settingsCatQrBtn-${slug}`}
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() =>
                            handleOpenQrModal(
                              getCategoryShareUrl(cat),
                              `${cat} Links`,
                              `Scan to view @${userUsername}'s ${cat} collection on mobile`,
                              cat
                            )
                          }
                          title={`Show QR Code for ${cat}`}
                        >
                          <i className="fa-solid fa-qrcode"></i> QR
                        </button>
                        <button
                          className="btn btn-outline-sm"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => handleNavigateToPublicProfile(userUsername, slug)}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i> View
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Links Management List: Toggle Public/Private, Edit, Delete */}
          <div className="settings-links-card" id="settingsLinksCard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>
                Manage Links & Privacy ({settingsFilteredLinks.length})
              </h3>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ width: '200px', height: '36px' }}>
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    type="text"
                    id="settingsSearchInput"
                    placeholder="Search links..."
                    value={settingsSearch}
                    onChange={(e) => setSettingsSearch(e.target.value)}
                  />
                </div>

                <select
                  id="settingsCategorySelect"
                  className="form-control"
                  style={{ width: '130px', padding: '6px 10px', fontSize: '0.85rem' }}
                  value={settingsCategoryFilter}
                  onChange={(e) => setSettingsCategoryFilter(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  <option value="Work">Work</option>
                  <option value="Social">Social</option>
                  <option value="Tools">Tools</option>
                  <option value="Reading">Reading</option>
                  <option value="Personal">Personal</option>
                </select>

                <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '2px' }}>
                  <button
                    className={`filter-btn ${settingsVisibilityFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSettingsVisibilityFilter('all')}
                    style={{ border: 'none', background: settingsVisibilityFilter === 'all' ? 'var(--card-bg)' : 'transparent', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    All ({links.length})
                  </button>
                  <button
                    className={`filter-btn ${settingsVisibilityFilter === 'public' ? 'active' : ''}`}
                    onClick={() => setSettingsVisibilityFilter('public')}
                    style={{ border: 'none', background: settingsVisibilityFilter === 'public' ? 'var(--card-bg)' : 'transparent', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, color: settingsVisibilityFilter === 'public' ? '#10b981' : undefined }}
                  >
                    Public ({links.filter((l) => l.isPublic).length})
                  </button>
                  <button
                    className={`filter-btn ${settingsVisibilityFilter === 'private' ? 'active' : ''}`}
                    onClick={() => setSettingsVisibilityFilter('private')}
                    style={{ border: 'none', background: settingsVisibilityFilter === 'private' ? 'var(--card-bg)' : 'transparent', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Private ({links.filter((l) => !l.isPublic).length})
                  </button>
                </div>
              </div>
            </div>

            {/* List of Links */}
            <div className="settings-links-list" id="settingsLinksList">
              {settingsFilteredLinks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-filter" style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.5 }}></i>
                  <p style={{ margin: 0 }}>No links match the selected filter or search.</p>
                </div>
              ) : (
                settingsFilteredLinks.map((link) => {
                  const domain = getDomain(link.url);
                  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                  return (
                    <div className="settings-link-row" key={link.id} id={`settings-row-${link.id}`}>
                      <div className="settings-row-info">
                        <img
                          src={faviconUrl}
                          className="favicon"
                          alt="Favicon"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=google.com&sz=64';
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{link.title}</h4>
                            <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{link.category}</span>
                          </div>
                          <span className="domain-tag" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {link.url}
                          </span>
                          {link.description && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              {link.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="settings-row-actions">
                        {/* Public / Private Toggle Switch */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="toggle-switch" title="Toggle Public / Private visibility">
                            <input
                              type="checkbox"
                              id={`togglePublic-${link.id}`}
                              checked={Boolean(link.isPublic)}
                              onChange={() => handleTogglePublic(link)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              width: '50px',
                              color: link.isPublic ? '#10b981' : 'var(--text-secondary)',
                            }}
                          >
                            {link.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>

                        {/* Action Buttons: Favorite Star, Copy, Open, Edit Info, Delete */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            id={`settingsFavBtn-${link.id}`}
                            className={`btn btn-outline-sm ${link.isFavorite ? 'favorite-star-btn is-active' : ''}`}
                            onClick={() => handleToggleFavorite(link)}
                            title={link.isFavorite ? 'Unpin from favorites' : 'Pin to top as favorite'}
                            style={{
                              padding: '6px 10px',
                              color: link.isFavorite ? '#f59e0b' : 'var(--text-secondary)',
                              borderColor: link.isFavorite ? 'rgba(245, 158, 11, 0.4)' : undefined,
                              backgroundColor: link.isFavorite ? 'rgba(245, 158, 11, 0.1)' : undefined,
                            }}
                          >
                            <i className={link.isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star'}></i>
                          </button>
                          <button
                            id={`settingsCopyBtn-${link.id}`}
                            className="btn btn-outline-sm"
                            onClick={() => copyToClipboard(link.url)}
                            title="Copy URL"
                            style={{ padding: '6px 10px' }}
                          >
                            <i className="fa-regular fa-copy"></i>
                          </button>
                          <a
                            id={`settingsOpenBtn-${link.id}`}
                            className="btn btn-outline-sm"
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open link"
                            style={{ padding: '6px 10px', textDecoration: 'none' }}
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          </a>
                          <button
                            id={`settingsEditBtn-${link.id}`}
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditModal(link)}
                            title="Edit link information"
                            style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                          >
                            <i className="fa-regular fa-pen-to-square"></i> Edit Info
                          </button>
                          <button
                            id={`settingsDeleteBtn-${link.id}`}
                            className="btn btn-outline-sm delete-btn"
                            onClick={() => handleOpenDeleteModal(link)}
                            title="Delete Link"
                            style={{ padding: '6px 10px', color: '#ef4444' }}
                          >
                            <i className="fa-regular fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Public Profile Page (https://linkmanager.in/{username}) */}
      {currentView === 'public_profile' && (
        <div className="public-profile-wrapper" id="publicProfileWrapper">
          {/* Public Top Navbar */}
          <header className="navbar" id="publicNavbar">
            <div className="logo" id="publicAppLogo" onClick={handleGoToLanding} style={{ cursor: 'pointer' }} title="LinkManager.in Home">
              <i className="fa-solid fa-link logo-icon"></i>
              <span>
                LinkManager<span className="domain">.in</span>
              </span>
            </div>

            <div className="nav-controls">
              {currentUser ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    id="publicToHomeBtn"
                    className="btn btn-secondary"
                    onClick={handleGoToLanding}
                    style={{ fontSize: '0.85rem' }}
                    title="Product Overview & Features"
                  >
                    <i className="fa-solid fa-house"></i> Home
                  </button>
                  <button
                    id="publicToSettingsBtn"
                    className="btn btn-secondary"
                    onClick={() => setCurrentView('settings')}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <i className="fa-solid fa-sliders"></i> Link Settings
                  </button>
                  <button
                    id="publicToDashboardBtn"
                    className="btn btn-primary"
                    onClick={handleBackToDashboard}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <i className="fa-solid fa-table-columns"></i> My Dashboard
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    id="publicToHomeBtn"
                    className="btn btn-secondary"
                    onClick={handleGoToLanding}
                    style={{ fontSize: '0.85rem' }}
                    title="Product Overview & Features"
                  >
                    <i className="fa-solid fa-house"></i> Home
                  </button>
                  <button
                    id="publicLoginBtn"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsLoginMode(true);
                      setIsAuthModalOpen(true);
                    }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <i className="fa-solid fa-user"></i> Log In
                  </button>
                  <button
                    id="publicSignupBtn"
                    className="btn btn-primary"
                    onClick={() => {
                      setIsLoginMode(false);
                      setIsAuthModalOpen(true);
                    }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Create Free LinkManager
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Owner Preview Banner */}
          {currentUser && (userUsername === publicProfileUsername || currentUser.uid === publicProfileUser?.uid) && (
            <div
              id="ownerPreviewBanner"
              style={{
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                borderBottom: '1px solid rgba(37, 99, 235, 0.2)',
                padding: '8px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                color: 'var(--primary-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-regular fa-eye"></i>
                <span>You are viewing your public page as visitors see it.</span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={() => setCurrentView('settings')}
              >
                <i className="fa-solid fa-sliders"></i> Manage in Link Settings
              </button>
            </div>
          )}

          {/* Public Profile Main Content */}
          <div className="public-profile-content">
            {/* Hero Profile Card */}
            <div className="public-profile-hero" id="publicProfileHero">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {publicProfileUser?.photoURL ? (
                  <img
                    src={publicProfileUser.photoURL}
                    alt="User avatar"
                    className="public-avatar"
                  />
                ) : (
                  <div className="public-avatar">
                    {(publicProfileUser?.displayName || publicProfileUsername || 'U')[0].toUpperCase()}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700 }}>
                      {publicProfileUser?.displayName || publicProfileUsername}
                    </h2>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                        fontSize: '0.75rem',
                      }}
                    >
                      <i className="fa-solid fa-globe"></i> Public Collection
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                      @{publicProfileUser?.username || publicProfileUsername}
                    </span>
                    <span>•</span>
                    <span>{publicFilteredLinks.length} public link{publicFilteredLinks.length === 1 ? '' : 's'} shared</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    https://linkmanager.in/{publicProfileUser?.username || publicProfileUsername}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  id="sharePublicProfileBtn"
                  className="btn btn-primary"
                  onClick={() => handleCopyProfileUrl(publicProfileUsername)}
                  style={{ fontSize: '0.85rem' }}
                >
                  <i className="fa-solid fa-share-nodes"></i> Share Public Page
                </button>
                <button
                  id="publicProfileQrBtn"
                  className="btn btn-secondary"
                  onClick={() =>
                    handleOpenQrModal(
                      getProfileShareUrl(publicProfileUsername),
                      `@${publicProfileUser?.displayName || publicProfileUsername}'s Links`,
                      'Scan this QR code with any smartphone camera to open and bookmark these links on mobile'
                    )
                  }
                  style={{ fontSize: '0.85rem' }}
                  title="Generate QR code for this public page"
                >
                  <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary-color)' }}></i> QR Code
                </button>
              </div>
            </div>

            {/* Active Category Filter Banner */}
            {publicCategory !== 'All' && (
              <div className="category-view-banner" id="publicCategoryActiveBanner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    id="backToAllCategoriesBtn"
                    className="btn btn-secondary back-to-all-btn"
                    onClick={handleBackToAllCategories}
                  >
                    <i className="fa-solid fa-arrow-left"></i> Back to all categories
                  </button>
                  <div className="category-view-info">
                    <span>Category:</span>
                    <span className="category-pill-badge">
                      {publicCategory === 'Favourites' || publicCategory === 'Favorites' ? (
                        <i className="fa-solid fa-star" style={{ color: '#f59e0b' }}></i>
                      ) : (
                        <i className="fa-solid fa-folder-open"></i>
                      )}
                      {publicCategory}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      ({publicFilteredLinks.length} link{publicFilteredLinks.length === 1 ? '' : 's'})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    id="copyCategoryPublicUrlBtn"
                    className="btn btn-outline-sm"
                    onClick={() => handleCopyCategoryShareUrl(publicCategory, publicProfileUsername)}
                    title={`Copy share link for ${publicCategory}`}
                  >
                    <i className="fa-solid fa-link"></i> Copy Category Link
                  </button>
                  <button
                    id="categoryQrBtn"
                    className="btn btn-outline-sm"
                    onClick={() =>
                      handleOpenQrModal(
                        getCategoryShareUrl(publicCategory, publicProfileUsername),
                        `${publicCategory} Category`,
                        `Scan to open @${publicProfileUsername}'s ${publicCategory} bookmarks on your mobile phone`,
                        publicCategory
                      )
                    }
                    title={`Show QR code for ${publicCategory}`}
                  >
                    <i className="fa-solid fa-qrcode"></i> QR Code
                  </button>
                </div>
              </div>
            )}

            {/* Public Links Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  id="publicCatAllBtn"
                  className={`btn ${publicCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  onClick={() => handleSelectPublicCategory('All')}
                >
                  All
                </button>
                {hasPublicFavorites && (
                  <button
                    id="publicCatFavBtn"
                    className={`btn ${publicCategory === 'Favourites' || publicCategory === 'Favorites' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                    onClick={() => handleSelectPublicCategory('Favourites')}
                  >
                    <i className="fa-solid fa-star" style={{ color: '#f59e0b', marginRight: '4px' }}></i> Favorites
                  </button>
                )}
                {availablePublicCategories.map((cat) => (
                  <button
                    key={cat}
                    id={`publicCatBtn-${slugifyCategory(cat)}`}
                    className={`btn ${publicCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                    onClick={() => handleSelectPublicCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="search-box" style={{ width: '240px', height: '36px' }}>
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  id="publicSearchInput"
                  placeholder="Search shared links..."
                  value={publicSearch}
                  onChange={(e) => setPublicSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Public Links Grid */}
            {publicProfileLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--primary-color)', marginBottom: '12px' }}></i>
                <p>Loading public links...</p>
              </div>
            ) : publicFilteredLinks.length === 0 ? (
              <div className="empty-state" id="publicEmptyState" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '48px 24px' }}>
                <i className="fa-solid fa-globe" style={{ fontSize: '2.5rem', color: 'var(--text-secondary)', opacity: 0.5, marginBottom: '12px' }}></i>
                <h3>No public links found</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: publicCategory !== 'All' ? '16px' : 0 }}>
                  @{publicProfileUsername} hasn't shared any public links {publicCategory !== 'All' ? `in the "${publicCategory}" category` : 'matching this search'} yet.
                </p>
                {publicCategory !== 'All' && (
                  <button
                    id="emptyStateBackToAllBtn"
                    className="btn btn-secondary back-to-all-btn"
                    onClick={handleBackToAllCategories}
                  >
                    <i className="fa-solid fa-arrow-left"></i> Back to all categories
                  </button>
                )}
              </div>
            ) : (
              <div className="links-grid" id="publicLinksGrid">
                {publicFilteredLinks.map((link) => {
                  const domain = getDomain(link.url);
                  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                  return (
                    <div className="card" key={link.id} id={`public-card-${link.id}`}>
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
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="card-title-link"
                              id={`publicTitleLink-${link.id}`}
                              title={`Open ${link.title}`}
                            >
                              <h4>{link.title}</h4>
                            </a>
                            <span className="domain-tag">{domain}</span>
                          </div>
                        </div>
                        <p className="card-description">
                          {link.description || 'No description added.'}
                        </p>
                      </div>
                      <div className="card-footer">
                        <span
                          className="badge"
                          style={{ cursor: 'pointer' }}
                          title={`Filter by ${link.category}`}
                          onClick={() => handleSelectPublicCategory(link.category)}
                        >
                          {link.category}
                        </span>
                        <div className="card-actions">
                          <button
                            id={`publicQrBtn-${link.id}`}
                            onClick={() =>
                              handleOpenQrModal(
                                link.url,
                                link.title,
                                'Scan with smartphone camera to open link on mobile',
                                link.category
                              )
                            }
                            title="Scan QR Code to open on mobile"
                          >
                            <i className="fa-solid fa-qrcode"></i>
                          </button>
                          <button
                            id={`publicCopyBtn-${link.id}`}
                            onClick={() => copyToClipboard(link.url)}
                            title="Copy URL"
                          >
                            <i className="fa-regular fa-copy"></i>
                          </button>
                          <a
                            id={`publicOpenBtn-${link.id}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Link in New Tab"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="linkCategory" style={{ margin: 0 }}>Category</label>
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    style={{ fontSize: '0.78rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setIsAddingCustomCategoryInModal(!isAddingCustomCategoryInModal)}
                  >
                    <i className={`fa-solid ${isAddingCustomCategoryInModal ? 'fa-list' : 'fa-plus'}`}></i>
                    {isAddingCustomCategoryInModal ? 'Existing Categories' : 'New Category'}
                  </button>
                </div>

                {!isAddingCustomCategoryInModal ? (
                  <select
                    id="linkCategory"
                    value={formCategory}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingCustomCategoryInModal(true);
                      } else {
                        setFormCategory(e.target.value);
                      }
                    }}
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add New Category...</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      id="modalNewCategoryInput"
                      className="form-control"
                      placeholder="e.g. Exam Links"
                      value={modalNewCategoryText}
                      onChange={(e) => setModalNewCategoryText(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      onClick={() => {
                        if (modalNewCategoryText.trim()) {
                          const newCat = modalNewCategoryText.trim();
                          handleAddCategory(newCat);
                          setFormCategory(newCat);
                          setIsAddingCustomCategoryInModal(false);
                          setModalNewCategoryText('');
                        }
                      }}
                    >
                      Save
                    </button>
                  </div>
                )}
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

              <div className="public-switch-bar" style={{ marginBottom: '1rem', marginTop: 0 }}>
                <div className="switch-label">
                  <span className="title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-star" style={{ color: '#f59e0b', fontSize: '0.85rem' }}></i> Pin as Favorite
                  </span>
                  <span className="desc">Pin this link to the top of your dashboard grid</span>
                </div>
                <label className="toggle-switch" htmlFor="formIsFavoriteToggle">
                  <input
                    type="checkbox"
                    id="formIsFavoriteToggle"
                    checked={formIsFavorite}
                    onChange={(e) => setFormIsFavorite(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
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
                <button
                  type="button"
                  id="shareModalInlineQrBtn"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px', whiteSpace: 'nowrap' }}
                  onClick={() =>
                    handleOpenQrModal(
                      getPublicShareUrl(sharingLink),
                      sharingLink.title,
                      'Scan this QR code with any smartphone camera to open this bookmark',
                      sharingLink.category
                    )
                  }
                  title="Generate QR Code"
                >
                  <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary-color)' }}></i> QR
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

            {/* Extra Options: QR Code, Native Device Share & Direct URL */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                id="shareModalQrCodeBtn"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.82rem', justifyContent: 'center' }}
                onClick={() =>
                  handleOpenQrModal(
                    getPublicShareUrl(sharingLink),
                    sharingLink.title,
                    'Scan with your mobile camera to open this bookmark directly on mobile',
                    sharingLink.category
                  )
                }
              >
                <i className="fa-solid fa-qrcode" style={{ color: 'var(--primary-color)' }}></i> QR Code
              </button>
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

      {/* Modal Dialog: QR Code Generator & Viewer for Public Link Sharing */}
      <QrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        url={qrModalData.url}
        title={qrModalData.title}
        subtitle={qrModalData.subtitle}
        categoryBadge={qrModalData.categoryBadge}
      />
    </>
  );
}
