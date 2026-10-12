export interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
  min: number;
  max: number;
  example: string;
}

export const COUNTRIES: Country[] = [
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭', min: 9, max: 11, example: '9171234567' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸', min: 10, max: 10, example: '2025550123' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', min: 10, max: 10, example: '4165550123' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧', min: 9, max: 10, example: '7400123456' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺', min: 9, max: 9, example: '412345678' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿', min: 8, max: 10, example: '211234567' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', min: 8, max: 8, example: '81234567' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾', min: 9, max: 10, example: '123456789' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩', min: 9, max: 12, example: '81234567890' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭', min: 9, max: 9, example: '812345678' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳', min: 9, max: 10, example: '912345678' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', min: 10, max: 10, example: '9876543210' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', min: 9, max: 10, example: '9012345678' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷', min: 9, max: 10, example: '1012345678' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳', min: 11, max: 11, example: '13123456789' },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: '🇭🇰', min: 8, max: 8, example: '51234567' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪', min: 9, max: 9, example: '501234567' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦', min: 9, max: 9, example: '501234567' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪', min: 10, max: 11, example: '15123456789' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', min: 9, max: 9, example: '612345678' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸', min: 9, max: 9, example: '612345678' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹', min: 9, max: 10, example: '3123456789' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱', min: 9, max: 9, example: '612345678' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷', min: 10, max: 11, example: '11912345678' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽', min: 10, max: 10, example: '5512345678' },
];

export const DEFAULT_COUNTRY_CODE = 'PH';

export const findCountry = (code: string): Country =>
  COUNTRIES.find((country) => country.code === code) ??
  COUNTRIES.find((country) => country.code === DEFAULT_COUNTRY_CODE)!;

export const validatePhone = (country: Country, national: string): string | undefined => {
  const digits = national.replace(/[\s-]/g, '');
  if (!digits) return 'Phone number is required.';
  if (!/^\d+$/.test(digits)) return 'Phone number must contain digits only.';
  if (digits.length < country.min || digits.length > country.max) {
    return `Enter a valid ${country.name} number (${country.min}–${country.max} digits).`;
  }
  return undefined;
};
