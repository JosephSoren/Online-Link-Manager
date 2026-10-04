export type LinktreeButtonStyle = 'pill' | 'rounded' | 'hard' | 'outline' | 'shadow';
export type PublicLayoutView = 'linktree' | 'compact' | 'cards';

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  github?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
  twitch?: string;
  spotify?: string;
  discord?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
  userId?: string;
  favorite?: boolean;
  isPublic?: boolean;
  isFavorite?: boolean;
  order?: number;
  clickCount?: number;
  isHighlighted?: boolean;
  lastClickedAt?: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  email?: string;
  bio?: string;
  themeTemplate?: string;
  bannerStyle?: string;
  bannerUrl?: string;
  buttonStyle?: LinktreeButtonStyle;
  defaultView?: PublicLayoutView;
  verifiedBadge?: boolean;
  socialLinks?: SocialLinks;
}

export type CategoryType = 'All' | 'Work' | 'Social' | 'Tools' | 'Reading' | 'Personal';

export const CATEGORIES: { name: CategoryType; icon: string }[] = [
  { name: 'All', icon: 'Layers' },
  { name: 'Work', icon: 'Briefcase' },
  { name: 'Social', icon: 'Share2' },
  { name: 'Tools', icon: 'Wrench' },
  { name: 'Reading', icon: 'BookOpen' },
  { name: 'Personal', icon: 'User' },
];
