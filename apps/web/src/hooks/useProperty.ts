import { useSelection } from '../context/SelectionContext';

export interface UsePropertyResult {
  tenantId: string | null;
  propertyId: string | null;
}

export function useProperty(): UsePropertyResult {
  const { selectedTenantId: tenantId, selectedPropertyId: propertyId } = useSelection();

  return {
    tenantId,
    propertyId,
  };
}
