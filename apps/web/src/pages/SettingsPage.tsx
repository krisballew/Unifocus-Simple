import React, { useState } from 'react';

import { ComplianceRulesModal } from '../components/ComplianceRulesModal';
import { JobStructureModal } from '../components/JobStructureModal';
import { useAuth } from '../hooks/useAuth';
import { useSelection } from '../context/SelectionContext';
import { hasAnyPermission, hasPermission, SCHEDULING_PERMISSIONS } from '../utils/permissions';
import { ScheduleSettingsModal } from '../features/scheduleManagement/components/ScheduleSettingsModal';

export function SettingsPage(): React.ReactElement {
  const [isJobStructureOpen, setIsJobStructureOpen] = useState(false);
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);
  const [isScheduleSettingsOpen, setIsScheduleSettingsOpen] = useState(false);
  const { user } = useAuth();
  const { selectedTenantId, selectedPropertyId, isHydrated } = useSelection();
  const tenantId = selectedTenantId || '';
  const propertyId = selectedPropertyId;


  const featureSchedulingV2 = import.meta.env.VITE_FEATURE_SCHEDULING_V2 === 'true';
  const hasScheduleSettingsScope = hasAnyPermission(user, [
    SCHEDULING_PERMISSIONS.VIEW,
    SCHEDULING_PERMISSIONS.SETTINGS_VIEW,
    SCHEDULING_PERMISSIONS.SETTINGS_EDIT,
  ]);
  const canViewScheduleSettings = featureSchedulingV2 && hasScheduleSettingsScope;
  const canOpenScheduleSettings = canViewScheduleSettings && isHydrated;
  const scheduleSettingsTitle = !featureSchedulingV2
    ? 'Scheduling V2 is disabled'
    : !hasScheduleSettingsScope
      ? 'You do not have permission to view schedule settings'
      : !isHydrated
        ? 'Loading selection...'
        : !propertyId
          ? 'Select a property to manage schedule settings'
          : '';
  const canEditScheduleSettings = hasPermission(user, SCHEDULING_PERMISSIONS.SETTINGS_EDIT);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="page-description">
          Configure your workspace. Choose a category to manage settings and system setup.
        </p>
      </div>

      <div className="settings-grid">
        <button className="settings-card" type="button" onClick={() => setIsJobStructureOpen(true)}>
          <div className="settings-card__meta">Configuration</div>
          <div className="settings-card__title">Job Structure</div>
          <div className="settings-card__description">
            Define job roles, departments, and hierarchy for your properties.
          </div>
        </button>

        <button className="settings-card" type="button" onClick={() => setIsComplianceOpen(true)}>
          <div className="settings-card__meta">Compliance</div>
          <div className="settings-card__title">Labor Compliance Rules</div>
          <div className="settings-card__description">
            Create and manage labor compliance rules from CBAs and policies. Validate shifts
            automatically.
          </div>
        </button>

        <button
          className="settings-card"
          type="button"
          onClick={() => setIsScheduleSettingsOpen(true)}
          disabled={!canOpenScheduleSettings}
          title={scheduleSettingsTitle}
        >
          <div className="settings-card__meta">Scheduling</div>
          <div className="settings-card__title">Schedule Settings</div>
          <div className="settings-card__description">Planning period templates</div>
        </button>
      </div>

      <JobStructureModal isOpen={isJobStructureOpen} onClose={() => setIsJobStructureOpen(false)} />
      <ComplianceRulesModal
        isOpen={isComplianceOpen}
        onClose={() => setIsComplianceOpen(false)}
        tenantId={tenantId}
        propertyId={propertyId}
      />
      <ScheduleSettingsModal
        isOpen={isScheduleSettingsOpen}
        onClose={() => setIsScheduleSettingsOpen(false)}
        propertyId={propertyId}
        canEdit={canEditScheduleSettings}
      />
    </div>
  );
}
