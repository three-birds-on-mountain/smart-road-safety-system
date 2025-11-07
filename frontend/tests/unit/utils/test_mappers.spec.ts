import { describe, expect, it } from 'vitest';
import { mapSeverityLevelsToApi, mapTimeRangeToApi } from '../../../src/utils/mappers';

describe('format mappers', () => {
  it('converts time range to API format', () => {
    expect(mapTimeRangeToApi('1Y')).toBe('1_year');
    expect(mapTimeRangeToApi('3M')).toBe('3_months');
    expect(mapTimeRangeToApi(undefined)).toBeUndefined();
  });

  it('normalizes severity combinations', () => {
    expect(mapSeverityLevelsToApi(['A1', 'A2'])).toBe('A1,A2');
    expect(mapSeverityLevelsToApi(['A1', 'A1', 'A2'])).toBe('A1,A2');
    expect(mapSeverityLevelsToApi(['A1', 'A2', 'A3'])).toBeUndefined();
    expect(mapSeverityLevelsToApi([])).toBeUndefined();
  });
});
