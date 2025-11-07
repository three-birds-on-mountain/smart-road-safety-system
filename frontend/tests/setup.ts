import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

process.env.VITE_MAPBOX_ACCESS_TOKEN ??= 'test-token';
process.env.VITE_API_BASE_URL ??= 'http://localhost:8000';

vi.mock('../src/lib/mapbox', () => {
  class FakeMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      return this;
    }
  }

  class FakeNavigationControl {}

  class FakeMap {
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    addControl() {
      return this;
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)!.add(handler);
      return this;
    }

    off(event: string, handler: (...args: unknown[]) => void) {
      this.listeners.get(event)?.delete(handler);
      return this;
    }

    remove() {
      this.listeners.get('remove')?.forEach((handler) => handler());
      this.listeners.clear();
    }

    addLayer() {
      return this;
    }

    getLayer() {
      return undefined;
    }

    addSource() {
      return this;
    }

    getSource() {
      return {
        setData: () => {},
      };
    }

    getStyle() {
      return { layers: [] };
    }

    queryRenderedFeatures() {
      return [];
    }

    easeTo() {
      return this;
    }

    getZoom() {
      return 12;
    }

    getBearing() {
      return 0;
    }

    getCanvas() {
      return { style: {} } as HTMLCanvasElement;
    }

    getContainer() {
      return document.createElement('div');
    }
  }

  const mapboxObject = {
    Map: FakeMap,
    Marker: FakeMarker,
    NavigationControl: FakeNavigationControl,
    accessToken: '',
  };

  return {
    loadMapboxModule: async () => ({
      default: mapboxObject,
    }),
  };
});

vi.mock('../src/components/Map/MapView', () => {
  const React = require('react');
  const { useEffect, useMemo } = React;

  const createFakeMap = () => {
    const map = {
      on: () => map,
      off: () => map,
      remove: () => undefined,
      getCanvas: () => ({ style: {} } as HTMLCanvasElement),
      getZoom: () => 12,
      easeTo: () => undefined,
      jumpTo: () => undefined,
    };
    return map;
  };

  const MapViewMock = ({
    children,
    onMapLoad,
  }: {
    children?: (map: unknown) => React.ReactNode;
    onMapLoad?: (map: unknown) => void;
  }) => {
    const fakeMap = useMemo(() => createFakeMap(), []);

    useEffect(() => {
      onMapLoad?.(fakeMap);
      return () => {
        fakeMap.remove();
      };
    }, [fakeMap, onMapLoad]);

    return React.createElement(
      'div',
      { 'data-testid': 'mock-map' },
      typeof children === 'function' ? children(fakeMap) : children,
    );
  };

  return { default: MapViewMock };
});

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});
