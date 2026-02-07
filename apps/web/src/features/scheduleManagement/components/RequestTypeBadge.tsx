import React from 'react';

import type { SchedulingRequest } from '../api/requests';

export interface RequestTypeBadgeProps {
  request: SchedulingRequest;
}

export function RequestTypeBadge({ request }: RequestTypeBadgeProps): React.ReactElement {
  // Determine request type:
  // if toEmployeeId is null AND shift.isOpenShift true => Open Shift Claim
  // else => Swap/Handoff
  const isOpenShiftClaim = !request.toEmployeeId && request.shift?.isOpenShift;
  const type = isOpenShiftClaim ? 'Open Shift Claim' : 'Swap/Handoff';

  const badgeStyle: React.CSSProperties = {
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    display: 'inline-block',
    backgroundColor: isOpenShiftClaim ? '#e3f2fd' : '#f3e5f5',
    color: isOpenShiftClaim ? '#1976d2' : '#7b1fa2',
  };

  return <span style={badgeStyle}>{type}</span>;
}
