import React, { createContext, useContext, useMemo, useState } from 'react';

export interface SelectionContextValue {
  selectedTenantId: string | null;
  selectedPropertyId: string | null;
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

  const value = useMemo(
    () => ({
      selectedTenantId,
      selectedPropertyId,
      setSelectedTenantId,
      setSelectedPropertyId,
    }),
    [selectedTenantId, selectedPropertyId]
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
