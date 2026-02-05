import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getApiClient } from '../services/api-client';

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  propertyIds: string[];
  departmentIds: string[];
  status: 'active' | 'inactive';
  lastLoginAt?: string | null;
  createdAt: string;
}

interface CurrentUser {
  userId: string;
  email: string;
  name?: string;
  roles: string[];
  tenantId: string;
}

// Role hierarchy and permissions
const ROLE_HIERARCHY = {
  'Platform Administrator': 5,
  'Property Administrator': 4,
  'HR Manager': 4,
  'Department Manager': 3,
  Employee: 1,
};

const ROLE_DESCRIPTIONS = {
  'Platform Administrator':
    'Full system access - configure settings, integrations, role assignment, audit logs',
  'Property Administrator': 'Property-level configuration and full operations control',
  'HR Manager':
    'Employment lifecycle and compliance workflows (hiring, termination, certifications)',
  'Department Manager': 'Schedule and timecard approvals for assigned departments',
  Employee: 'Self-service access - clock in/out, view schedule, request PTO',
};

const AVAILABLE_ROLES = [
  'Platform Administrator',
  'Property Administrator',
  'HR Manager',
  'Department Manager',
  'Employee',
] as const;

export function UserAdministrationPage() {
  const queryClient = useQueryClient();
  const apiClient = getApiClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['Employee']);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  };

  // Fetch current user to determine permissions
  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      return apiClient.get('/api/me');
    },
  });

  // Fetch all users
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      return apiClient.get('/api/users');
    },
  });

  // Update user roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: string[] }) => {
      return apiClient.put(`/api/users/${userId}/roles`, { roles });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsRoleModalOpen(false);
      setSelectedUser(null);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async ({
      name,
      email,
      roles,
    }: {
      name: string;
      email: string;
      roles: string[];
    }) => {
      return apiClient.post('/api/users', { name, email, roles });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRoles(['Employee']);
      showToast('Invite sent successfully.');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to create user.', 'error');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return apiClient.patch(`/api/users/${userId}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('User status updated.');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update status.', 'error');
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiClient.post(`/api/users/${userId}/invite`, {});
    },
    onSuccess: () => {
      showToast('Invite resent successfully.');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to resend invite.', 'error');
    },
  });

  // Get the highest role level for the current user
  const currentUserMaxLevel = Math.max(
    ...(currentUser?.roles || ['Employee']).map(
      (role) => ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0
    )
  );

  // Determine which roles the current user can grant
  const grantableRoles = AVAILABLE_ROLES.filter((role) => {
    const roleLevel = ROLE_HIERARCHY[role];
    return roleLevel <= currentUserMaxLevel;
  });

  // Filter users based on current user's role
  const filteredUsers = users?.filter((user) => {
    if (!showInactive && user.status !== 'active') {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!user.name.toLowerCase().includes(query) && !user.email.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Role-based filtering
    if (!currentUser) return false;

    const hasRole = (role: string) => currentUser.roles.includes(role);

    // Platform Admin sees everyone
    if (hasRole('Platform Administrator')) return true;

    // Property Admin and HR Manager see property users
    if (hasRole('Property Administrator') || hasRole('HR Manager')) {
      return user.tenantId === currentUser.tenantId;
    }

    // Department Manager sees only employees (those without admin roles)
    if (hasRole('Department Manager')) {
      const isEmployee = user.roles.length === 1 && user.roles.includes('Employee');
      return isEmployee && user.tenantId === currentUser.tenantId;
    }

    return false;
  });

  const handleRoleClick = (user: User) => {
    setSelectedUser(user);
    setIsRoleModalOpen(true);
  };

  const handleCreateUser = () => {
    const trimmedName = newUserName.trim();
    const trimmedEmail = newUserEmail.trim();
    if (!trimmedName || !trimmedEmail) return;

    createUserMutation.mutate({
      name: trimmedName,
      email: trimmedEmail,
      roles: newUserRoles.length > 0 ? newUserRoles : ['Employee'],
    });
  };

  const handleNewUserRoleToggle = (role: string) => {
    setNewUserRoles((current) => {
      const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
      return next.length === 0 ? ['Employee'] : next;
    });
  };

  const handleStatusToggle = (user: User) => {
    if (user.id === currentUser?.userId) return;
    if (user.status === 'active') {
      const confirmed = window.confirm(
        `Deactivate ${user.name}? They will lose access until reactivated.`
      );
      if (!confirmed) return;
    }
    updateStatusMutation.mutate({ userId: user.id, isActive: user.status !== 'active' });
  };

  const handleResendInvite = (user: User) => {
    resendInviteMutation.mutate(user.id);
  };

  const formatLastLogin = (value?: string | null) => {
    if (!value) return 'Never';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(parsed);
  };

  const handleRoleToggle = (role: string) => {
    if (!selectedUser) return;

    const newRoles = selectedUser.roles.includes(role)
      ? selectedUser.roles.filter((r) => r !== role)
      : [...selectedUser.roles, role];

    // Ensure at least Employee role
    const finalRoles = newRoles.length === 0 ? ['Employee'] : newRoles;

    setSelectedUser({ ...selectedUser, roles: finalRoles });
  };

  const handleSaveRoles = () => {
    if (!selectedUser) return;
    updateRolesMutation.mutate({
      userId: selectedUser.id,
      roles: selectedUser.roles,
    });
  };

  const getHighestRole = (roles: string[]) => {
    return roles.reduce((highest, role) => {
      const currentLevel = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0;
      const highestLevel = ROLE_HIERARCHY[highest as keyof typeof ROLE_HIERARCHY] || 0;
      return currentLevel > highestLevel ? role : highest;
    }, 'Employee');
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>User Administration</h1>
        </div>
        <div style={{ padding: '20px' }}>Loading users...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}
      <div className="page-header">
        <h1>User Administration</h1>
        <p className="page-description">
          Manage user roles and permissions. Your role:{' '}
          <strong>{getHighestRole(currentUser?.roles || ['Employee'])}</strong>
        </p>
      </div>

      <div className="page-content">
        {/* Search and filters */}
        <div className="user-admin-controls">
          <div className="user-admin-controls__left">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              aria-label="Add user"
            >
              <span className="icon-button__icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
                  <circle cx="9" cy="7" r="4" />
                  <circle cx="18" cy="17" r="4" />
                  <path d="M18 15v4" />
                  <path d="M16 17h4" />
                </svg>
              </span>
            </button>
            <div className="user-admin-filter">
              <button
                className="icon-button filter-button"
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={isFilterOpen}
                aria-label="Filter users"
              >
                <span className="icon-button__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5h18" />
                    <path d="M6 12h12" />
                    <path d="M10 19h4" />
                  </svg>
                </span>
              </button>
              {isFilterOpen && (
                <div className="filter-panel" role="menu">
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                    />
                    Show inactive accounts
                  </label>
                </div>
              )}
            </div>
          </div>
          <div className="user-count">
            {filteredUsers?.length || 0} user{filteredUsers?.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Users table */}
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers?.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <div className="role-badges">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className={`role-badge role-badge--${role.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{formatLastLogin(user.lastLoginAt)}</td>
                  <td>
                    <span className={`status-badge status-badge--${user.status}`}>
                      {user.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button secondary small"
                      onClick={() => handleRoleClick(user)}
                      disabled={user.id === currentUser?.userId || user.status !== 'active'}
                    >
                      Manage Roles
                    </button>
                    <button
                      className="button secondary small"
                      onClick={() => handleResendInvite(user)}
                      disabled={resendInviteMutation.isPending}
                    >
                      Resend Invite
                    </button>
                    <button
                      className="button secondary small"
                      onClick={() => handleStatusToggle(user)}
                      disabled={user.id === currentUser?.userId || updateStatusMutation.isPending}
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers?.length === 0 && (
            <div className="empty-state">
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>

      {/* Role Management Modal */}
      {isRoleModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => setIsRoleModalOpen(false)}>
          <div className="modal-content role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Roles: {selectedUser.name}</h2>
              <button className="modal-close" onClick={() => setIsRoleModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="help-text">
                Select roles to grant to this user. You can only grant roles up to your permission
                level.
              </p>

              <div className="role-selection">
                {grantableRoles.map((role) => {
                  const isSelected = selectedUser.roles.includes(role);
                  const isDisabled = role === 'Employee' && selectedUser.roles.length === 1;

                  return (
                    <div key={role} className="role-option">
                      <label className={`role-checkbox ${isDisabled ? 'disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRoleToggle(role)}
                          disabled={isDisabled}
                        />
                        <div className="role-info">
                          <strong>{role}</strong>
                          <small>{ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}</small>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="role-note">
                <strong>Note:</strong> Every user must have at least the Employee role.
              </div>
            </div>

            <div className="modal-footer">
              <button className="button secondary" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </button>
              <button
                className="button primary"
                onClick={handleSaveRoles}
                disabled={updateRolesMutation.isPending}
              >
                {updateRolesMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label htmlFor="new-user-name">Full Name</label>
                <input
                  id="new-user-name"
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              <div className="form-field">
                <label htmlFor="new-user-email">Email</label>
                <input
                  id="new-user-email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <p className="help-text">Select roles for this user.</p>
              <div className="role-selection">
                {grantableRoles.map((role) => {
                  const isSelected = newUserRoles.includes(role);
                  const isDisabled = role === 'Employee' && newUserRoles.length === 1;

                  return (
                    <div key={role} className="role-option">
                      <label className={`role-checkbox ${isDisabled ? 'disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleNewUserRoleToggle(role)}
                          disabled={isDisabled}
                        />
                        <div className="role-info">
                          <strong>{role}</strong>
                          <small>{ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}</small>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="role-note">
                <strong>Note:</strong> Every user must have at least the Employee role.
              </div>
            </div>

            <div className="modal-footer">
              <button className="button secondary" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </button>
              <button
                className="button primary"
                onClick={handleCreateUser}
                disabled={
                  createUserMutation.isPending || !newUserName.trim() || !newUserEmail.trim()
                }
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
