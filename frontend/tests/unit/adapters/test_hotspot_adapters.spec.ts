import { describe, expect, it } from 'vitest';
import {
  adaptHotspotDetail,
  adaptHotspotSummary,
  adaptNearbyHotspot,
} from '../../../src/store/hotspotsSlice';

describe('hotspot adapters', () => {
  const basePayload = {
    id: 'hotspot-1',
    center_latitude: 25.04,
    center_longitude: 121.56,
    radius_meters: 200,
    total_accidents: 10,
    a1_count: 2,
    a2_count: 4,
    a3_count: 4,
    earliest_accident_at: '2024-01-01T00:00:00Z',
    latest_accident_at: '2024-02-01T00:00:00Z',
    severity_score: 9,
    distance_from_user_meters: 150,
  };

  it('adapts nearby hotspots with distance', () => {
    const result = adaptNearbyHotspot(basePayload);
    expect(result.centerLatitude).toBe(25.04);
    expect(result.distanceFromUserMeters).toBe(150);
  });

  it('adapts summaries without distance', () => {
    const result = adaptHotspotSummary(basePayload);
    expect(result.centerLatitude).toBe(25.04);
    expect((result as unknown as { distanceFromUserMeters?: number }).distanceFromUserMeters).toBeUndefined();
  });

  it('adapts hotspot detail accidents', () => {
    const detail = adaptHotspotDetail({
      ...basePayload,
      accidents: [
        {
          id: 'acc-1',
          latitude: 25.04,
          longitude: 121.56,
          occurred_at: '2024-02-01T08:00:00Z',
          severity: 'A2',
          address: '台北市信義區',
          distance_meters: 45,
          involved_people: ['騎士'],
          involved_vehicles: ['機車'],
          description: 'test',
        },
      ],
    });

    expect(detail.accidents?.[0]).toMatchObject({
      id: 'acc-1',
      occurredAt: '2024-02-01T08:00:00Z',
      distanceMeters: 45,
    });
  });
});
