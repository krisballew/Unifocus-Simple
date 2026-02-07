import React from 'react';

import type { ScheduleStatus } from '../../../services/api-client';

export interface ScheduleStatusBadgeProps {
  status: ScheduleStatus;
}

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps): React.ReactElement {
  const className = `badge badge--${status.toLowerCase()}`;
  const label = status.charAt(0) + status.slice(1).toLowerCase();

  return <span className={className}>{label}</span>;
}
