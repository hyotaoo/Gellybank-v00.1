import { apiDownload, apiRequest } from '@/api/client';

export interface TellerReportParams {
  from?: string;
  to?: string;
}

export interface TellerReportSummary {
  deposits: { count: number; total: number };
  withdrawals: { count: number; total: number };
  other: { count: number; total: number };
}

export interface TellerDailyReport {
  date: string;
  deposits: number;
  depositsTotal: number;
  withdrawals: number;
  withdrawalsTotal: number;
  net: number;
}

export interface TellerReports {
  range: TellerReportSummary;
  today: TellerReportSummary;
  daily: TellerDailyReport[];
  requests: { approved: number; rejected: number; total: number };
}

const rangeQuery = (params: TellerReportParams): string => {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
};

export const getTellerReports = (
  params: TellerReportParams = {},
  signal?: AbortSignal,
): Promise<TellerReports> =>
  apiRequest<TellerReports>(`/teller/reports${rangeQuery(params)}`, { signal });

export const exportTellerReports = (params: TellerReportParams = {}): Promise<Blob> =>
  apiDownload(`/teller/reports/export${rangeQuery(params)}`);
