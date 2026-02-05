import React, { useState } from 'react';

import { ComplianceRulesModal } from '../components/ComplianceRulesModal';
import { JobStructureModal } from '../components/JobStructureModal';
import { useProperty } from '../hooks/useProperty';

export function SettingsPage(): React.ReactElement {
  const [isJobStructureOpen, setIsJobStructureOpen] = useState(false);
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);
  const property = useProperty();
  const tenantId = property?.tenantId || '';
  const propertyId = property?.id;

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
      </div>

      <JobStructureModal isOpen={isJobStructureOpen} onClose={() => setIsJobStructureOpen(false)} />
      <ComplianceRulesModal
        isOpen={isComplianceOpen}
        onClose={() => setIsComplianceOpen(false)}
        tenantId={tenantId}
        propertyId={propertyId}
      />
    </div>
  );
}
