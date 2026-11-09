import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ApiError } from '@/api/client';
import { getAdminSettings, updateAdminSettings } from '@/api/admin';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import Textarea from '@/components/common/Textarea';

const MAX_LOGO_BYTES = 1_048_576;

const readLogoFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read the image file.'));
    reader.readAsDataURL(file);
  });

const AdminSettingsPage = () => {
  const [form, setForm] = useState({
    bankName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
  });
  const [logo, setLogo] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingMaintenance, setConfirmingMaintenance] = useState(false);
  const [error, setError] = useState<string>();
  const [savedMessage, setSavedMessage] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    getAdminSettings()
      .then((data) => {
        if (cancelled) return;
        setForm({
          bankName: data.bankName,
          contactEmail: data.contactEmail ?? '',
          contactPhone: data.contactPhone ?? '',
          address: data.address ?? '',
        });
        setLogo(data.logo);
        setMaintenanceMode(data.maintenanceMode);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load settings.'),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (patch: Record<string, unknown>, message: string) => {
    setSaving(true);
    setError(undefined);
    setSavedMessage(undefined);
    try {
      const data = await updateAdminSettings(patch);
      setForm({
        bankName: data.bankName,
        contactEmail: data.contactEmail ?? '',
        contactPhone: data.contactPhone ?? '',
        address: data.address ?? '',
      });
      setLogo(data.logo);
      setMaintenanceMode(data.maintenanceMode);
      setSavedMessage(message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    void persist({ ...form }, 'Settings saved.');
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must be an image up to 1 MB.');
      return;
    }
    const dataUrl = await readLogoFile(file).catch(() => undefined);
    if (!dataUrl) {
      setError('Unable to read the image file.');
      return;
    }
    await persist({ logo: dataUrl }, 'Logo updated.');
  };

  const handleMaintenanceToggle = () => {
    if (!maintenanceMode) {
      setConfirmingMaintenance(true);
      return;
    }
    void persist({ maintenanceMode: false }, 'Maintenance mode is off.');
  };

  const confirmMaintenance = () => {
    setConfirmingMaintenance(false);
    void persist({ maintenanceMode: true }, 'Maintenance mode is on.');
  };

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted">
        Loading settings…
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">System settings</h1>
      </header>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {savedMessage && <p role="status" className="text-sm text-green-700">{savedMessage}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-surface-line bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">Bank information</h2>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <Field label="Bank name">
              <Input
                value={form.bankName}
                onChange={(event) => setForm({ ...form, bankName: event.target.value })}
                maxLength={80}
                required
              />
            </Field>
            <Field label="Contact email">
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
              />
            </Field>
            <Field label="Contact phone">
              <Input
                value={form.contactPhone}
                onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                maxLength={20}
              />
            </Field>
            <Field label="Address">
              <Textarea
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                maxLength={255}
                rows={2}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-surface-line bg-white p-6">
            <h2 className="text-lg font-semibold text-ink">Bank logo</h2>
            <div className="mt-4 flex items-center gap-4">
              {logo ? (
                <img
                  src={logo}
                  alt="Bank logo"
                  className="h-16 w-16 rounded-xl border border-surface-line object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-surface-line text-xs text-muted">
                  No logo
                </span>
              )}
              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-[20px] bg-surface-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-primary-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-hover">
                  Upload logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void handleLogoUpload(event)}
                  />
                </label>
                {logo && (
                  <button
                    type="button"
                    onClick={() => void persist({ logo: null }, 'Logo removed.')}
                    disabled={saving}
                    className="text-left text-sm text-red-700 hover:underline disabled:opacity-60"
                  >
                    Remove logo
                  </button>
                )}
                <p className="text-xs text-muted">PNG, JPG, or WebP up to 1 MB.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-surface-line bg-white p-6">
            <h2 className="text-lg font-semibold text-ink">Maintenance mode</h2>
            <p className="mt-2 text-sm text-muted">
              While enabled, customer and teller APIs answer with a maintenance message. Admin and
              sign-in stay available.
            </p>
            {confirmingMaintenance ? (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
                <p className="font-medium text-ink">
                  Turn on maintenance mode and block all customer and teller activity?
                </p>
                <div className="mt-3 flex gap-3">
                  <Button
                    variant="primary"
                    onClick={confirmMaintenance}
                    disabled={saving}
                  >
                    Yes, turn it on
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingMaintenance(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="text-sm text-muted">
                  Status: {maintenanceMode ? 'On' : 'Off'}
                </span>
                <Button variant="secondary" onClick={handleMaintenanceToggle} disabled={saving}>
                  {maintenanceMode ? 'Turn off' : 'Turn on'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminSettingsPage;
