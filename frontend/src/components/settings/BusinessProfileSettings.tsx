import { useEffect, useState } from 'react';
import api from '../../services/api';
import { UpdateBusinessProfilePayload, BusinessProfile } from '../../services/whatsapp';

interface BusinessProfileForm {
  city: string;
  state: string;
  country: string;
  pinCode: string;
  desc: string;
  vertical: string;
  website1: string;
  website2: string;
  profileEmail: string;
}

export default function BusinessProfileSettings() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<BusinessProfileForm>({
    city: '',
    state: '',
    country: '',
    pinCode: '',
    desc: '',
    vertical: '',
    website1: '',
    website2: '',
    profileEmail: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    void loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ status: string; profile: BusinessProfile }>('/whatsapp/business/profile');
      setProfile(response.data.profile);
      // Populate form from profile
      setForm({
        city: response.data.profile.city || '',
        state: response.data.profile.state || '',
        country: response.data.profile.country || '',
        pinCode: response.data.profile.pinCode || '',
        desc: response.data.profile.desc || '',
        vertical: response.data.profile.vertical || '',
        website1: response.data.profile.website1 || '',
        website2: response.data.profile.website2 || '',
        profileEmail: response.data.profile.profileEmail || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load business profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFormErrors({});

    // Validate required fields
    if (!form.vertical?.trim()) {
      setFormErrors({ vertical: 'Vertical is required' });
      setSaving(false);
      return;
    }

    // Validate website URLs
    const urlPattern = /^https?:\/\/.+/;
    if (form.website1 && !urlPattern.test(form.website1)) {
      setFormErrors({ website1: 'Website 1 must be a valid URL' });
      setSaving(false);
      return;
    }
    if (form.website2 && !urlPattern.test(form.website2)) {
      setFormErrors({ website2: 'Website 2 must be a valid URL' });
      setSaving(false);
      return;
    }

    try {
      const response = await api.post<{ success: boolean; profile: BusinessProfile; error?: string }>(
        '/whatsapp/business/profile/update',
        form as UpdateBusinessProfilePayload
      );

      if (response.data.success && profile) {
        setProfile(response.data.profile);
        // Refresh form with updated data
        setForm({
          city: response.data.profile.city || '',
          state: response.data.profile.state || '',
          country: response.data.profile.country || '',
          pinCode: response.data.profile.pinCode || '',
          desc: response.data.profile.desc || '',
          vertical: response.data.profile.vertical || '',
          website1: response.data.profile.website1 || '',
          website2: response.data.profile.website2 || '',
          profileEmail: response.data.profile.profileEmail || '',
        });
        setError('');
      } else {
        setError(response.data.error || 'Failed to update business profile');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update business profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading business profile...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 dark:text-red-400">
      <p>{error}</p>
    </div>;
  }

  return (
    <div className="p-6 border rounded-lg mb-6 dark:border-gray-600">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
        <svg className="mr-2 h-5 w-5 text-primary-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v5h5v2h3l5-5-5-5h-2v2h-5v5H12V3h-2zM2 12h3v2H2v-2zm10-6h-2v2h2V6zm-6 6h2v2H6v-2zm6.836-2.57l-1.678-1.678a6 6 0 0 0-8.486 0L3 13.5l1.678 1.678a6 6 0 0 0 0 8.486l1.678-1.678A9.85 9.85 0 0 1 12 23a9.85 9.85 0 0 1-6.837-2.423l-1.678 1.678a4.997 4.997 0 0 0 0 7.07l1.678 1.678a4.997 4.997 0 0 0 7.07 0l1.678-1.678c.762-.762.762-2.002.03-2.763L18.837 15.337a6.978 6.978 0 0 0-1.017-3.071zM12 5.323a5.677 5.677 0 0 1 6.197 1.876l1.678-1.678a5.671 5.671 0 0 1-1.876 6.197l-1.678 1.678A5.662 5.662 0 0 1 12 5.323zM5.837 15.337l-1.678 1.678a4.995 4.995 0 0 0 0 7.07l1.678 1.678a4.995 4.995 0 0 0 7.07 0l1.678-1.678A9.86 9.86 0 0 1 12 23c.001-5.45-4.437-9.884-9.888-9.884a9.866 9.866 0 0 1 6.838-2.423l1.678-1.678a4.997 4.997 0 0 0 0-7.07l-1.678-1.678a4.997 4.997 0 0 0-7.07 0z"/>
        </svg>
        Business Profile
      </h2>

      {loading && <p className="text-gray-500 dark:text-gray-400">Loading profile...</p>}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && !saving && profile ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong>Business Name:</strong> {profile.name || 'Not set'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong>Email:</strong> {profile.profileEmail || 'Not set'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong>Vertical:</strong> {profile.vertical || 'Not set'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong>Address:</strong> {profile.addressLine1 || ''} {profile.city || ''}, {profile.state || ''} {profile.country || ''} {profile.pinCode || ''}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong>Website:</strong> {profile.website1 || 'Not set'}
          </p>
        </div>
      ) : (
        <form>
          {/* Form section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="City"
                required
              />
              {formErrors.city && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                State
              </label>
              <input
                type="text"
                value={form.state}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, state: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="State"
                required
              />
              {formErrors.state && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.state}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Country
              </label>
              <input
                type="text"
                value={form.country}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, country: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="Country"
                required
              />
              {formErrors.country && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.country}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pin Code
              </label>
              <input
                type="text"
                value={form.pinCode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, pinCode: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="Pincode"
              />
              {formErrors.pinCode && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.pinCode}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={form.desc}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, desc: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-24 resize-y"
                placeholder="Business description"
                rows={3}
              />
              {formErrors.desc && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.desc}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vertical {formErrors.vertical && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.vertical}</p>
              )}
              </label>
              <select
                value={form.vertical}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, vertical: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="">Select vertical</option>
                <option value="AUTOMATION">AUTOMATION</option>
                <option value="COMMUNICATION">COMMUNICATION</option>
                <option value="MARKETING">MARKETING</option>
                <option value="NOTIFICATION">NOTIFICATION</option>
                <option value="ACCOUNT_OPENING">ACCOUNT_OPENING</option>
                <option value="ORDER_CONFIRMATION">ORDER_CONFIRMATION</option>
                <option value="DELIVERY_UPDATE">DELIVERY_UPDATE</option>
                <option value="PAYMENT_FAILURE">PAYMENT_FAILURE</option>
                <option value="REMINDER">REMINDER</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website 1
              </label>
              <input
                type="text"
                value={form.website1}
                onChange={(e =>
                  setForm((prev) => ({ ...prev, website1: e.target.value }))
                )}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="https://example.com"
              />
              {formErrors.website1 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.website1}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website 2
              </label>
              <input
                type="text"
                value={form.website2}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, website2: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="https://example2.com"
              />
              {formErrors.website2 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.website2}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Profile Email
              </label>
              <input
                type="email"
                value={form.profileEmail}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, profileEmail: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="business@example.com"
              />
              {formErrors.profileEmail && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.profileEmail}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <button
              type="button"
              onClick={loadProfile}
              className="py-2 px-4 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-800 disabled:opacity-50 font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </form>
      )}
    </div>
  );
}