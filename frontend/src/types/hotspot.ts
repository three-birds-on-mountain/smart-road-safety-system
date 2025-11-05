import type { AccidentRecord, AccidentSeverity } from './accident';

export interface HotspotSummary {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  highestSeverity: AccidentSeverity;
  accidentCount: number;
  updatedAt: string;
  ignored?: boolean;
}

export interface NearbyHotspot extends HotspotSummary {
  distanceMeters: number;
}

export interface HotspotDetail extends HotspotSummary {
  accidents: AccidentRecord[];
}
