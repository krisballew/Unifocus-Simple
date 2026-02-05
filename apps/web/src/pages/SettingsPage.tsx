import React, { useState } from 'react';

import { JobStructureModal } from '../components/JobStructureModal';

export function SettingsPage(): React.ReactElement {
  const [isJobStructureOpen, setIsJobStructureOpen] = useState(false);

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
      </div>

      <JobStructureModal isOpen={isJobStructureOpen} onClose={() => setIsJobStructureOpen(false)} />
    </div>
  );
}
