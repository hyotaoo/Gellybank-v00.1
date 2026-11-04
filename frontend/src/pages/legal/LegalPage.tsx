import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-8 text-[18px] font-bold leading-[1.3] text-ink">{children}</h2>
);

const P = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 text-[14px] leading-[1.55] text-ink">{children}</p>
);

const List = ({ children }: { children: ReactNode }) => (
  <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-[1.55] text-ink">
    {children}
  </ul>
);

const LegalTable = ({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) => (
  <div className="mt-4 overflow-x-auto">
    <table className="w-full border-collapse text-left text-[13px] leading-[1.4]">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} className="border border-surface-line bg-surface-soft px-3 py-2 font-semibold text-ink">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="border border-surface-line px-3 py-2 align-top text-ink">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const LegalPage = ({ title, version, children }: { title: string; version: string; children: ReactNode }) => (
  <main className="min-h-[100dvh] bg-brand-gradient px-4 py-8 font-sans text-ink sm:px-6 sm:py-12">
    <div className="mx-auto w-full max-w-[820px]">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link to="/" className="text-[26px] font-black leading-none text-white">
          Gelly<span className="text-brand-accent">Bank</span>
        </Link>
        <Link
          to="/signup"
          className="rounded-full bg-surface-card px-4 py-2 text-[13px] font-semibold text-ink hover:bg-[#f6c2d5]"
        >
          Back to sign up
        </Link>
      </header>

      <article className="rounded-[36px] bg-surface-card px-6 py-8 sm:px-10 sm:py-10">
        <h1 className="text-[28px] font-bold leading-[1.21] text-ink">{title}</h1>
        <p className="mt-2 text-[12px] font-medium leading-[1.21] text-muted">Version {version}</p>
        {children}
      </article>
    </div>
  </main>
);

export { H2, LegalPage, LegalTable, List, P };
