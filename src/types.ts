export interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  createdAt: string;
  userId?: string;
  favorite?: boolean;
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
