import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
  tenantId: 'selection.tenantId',
  propertyId: 'selection.propertyId',
} as const;

export interface SelectionContextValue {
  selectedTenantId: string | null;
  selectedPropertyId: string | null;
  isHydrated: boolean;
  setSelectedTenantId: (tenantId: string | null) => void;
  setSelectedPropertyId: (propertyId: string | null) => void;
}

const SelectionContext = createContext<SelectionContextValue | undefined>(undefined);

export interface SelectionProviderProps {
  children: React.ReactNode;
  initialTenantId?: string | null;
  initialPropertyId?: string | null;
}

export function SelectionProvider({
  children,
  initialTenantId = null,
  initialPropertyId = null,
}: SelectionProviderProps): React.ReactElement {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(initialTenantId);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(initialPropertyId);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsHydrated(true);
      return;
    }

    const storedTenantId = window.localStorage.getItem(STORAGE_KEYS.tenantId);
    const storedPropertyId = window.localStorage.getItem(STORAGE_KEYS.propertyId);

    if (!initialTenantId && storedTenantId) {
      setSelectedTenantId(storedTenantId);
    }

    if (!initialPropertyId && storedPropertyId) {
      setSelectedPropertyId(storedPropertyId);
    }

    setIsHydrated(true);
  }, [initialTenantId, initialPropertyId]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    if (selectedTenantId) {
      window.localStorage.setItem(STORAGE_KEYS.tenantId, selectedTenantId);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.tenantId);
    }
  }, [selectedTenantId, isHydrated]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    if (selectedPropertyId) {
      window.localStorage.setItem(STORAGE_KEYS.propertyId, selectedPropertyId);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.propertyId);
    }
  }, [selectedPropertyId, isHydrated]);

  const value = useMemo(
    () => ({
      selectedTenantId,
      selectedPropertyId,
      isHydrated,
      setSelectedTenantId,
      setSelectedPropertyId,
    }),
    [selectedTenantId, selectedPropertyId, isHydrated]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}

export function useSelectedPropertyId(): { selectedPropertyId: string | null; isHydrated: boolean } {
  const { selectedPropertyId, isHydrated } = useSelection();
  return { selectedPropertyId, isHydrated };
}
