import type { NearbyHotspot } from '../types/hotspot';
import type { AlertSettings } from '../types/settings';
import type { Coordinates } from '../store/locationSlice';
import { getHighestSeverityLevel } from '../types/hotspot';

export interface AlertServiceOptions {
  audioSrc?: string;
  minIntervalMs?: number;
}

export interface TriggerAlertInput {
  hotspot: NearbyHotspot;
  userLocation: Coordinates;
  settings: AlertSettings;
}

export interface TriggerAlertResult {
  triggered: boolean;
  distanceMeters: number;
  reason?:
    | 'ignored'
    | 'out-of-range'
    | 'severity-filtered'
    | 'cooldown'
    | 'unsupported'
    | 'channels-disabled';
}

const EARTH_RADIUS_METERS = 6_371_000;
const MIN_ALERT_INTERVAL_MS = 30_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const calculateDistanceMeters = (from: Coordinates, to: NearbyHotspot): number => {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.centerLatitude);
  const deltaLat = toRadians(to.centerLatitude - from.latitude);
  const deltaLon = toRadians(to.centerLongitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export class AlertService {
  private readonly audio?: HTMLAudioElement;
  private readonly minIntervalMs: number;
  private lastTriggeredMap = new Map<string, number>();
  private stopAudioTimeout?: number;

  constructor(options?: AlertServiceOptions) {
    this.minIntervalMs = Math.max(options?.minIntervalMs ?? MIN_ALERT_INTERVAL_MS, MIN_ALERT_INTERVAL_MS);

    if (typeof window !== 'undefined' && options?.audioSrc) {
      this.audio = new Audio(options.audioSrc);
      this.audio.loop = true;
    }
  }

  triggerAlert({ hotspot, userLocation, settings }: TriggerAlertInput): TriggerAlertResult {
    const distanceMeters =
      'distanceFromUserMeters' in hotspot && typeof hotspot.distanceFromUserMeters === 'number'
        ? hotspot.distanceFromUserMeters
        : calculateDistanceMeters(userLocation, hotspot);

    if (settings.ignoredHotspotIds.includes(hotspot.id)) {
      return { triggered: false, distanceMeters, reason: 'ignored' };
    }

    const highestSeverity = getHighestSeverityLevel(hotspot);
    if (!settings.severityFilter.includes(highestSeverity)) {
      return { triggered: false, distanceMeters, reason: 'severity-filtered' };
    }

    if (distanceMeters > settings.distanceMeters) {
      return { triggered: false, distanceMeters, reason: 'out-of-range' };
    }

    const lastTriggeredAt = this.lastTriggeredMap.get(hotspot.id);
    const now = Date.now();

    if (lastTriggeredAt && now - lastTriggeredAt < this.minIntervalMs) {
      return { triggered: false, distanceMeters, reason: 'cooldown' };
    }

    this.lastTriggeredMap.set(hotspot.id, now);

    if (settings.alertChannels.length === 0) {
      return { triggered: true, distanceMeters, reason: 'channels-disabled' };
    }

    if (settings.alertChannels.includes('sound')) {
      this.playSound(settings.autoSilenceSeconds);
    }

    if (settings.alertChannels.includes('vibration')) {
      this.triggerVibration();
    }

    return { triggered: true, distanceMeters };
  }

  clearHotspotCooldown(hotspotId: string) {
    this.lastTriggeredMap.delete(hotspotId);
  }

  resetAllCooldowns() {
    this.lastTriggeredMap.clear();
  }

  stop() {
    this.stopSound();
    this.resetAllCooldowns();
  }

  silence() {
    this.stopSound();
  }

  private playSound(autoSilenceSeconds: number) {
    if (!this.audio) {
      return;
    }

    const durationMs = Math.max(autoSilenceSeconds * 1_000, this.minIntervalMs);

    // Attempt to play audio; ignore promise rejection caused by autoplay policies.
    const playPromise = this.audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // no-op: browsers may block autoplay without user interaction.
      });
    }

    if (this.stopAudioTimeout) {
      window.clearTimeout(this.stopAudioTimeout);
    }

    this.stopAudioTimeout = window.setTimeout(() => {
      this.stopSound();
    }, durationMs);
  }

  private stopSound() {
    if (!this.audio) {
      return;
    }

    if (this.stopAudioTimeout) {
      window.clearTimeout(this.stopAudioTimeout);
      this.stopAudioTimeout = undefined;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private triggerVibration() {
    if (!canVibrate()) {
      return;
    }

    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // Ignore vibration failures (commonly blocked by user agent policies).
    }
  }
}

export const createAlertService = (options?: AlertServiceOptions) =>
  new AlertService(options);
