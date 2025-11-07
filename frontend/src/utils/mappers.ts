import type { AccidentSeverity } from '../types/accident';
import type { TimeRangeOption } from '../types/settings';

const TIME_RANGE_MAP: Record<TimeRangeOption, string> = {
  '1Y': '1_year',
  '6M': '6_months',
  '3M': '3_months',
  '1M': '1_month',
};

export const mapTimeRangeToApi = (
  timeRange?: TimeRangeOption,
): '1_year' | '6_months' | '3_months' | '1_month' | undefined => {
  if (!timeRange) {
    return undefined;
  }
  return TIME_RANGE_MAP[timeRange];
};

export const mapSeverityLevelsToApi = (levels: AccidentSeverity[]): string | undefined => {
  if (!levels.length) {
    return undefined;
  }

  const uniqueLevels = Array.from(new Set(levels));
  if (uniqueLevels.length === 3) {
    return undefined;
  }

  return uniqueLevels.join(',');
};
