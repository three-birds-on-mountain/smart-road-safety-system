import type { Map as MapboxMap } from 'mapbox-gl';

type MapboxModule = typeof import('mapbox-gl');

let mapboxModulePromise: Promise<MapboxModule> | null = null;

export const loadMapboxModule = async (): Promise<MapboxModule> => {
  if (!mapboxModulePromise) {
    mapboxModulePromise = import('mapbox-gl');
  }
  return mapboxModulePromise;
};

export type MapboxInstance = MapboxMap;
