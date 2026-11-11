import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { getPublicSettings } from '@/api/settings';
import type { PublicBankSettings } from '@/api/settings';
import usePolling from '@/hooks/usePolling';

const DEFAULT_SETTINGS: PublicBankSettings = {
  bankName: 'GellyBank!',
  contactEmail: null,
  contactPhone: null,
  address: null,
  logo: null,
  maintenanceMode: false,
};

interface BankSettingsValue {
  settings: PublicBankSettings;
  loaded: boolean;
}

const BankSettingsContext = createContext<BankSettingsValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
});

export const BankSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<PublicBankSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const loadSettings = () => {
    getPublicSettings()
      .then((data) => setSettings(data))
      .catch(() => {
        // Keep defaults; branding falls back to GellyBank!
      })
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  usePolling(loadSettings, 30000);

  return (
    <BankSettingsContext.Provider value={{ settings, loaded }}>
      {children}
    </BankSettingsContext.Provider>
  );
};

export const useBankSettings = (): BankSettingsValue => useContext(BankSettingsContext);

/**
 * Renders the bank name in the two-tone brand style: text before "bank" in
 * ink, the remainder (e.g. "Bank!") in primary. Names without "bank" render
 * as plain ink text.
 */
export const BrandName = ({
  className,
  tailClassName = 'text-primary',
}: {
  className?: string;
  tailClassName?: string;
}) => {
  const { settings } = useBankSettings();
  const { logo } = settings;

  const lower = settings.bankName.toLowerCase();
  const splitAt = lower.indexOf('bank');
  const head = splitAt > 0 ? settings.bankName.slice(0, splitAt) : settings.bankName;
  const tail = splitAt > 0 ? settings.bankName.slice(splitAt) : '';

  return (
    <span className={className}>
      {logo && (
        <img src={logo} alt="" className="mr-2 inline-block h-[1em] w-auto align-baseline" />
      )}
      {head}
      {tail && <span className={tailClassName}>{tail}</span>}
    </span>
  );
};

export type { PublicBankSettings };
