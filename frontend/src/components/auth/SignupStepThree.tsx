import type { ReactNode } from 'react';
import legalText from '@/assets/legal-terms.txt?raw';
import type { SignupStepProps } from '@/components/auth/signup';

const CheckMark = () => (
  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="m3 8.5 3.2 3L13 4.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface ConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

const Consent = ({ checked, onChange, children }: ConsentProps) => (
  <label className="flex cursor-pointer gap-3">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="peer sr-only"
    />
    <span
      aria-hidden="true"
      className={`mt-0 flex h-6 w-6 flex-none items-center justify-center rounded-[8px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 ${
        checked
          ? 'border-primary bg-primary text-white'
          : 'border-[#F2ECE7] bg-white/[0.16] text-transparent'
      }`}
    >
      <CheckMark />
    </span>
    <span className="text-[16px] font-normal leading-[24px] text-ink">{children}</span>
  </label>
);

// Figma 2196:733 — legal viewport 523x270, three consents, version rule
const SignupStepThree = ({ values, errors, update }: SignupStepProps) => (
  <div className="flex flex-col gap-4">
    <p className="text-[16px] font-semibold leading-[19px] text-ink">Review the agreement</p>

    <div className="h-[270px] overflow-y-auto rounded-[24px] border border-[#F2ECE7] bg-white/[0.16] p-6 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.12] [&::-webkit-scrollbar]:w-1.5">
      <p className="whitespace-pre-line text-[14px] font-normal leading-[21px] text-ink">{legalText}</p>
    </div>

    <div className="flex flex-col gap-3">
      <Consent
        checked={values.agreeTerms}
        onChange={(checked) => update('agreeTerms', checked)}
      >
        Required. I am at least 18 years old. I have read and agree to the Gelly Bank Terms of
        Agreement (Part A).
      </Consent>

      <Consent
        checked={values.agreePrivacy}
        onChange={(checked) => update('agreePrivacy', checked)}
      >
        Required. I have read the Data Privacy Notice (Part B). I consent to Gelly Bank collecting
        and processing my personal data, including my government-issued ID information, to open and
        run my account, verify my identity and meet legal requirements.
      </Consent>

      <Consent
        checked={values.agreeInsights}
        onChange={(checked) => update('agreeInsights', checked)}
      >
        Optional. I agree to Gelly Bank analysing my transaction records within its own systems to
        show me AI Insights. I can withdraw this at any time. Declining does not affect my banking
        services.
      </Consent>
    </div>

    <p className="text-[13px] font-normal leading-[16px] text-[#6E6168]">
      {'Version v1.0 \u00b7 2026-11-03'}
    </p>

    {(errors.agreeTerms || errors.agreePrivacy) && (
      <p className="text-[11px] leading-[13px] text-red-600">
        {errors.agreeTerms ?? errors.agreePrivacy}
      </p>
    )}
  </div>
);

export default SignupStepThree;