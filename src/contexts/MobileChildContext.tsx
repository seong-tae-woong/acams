'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface ChildInfo {
  id: string;
  name: string;
  avatarColor: string;
}

interface MobileChildContextType {
  role: 'parent' | 'student' | null;
  allChildren: ChildInfo[];
  selectedChild: ChildInfo | null;
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
}

const MobileChildContext = createContext<MobileChildContextType>({
  role: null,
  allChildren: [],
  selectedChild: null,
  selectedChildId: null,
  setSelectedChildId: () => {},
});

export function MobileChildProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<'parent' | 'student' | null>(null);
  const [allChildren, setAllChildren] = useState<ChildInfo[]>([]);
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/mobile/children')
      .then((r) => r.json())
      .then((data: { role?: string; children?: ChildInfo[] }) => {
        if (data.role === 'parent' || data.role === 'student') {
          setRole(data.role);
        }
        const list = data.children ?? [];
        if (list.length > 0) {
          setAllChildren(list);
          const saved = typeof window !== 'undefined'
            ? localStorage.getItem('acams_selected_child')
            : null;
          const valid = list.find((c) => c.id === saved);
          setSelectedChildIdState(valid ? saved! : list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const setSelectedChildId = (id: string) => {
    const child = allChildren.find((c) => c.id === id);
    if (child) {
      setSelectedChildIdState(id);
      localStorage.setItem('acams_selected_child', id);
    }
  };

  const selectedChild = allChildren.find((c) => c.id === selectedChildId) ?? null;

  return (
    <MobileChildContext.Provider
      value={{ role, allChildren, selectedChild, selectedChildId, setSelectedChildId }}
    >
      {children}
    </MobileChildContext.Provider>
  );
}

export function useMobileChild() {
  return useContext(MobileChildContext);
}
