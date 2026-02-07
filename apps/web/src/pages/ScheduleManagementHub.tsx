import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { SCHEDULING_PERMISSIONS, hasPermission } from '../utils/permissions';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  permission?: string;
}

const SCHEDULE_FEATURES: FeatureCard[] = [
  {
    id: 'periods',
    title: 'Schedule Periods',
    description: 'Manage scheduling periods and time ranges',
    icon: 'calendar',
    path: '/schedule-management/periods',
  },
  {
    id: 'editor',
    title: 'Schedule Editor',
    description: 'Create and edit employee schedules',
    icon: 'edit',
    path: '/schedule-management/editor',
  },
  {
    id: 'requests',
    title: 'Schedule Requests',
    description: 'Review and approve schedule change requests',
    icon: 'inbox',
    path: '/schedule-management/requests',
    permission: SCHEDULING_PERMISSIONS.MANAGE_REQUESTS,
  },
  {
    id: 'availability',
    title: 'Employee Availability',
    description: 'View and manage employee availability',
    icon: 'users',
    path: '/schedule-management/availability',
    permission: SCHEDULING_PERMISSIONS.MANAGE_AVAILABILITY,
  },
];

function renderIcon(iconName: string): React.ReactElement {
  const iconSVGs: Record<string, string> = {
    calendar:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H5V8h14v13z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    inbox:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-2.96-3.83c-.37-.48-.09-1.02 .61-1.02 .36 0 .72 .2 .88 .53L10.5 13l1.62-2.16c.16-.33 .52-.53 .88-.53 .7 0 .98 .54 .61 1.02z"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
  };

  const svgStr = iconSVGs[iconName] ?? iconSVGs['calendar'];
  return <span dangerouslySetInnerHTML={{ __html: svgStr }} />;
}

export function ScheduleManagementHub(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Schedule Management</h1>
        <p className="page-description">
          Select a feature below to manage schedules, review requests, or configure availability
        </p>
      </div>

      <div className="feature-cards-grid">
        {SCHEDULE_FEATURES.map((feature) => {
          // Check permission if required
          if (feature.permission && !hasPermission(user, feature.permission)) {
            return null;
          }

          return (
            <button
              key={feature.id}
              type="button"
              className="feature-card"
              onClick={() => handleCardClick(feature.path)}
            >
              <div className="feature-card__icon">{renderIcon(feature.icon)}</div>
              <div className="feature-card__content">
                <h2 className="feature-card__title">{feature.title}</h2>
                <p className="feature-card__description">{feature.description}</p>
              </div>
              <div className="feature-card__arrow">→</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
