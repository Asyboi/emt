import { useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import Map from 'react-map-gl/mapbox';
import type { AmbulanceRoute, SimulationEvent, MapMode } from './types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const SEVERITY_RGBA: Record<string, [number, number, number, number]> = {
  critical: [255, 59, 48, 230],
  warning: [255, 159, 10, 230],
  info: [48, 176, 199, 230],
};

export interface CameraViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MapViewProps {
  route: AmbulanceRoute;
  events: SimulationEvent[];
  currentPosition: [number, number];
  simTime: number;
  activeEvent: SimulationEvent | null;
  visitedEventIds: Set<string>;
  mode: MapMode;
  onEventClick: (event: SimulationEvent) => void;
  viewState: CameraViewState;
  onViewStateChange: (
    next: CameraViewState,
    interaction: { isDragging: boolean; isZooming: boolean; isPanning: boolean }
  ) => void;
}

export function MapView({
  route,
  events,
  currentPosition,
  simTime,
  activeEvent,
  visitedEventIds,
  onEventClick,
  viewState,
  onViewStateChange,
}: MapViewProps) {
  const tripData = [
    {
      waypoints: route.path.map((p, i) => ({
        coordinates: p,
        timestamp: route.timestamps[i],
      })),
    },
  ];

  const layers = [
    new TripsLayer({
      id: 'trip',
      data: tripData,
      getPath: (d: { waypoints: { coordinates: [number, number] }[] }) =>
        d.waypoints.map((w) => w.coordinates),
      getTimestamps: (d: { waypoints: { timestamp: number }[] }) =>
        d.waypoints.map((w) => w.timestamp),
      getColor: [255, 200, 0],
      opacity: 0.9,
      widthMinPixels: 4,
      trailLength: 150,
      currentTime: simTime,
    }),

    new ScatterplotLayer({
      id: 'ambulance',
      data: [currentPosition],
      getPosition: (d: [number, number]) => d,
      getFillColor: [255, 255, 255, 255],
      getRadius: 8,
      radiusUnits: 'meters',
    }),

    new ScatterplotLayer<SimulationEvent>({
      id: 'events',
      data: events,
      getPosition: (d) => [d.coordinates[0], d.coordinates[1]],
      getFillColor: (d) => {
        const base = SEVERITY_RGBA[d.severity];
        if (visitedEventIds.has(d.id)) return [base[0], base[1], base[2], 60];
        if (activeEvent?.id === d.id) return [255, 255, 255, 255];
        return base;
      },
      getRadius: (d) => (activeEvent?.id === d.id ? 18 : 12),
      radiusUnits: 'meters',
      pickable: true,
      onClick: ({ object }) => {
        if (object) onEventClick(object as SimulationEvent);
      },
      updateTriggers: {
        getFillColor: [activeEvent?.id, visitedEventIds.size],
        getRadius: [activeEvent?.id],
      },
    }),
  ];

  const onMapLoad = useCallback((evt: { target: mapboxgl.Map }) => {
    const map = evt.target;
    if (!map.getLayer('3d-buildings')) {
      map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#1a1a2e',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.8,
        },
      });
    }
  }, []);

  const handleViewStateChange = useCallback(
    (params: {
      viewState: Record<string, unknown>;
      interactionState: { isDragging?: boolean; isZooming?: boolean; isPanning?: boolean };
    }) => {
      const vs = params.viewState as unknown as CameraViewState;
      onViewStateChange(
        {
          longitude: vs.longitude,
          latitude: vs.latitude,
          zoom: vs.zoom,
          pitch: vs.pitch,
          bearing: vs.bearing,
        },
        {
          isDragging: !!params.interactionState.isDragging,
          isZooming: !!params.interactionState.isZooming,
          isPanning: !!params.interactionState.isPanning,
        }
      );
    },
    [onViewStateChange]
  );

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      controller={{
        dragPan: true,
        dragRotate: true,
        scrollZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        touchRotate: true,
        keyboard: false,
        inertia: true,
      }}
      layers={layers}
      style={{ position: 'absolute', inset: '0' }}
    >
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onLoad={onMapLoad}
        reuseMaps
      />
    </DeckGL>
  );
}
