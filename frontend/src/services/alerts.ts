import type { NearbyHotspot } from '../types/hotspot';
import type { AlertSettings, AlertChannel } from '../types/settings';
import type { Coordinates } from '../store/locationSlice';
import { getHighestSeverityLevel } from '../types/hotspot';
import { isFlutterBridgeAvailable, sendNotification } from './flutterBridge';

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
  activatedChannels: AlertChannel[];
  unsupportedChannels?: AlertChannel[];
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
    const distanceMeters = calculateDistanceMeters(userLocation, hotspot);

    if (settings.ignoredHotspotIds.includes(hotspot.id)) {
      return { triggered: false, distanceMeters, reason: 'ignored', activatedChannels: [] };
    }

    const highestSeverity = getHighestSeverityLevel(hotspot);
    if (!settings.severityFilter.includes(highestSeverity)) {
      return {
        triggered: false,
        distanceMeters,
        reason: 'severity-filtered',
        activatedChannels: [],
      };
    }

    if (distanceMeters > settings.distanceMeters) {
      return {
        triggered: false,
        distanceMeters,
        reason: 'out-of-range',
        activatedChannels: [],
      };
    }

    const lastTriggeredAt = this.lastTriggeredMap.get(hotspot.id);
    const now = Date.now();

    if (lastTriggeredAt && now - lastTriggeredAt < this.minIntervalMs) {
      return {
        triggered: false,
        distanceMeters,
        reason: 'cooldown',
        activatedChannels: [],
      };
    }

    this.lastTriggeredMap.set(hotspot.id, now);

    if (settings.alertChannels.length === 0) {
      return {
        triggered: true,
        distanceMeters,
        reason: 'channels-disabled',
        activatedChannels: [],
      };
    }

    const activatedChannels: AlertChannel[] = [];
    const unsupportedChannels: AlertChannel[] = [];

    const bridgeHandled = this.triggerViaBridge({
      hotspot,
      distanceMeters,
      channels: settings.alertChannels,
    });

    if (!bridgeHandled) {
      if (settings.alertChannels.includes('sound')) {
        const played = this.playSound(settings.autoSilenceSeconds);
        if (played || !this.audio) {
          activatedChannels.push('sound');
        } else {
          unsupportedChannels.push('sound');
        }
      }

      if (settings.alertChannels.includes('vibration')) {
        if (this.triggerVibration()) {
          activatedChannels.push('vibration');
        } else {
          unsupportedChannels.push('vibration');
        }
      }
    } else {
      activatedChannels.push(...settings.alertChannels);
    }

    if (activatedChannels.length === 0) {
      return {
        triggered: true,
        distanceMeters,
        reason: 'unsupported',
        activatedChannels,
        unsupportedChannels,
      };
    }

    return {
      triggered: true,
      distanceMeters,
      activatedChannels,
      unsupportedChannels: unsupportedChannels.length ? unsupportedChannels : undefined,
    };
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

  private playSound(autoSilenceSeconds: number): boolean {
    if (!this.audio) {
      return false;
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
    return true;
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

  private triggerVibration(): boolean {
    if (!canVibrate()) {
      return false;
    }

    try {
      return navigator.vibrate([200, 100, 200]);
    } catch {
      return false;
    }
  }

  private triggerViaBridge({
    hotspot,
    distanceMeters,
    channels,
  }: {
    hotspot: NearbyHotspot;
    distanceMeters: number;
    channels: AlertChannel[];
  }): boolean {
    if (!isFlutterBridgeAvailable() || channels.length === 0) {
      return false;
    }

    const highestSeverity = getHighestSeverityLevel(hotspot);
    const title = highestSeverity === 'A1' ? '⚠️ 致命事故熱點' : '⚠️ 事故熱點提醒';
    const content = `前方約 ${Math.round(
      distanceMeters,
    )} 公尺存在 ${hotspot.totalAccidents} 起事故記錄，請降低車速並保持注意。`;

    return sendNotification(title, content, channels);
  }
}

export const createAlertService = (options?: AlertServiceOptions) =>
  new AlertService(options);
