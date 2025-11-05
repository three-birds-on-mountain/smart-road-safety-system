export type AccidentSeverity = 'A1' | 'A2' | 'A3';

export interface AccidentRecord {
  id: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  severity: AccidentSeverity;
  address?: string;
  description?: string;
}

export interface AccidentStatisticsBySeverity {
  severity: AccidentSeverity;
  count: number;
}
