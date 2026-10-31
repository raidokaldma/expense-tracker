import { create } from 'zustand';

interface MobileView {
  query: string;
  /** null: the newest month. */
  monthKey: string | null;
  openGroups: ReadonlySet<string>;
  openCategory: string | null;
  editing: boolean;
}

/** What the mobile pages show, kept while switching tabs (a reload starts over). */
export const useMobileView = create<MobileView>(() => ({
  query: '',
  monthKey: null,
  openGroups: new Set(),
  openCategory: null,
  editing: false,
}));

export const setMobileView = useMobileView.setState;
