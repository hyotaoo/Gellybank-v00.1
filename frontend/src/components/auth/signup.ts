import { confirmMatch, email, makeBirthdate, password, required } from '@/utils/validation';
import { findCountry, validatePhone } from '@/utils/countries';

export interface SignupValues {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthdate: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mailingSame: string;
  email: string;
  phone: string;
  countryCode: string;
  citizenship: string;
  employmentStatus: string;
  occupation: string;
  employer: string;
  annualIncome: string;
  sourceOfFunds: string;
  accountType: string;
  ownershipType: string;
  purposeOfAccount: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeInsights: boolean;
}

export type SignupFieldKey = keyof SignupValues;
export type SignupErrors = Partial<Record<SignupFieldKey, string>>;
export type SignupStep = 1 | 2 | 3;

export interface SignupStepProps {
  values: SignupValues;
  errors: SignupErrors;
  update: <K extends SignupFieldKey>(field: K, value: SignupValues[K]) => void;
}

export const emptySignupValues = (): SignupValues => ({
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  birthdate: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  mailingSame: 'Yes',
  email: '',
  phone: '',
  countryCode: 'US',
  citizenship: 'US Citizen',
  employmentStatus: '',
  occupation: '',
  employer: '',
  annualIncome: '',
  sourceOfFunds: '',
  accountType: '',
  ownershipType: 'Individual',
  purposeOfAccount: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false,
  agreePrivacy: false,
  agreeInsights: false,
});

export const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'];
export const CITIZENSHIP_STATUSES = ['US Citizen', 'Permanent Resident', 'Non-Resident', 'Filipino'];
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
];
export const EMPLOYMENT_STATUSES = ['Full-Time', 'Part-Time', 'Self-Employed', 'Unemployed', 'Retired', 'Student'];
export const INCOME_RANGES = [
  'Under $25,000',
  '$25,000 - $50,000',
  '$50,000 - $75,000',
  '$75,000 - $100,000',
  'Over $100,000',
];
export const SOURCE_OF_FUNDS = [
  'Employment Income',
  'Business Income',
  'Savings',
  'Investments',
  'Family Support',
  'Pension',
  'Other',
];
export const ACCOUNT_TYPES = ['Savings', 'Checking'];
export const OWNERSHIP_TYPES = ['Individual', 'Joint'];
export const ACCOUNT_PURPOSES = [
  'Everyday Purchases',
  'Savings',
  'Bills & Utilities',
  'Business',
  'Education',
  'Travel',
  'Other',
];

const EMPLOYED_STATUSES = ['Full-Time', 'Part-Time', 'Self-Employed'];

export const validateStep = (step: SignupStep, values: SignupValues): SignupErrors => {
  const errors: SignupErrors = {};
  const check = (field: SignupFieldKey, message: string | undefined) => {
    if (message) errors[field] = message;
  };

  if (step === 1) {
    check('firstName', required('First name')(values.firstName));
    check('lastName', required('Last name')(values.lastName));
    check('birthdate', makeBirthdate()(values.birthdate));
    check('address', required('Address')(values.address));
    check('city', required('City')(values.city));
    check('state', required('State / Province / Region')(values.state));
    check('zip', required('ZIP / Postal code')(values.zip));
    check('mailingSame', required('Mailing address answer')(values.mailingSame));
    check('email', email(values.email));
    check('phone', validatePhone(findCountry(values.countryCode), values.phone));
    check('citizenship', required('Citizenship status')(values.citizenship));
  }

  if (step === 2) {
    check('employmentStatus', required('Employment status')(values.employmentStatus));
    check('occupation', required('Occupation / Job title')(values.occupation));
    if (EMPLOYED_STATUSES.includes(values.employmentStatus)) {
      check('employer', required('Employer name')(values.employer));
    }
    check('annualIncome', required('Annual gross income')(values.annualIncome));
    check('sourceOfFunds', required('Primary source of funds')(values.sourceOfFunds));
    check('accountType', required('Account type')(values.accountType));
    check('ownershipType', required('Account ownership type')(values.ownershipType));
    check('purposeOfAccount', required('Primary purpose of account')(values.purposeOfAccount));
    check('password', password(values.password));
    check('confirmPassword', confirmMatch(values.password)(values.confirmPassword));
  }

  if (step === 3) {
    if (!values.agreeTerms) errors.agreeTerms = 'You must accept the Terms of Agreement.';
    if (!values.agreePrivacy) errors.agreePrivacy = 'You must accept the Data Privacy Notice.';
  }

  return errors;
};