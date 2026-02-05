/**
 * ComplianceRulesModal: React component for managing labor compliance rules
 * Features: Compile rules from text, publish packages, validate shifts, view results
 */

import { useState } from 'react';

import {
  useCompileRules,
  usePublishRulePackage,
  useValidateRules,
  useRulePackagesByStatus,
} from '../hooks/useComplianceRules';
import { useToast } from '../hooks/useToast';

export interface ComplianceRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  propertyId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ComplianceRulesModal({
  isOpen,
  onClose,
  tenantId: _tenantId,
  propertyId: _propertyId,
}: ComplianceRulesModalProps) {
  type TabType = 'compile' | 'manage' | 'validate';

  const [activeTab, setActiveTab] = useState<TabType>('compile');

  // State for compile tab
  const [complianceText, setComplianceText] = useState('');
  const [packageName, setPackageName] = useState('');
  const { showToast } = useToast();

  // State for validate tab
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);

  // Mutations and queries
  const compileRules = useCompileRules();
  const publishPackage = usePublishRulePackage();
  const validateRules = useValidateRules();
  const { packages: draftPackages } = useRulePackagesByStatus('DRAFT');
  const { packages: publishedPackages } = useRulePackagesByStatus('PUBLISHED');

  if (!isOpen) return null;

  // ========================================================================
  // Compile Tab
  // ========================================================================

  const handleCompile = async () => {
    if (!complianceText.trim()) {
      showToast('Please enter compliance text', 'error');
      return;
    }

    try {
      const result = await compileRules.mutateAsync({
        complianceText,
        name: packageName || `Rule Package ${new Date().toLocaleDateString()}`,
      });

      showToast(`Successfully created package with ${result.rules?.length ?? 0} rules`, 'success');
      setComplianceText('');
      setPackageName('');
      setActiveTab('manage');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Compilation failed', 'error');
    }
  };

  // ========================================================================
  // Manage Tab
  // ========================================================================

  const handlePublish = async (packageId: string) => {
    try {
      const result = await publishPackage.mutateAsync({
        rulePackageId: packageId,
        message: `Published on ${new Date().toLocaleDateString()}`,
      });

      showToast(`Package published as v${result.version}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Publishing failed', 'error');
    }
  };

  // ========================================================================
  // Validate Tab
  // ========================================================================

  const handleValidate = async () => {
    if (!selectedPackageId) {
      showToast('Please select a rule package', 'error');
      return;
    }

    if (!dateStart || !dateEnd) {
      showToast('Please select a date range', 'error');
      return;
    }

    try {
      const result = await validateRules.mutateAsync({
        rulePackageId: selectedPackageId,
        employeeId: employeeId || undefined,
        dateStart,
        dateEnd,
      });

      showToast(
        `Validation complete: ${result.totalViolations} violations found`,
        result.totalViolations > 0 ? 'warning' : 'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Validation failed', 'error');
    }
  };

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Labor Compliance Rules</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}
        >
          <button
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'compile' ? 'var(--surface-primary)' : 'transparent',
              borderBottom: activeTab === 'compile' ? '2px solid var(--brand-primary)' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'compile' ? 600 : 400,
            }}
            onClick={() => setActiveTab('compile')}
          >
            Compile Rules
          </button>
          <button
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'manage' ? 'var(--surface-primary)' : 'transparent',
              borderBottom: activeTab === 'manage' ? '2px solid var(--brand-primary)' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'manage' ? 600 : 400,
            }}
            onClick={() => setActiveTab('manage')}
          >
            Manage Packages
          </button>
          <button
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'validate' ? 'var(--surface-primary)' : 'transparent',
              borderBottom: activeTab === 'validate' ? '2px solid var(--brand-primary)' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'validate' ? 600 : 400,
            }}
            onClick={() => setActiveTab('validate')}
          >
            Validate Rules
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '16px' }}>
          {/* COMPILE TAB */}
          {activeTab === 'compile' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Package Name (Optional)
                </label>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g., Hotel CBA - 2024"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Compliance Text (CBA, Policies, Regulations*)
                </label>
                <textarea
                  value={complianceText}
                  onChange={(e) => setComplianceText(e.target.value)}
                  placeholder="Paste your compliance document here. The LLM will extract rules automatically."
                  rows={12}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    resize: 'vertical',
                  }}
                />
                <div
                  style={{ fontSize: '12px', color: 'var(--brand-secondary)', marginTop: '4px' }}
                >
                  Max 10,000 characters
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setComplianceText('');
                    setPackageName('');
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  disabled={compileRules.isPending}
                >
                  Clear
                </button>
                <button
                  onClick={handleCompile}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--brand-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  disabled={compileRules.isPending}
                >
                  {compileRules.isPending ? 'Compiling...' : 'Compile Rules via LLM'}
                </button>
              </div>
            </div>
          )}

          {/* MANAGE TAB */}
          {activeTab === 'manage' && (
            <div>
              <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
                Draft Packages
              </h3>
              {draftPackages.length === 0 ? (
                <p style={{ color: 'var(--brand-secondary)', marginBottom: '24px' }}>
                  No draft packages
                </p>
              ) : (
                <div style={{ marginBottom: '24px' }}>
                  {draftPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      style={{
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{pkg.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--brand-secondary)' }}>
                          {pkg.compiledRules?.length ?? 0} rules • Created{' '}
                          {new Date(pkg.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handlePublish(pkg.id)}
                        style={{
                          padding: '8px 16px',
                          background: 'var(--brand-primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                        disabled={publishPackage.isPending}
                      >
                        Publish
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
                Published Packages
              </h3>
              {publishedPackages.length === 0 ? (
                <p style={{ color: 'var(--brand-secondary)' }}>No published packages</p>
              ) : (
                <div>
                  {publishedPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      style={{
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        background: 'var(--surface-subtle)',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{pkg.name}</div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--brand-secondary)',
                          marginTop: '4px',
                        }}
                      >
                        v{pkg.version} • {pkg.compiledRules?.length ?? 0} rules • Published{' '}
                        {pkg.publishedAt ? new Date(pkg.publishedAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VALIDATE TAB */}
          {activeTab === 'validate' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Rule Package to Validate Against (Published)*
                </label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">-- Select Package --</option>
                  {publishedPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} (v{pkg.version})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Date Range*
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                    }}
                  />
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Employee ID (Optional - leave blank for all employees)
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Employee ID"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleValidate}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--brand-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  disabled={validateRules.isPending}
                >
                  {validateRules.isPending ? 'Validating...' : 'Run Validation'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/*Footer */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid var(--border)',
              background: 'transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
