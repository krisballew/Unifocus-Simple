import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';

import { getApiClient, type Property } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

interface UserPreferences {
  locale: string;
  timezone: string;
  currency: string;
  avatarUrl: string | null;
  defaultPropertyId: string | null;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    userId: string;
    email: string;
    name?: string;
  };
}

// Supported languages with ISO 639-1 codes
const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'es-ES', name: 'Español (ES)' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'pt-BR', name: 'Português (BR)' },
  { code: 'zh-CN', name: '中文 (简体)' },
  { code: 'ja-JP', name: '日本語' },
];

// Common currencies with ISO 4217 codes
const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
];

export function UserProfileModal({ isOpen, onClose, currentUser }: UserProfileModalProps) {
  const queryClient = useQueryClient();
  const apiClient = getApiClient();

  const [locale, setLocale] = useState('en-US');
  const [currency, setCurrency] = useState('USD');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [defaultPropertyId, setDefaultPropertyId] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Fetch current preferences
  const preferencesQuery = useQuery({
    queryKey: ['userPreferences', currentUser.userId] as const,
    queryFn: async () => {
      const response = await apiClient.get<UserPreferences>('/api/users/me/preferences');
      return response;
    },
    enabled: isOpen,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fetch available properties for the user
  const propertiesQuery = useQuery({
    queryKey: queryKeys.properties(undefined),
    queryFn: async () => {
      const response = await apiClient.get<Property[]>('/api/properties');
      return response;
    },
    enabled: isOpen,
  });

  // Initialize form values when preferences are loaded
  useEffect(() => {
    if (preferencesQuery.data) {
      setLocale(preferencesQuery.data.locale || 'en-US');
      setCurrency(preferencesQuery.data.currency || 'USD');
      setAvatarUrl(preferencesQuery.data.avatarUrl || '');
      setDefaultPropertyId(preferencesQuery.data.defaultPropertyId || '');
    }
  }, [preferencesQuery.data]);

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      console.log('[Mutation] Sending data:', data);
      const result = await apiClient.put('/api/users/me/preferences', data);
      console.log('[Mutation] Received response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[Mutation] onSuccess called with:', data);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
    onError: (error) => {
      console.error('[Mutation] onError called with:', error);
    },
    onSettled: () => {
      console.log('[Mutation] onSettled called');
    },
  });

  const handleSave = async () => {
    setUploadError('');

    try {
      console.log('Starting preferences update...');
      // Update preferences
      const result = await updatePreferencesMutation.mutateAsync({
        locale,
        currency,
        avatarUrl: avatarUrl || null,
        defaultPropertyId: defaultPropertyId || null,
      });
      console.log('Preferences updated successfully:', result);

      console.log('Closing modal...');
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
      setUploadError('Failed to save changes. Please try again.');
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setUploadError('');

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    const maxFileSizeBytes = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxFileSizeBytes) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    // Read and compress the image
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions (max 400x400, maintain aspect ratio)
        const maxDimension = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to data URL with compression (0.85 quality for JPEG)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        // Check final size (base64 is about 33% larger than binary)
        const sizeInBytes = Math.round((compressedDataUrl.length * 3) / 4);
        if (sizeInBytes > maxFileSizeBytes) {
          setUploadError('Image is still too large after compression. Please use a smaller image.');
          return;
        }

        setAvatarUrl(compressedDataUrl);
        console.log(
          `Avatar uploaded and compressed: ${Math.round(width)}x${Math.round(height)}, ~${Math.round(sizeInBytes / 1024)}KB`
        );
      };

      img.onerror = () => {
        setUploadError('Failed to load image. Please try another file.');
      };

      img.src = reader.result as string;
    };

    reader.onerror = () => {
      setUploadError('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>User Profile</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {preferencesQuery.isLoading ? (
            <div className="loading">Loading preferences...</div>
          ) : (
            <div className="profile-form">
              {/* User Info Section */}
              <div className="form-section">
                <h3>Account Information</h3>
                <div className="form-field">
                  <label>Email</label>
                  <input type="text" value={currentUser.email} disabled />
                </div>
                <div className="form-field">
                  <label>Name</label>
                  <input type="text" value={currentUser.name || ''} disabled />
                </div>
              </div>

              {/* Avatar Section */}
              <div className="form-section">
                <h3>Avatar</h3>
                <div className="avatar-upload">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="avatar-preview" />
                  ) : (
                    <div className="avatar-placeholder">No Image</div>
                  )}
                  <div className="avatar-controls">
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="avatar-upload" className="button secondary">
                      {avatarUrl ? 'Change Image' : 'Upload Image'}
                    </label>
                    {avatarUrl && (
                      <button className="button secondary" onClick={() => setAvatarUrl('')}>
                        Remove
                      </button>
                    )}
                  </div>
                  <small>Max 5MB. Image will be resized to 400x400px and compressed.</small>
                  {uploadError && <div className="error-message">{uploadError}</div>}
                </div>
              </div>

              {/* Language Preference */}
              <div className="form-section">
                <h3>Language Preference</h3>
                <div className="form-field">
                  <label htmlFor="locale">Language</label>
                  <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <small>ISO 639-1 language code</small>
                </div>
              </div>

              {/* Currency Preference */}
              <div className="form-section">
                <h3>Currency Preference</h3>
                <div className="form-field">
                  <label htmlFor="currency">Currency</label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {SUPPORTED_CURRENCIES.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.name} ({curr.symbol})
                      </option>
                    ))}
                  </select>
                  <small>ISO 4217 currency code</small>
                </div>
              </div>

              {/* Default Property */}
              {propertiesQuery.data && propertiesQuery.data.length > 1 && (
                <div className="form-section">
                  <h3>Home Property</h3>
                  <div className="form-field">
                    <label htmlFor="defaultProperty">Default Property</label>
                    <select
                      id="defaultProperty"
                      value={defaultPropertyId}
                      onChange={(e) => setDefaultPropertyId(e.target.value)}
                    >
                      <option value="">No default</option>
                      {propertiesQuery.data.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                    <small>Your default property when logging in</small>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={handleSave}
            disabled={updatePreferencesMutation.isPending}
          >
            {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
