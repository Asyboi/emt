import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { AmbulanceRoute, SimulationEvent } from './types';

const ANIMATION_SPEED = 30;
const PROXIMITY_METERS = 40;

function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  return R * Math.sqrt(dLat * dLat + Math.cos(lat1) * Math.cos(lat2) * dLng * dLng);
}

function getBearing(a: [number, number], b: [number, number]): number {
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function interpolatePosition(
  route: AmbulanceRoute,
  simTime: number
): { position: [number, number]; bearing: number } {
  const { path, timestamps } = route;
  if (simTime <= timestamps[0]) {
    return { position: path[0], bearing: getBearing(path[0], path[1]) };
  }
  if (simTime >= timestamps[timestamps.length - 1]) {
    const n = path.length;
    return {
      position: path[n - 1],
      bearing: getBearing(path[n - 2], path[n - 1]),
    };
  }
  for (let i = 0; i < timestamps.length - 1; i++) {
    if (simTime >= timestamps[i] && simTime < timestamps[i + 1]) {
      const t = (simTime - timestamps[i]) / (timestamps[i + 1] - timestamps[i]);
      const lng = path[i][0] + t * (path[i + 1][0] - path[i][0]);
      const lat = path[i][1] + t * (path[i + 1][1] - path[i][1]);
      return {
        position: [lng, lat],
        bearing: getBearing(path[i], path[i + 1]),
      };
    }
  }
  return { position: path[path.length - 1], bearing: 0 };
}

export function useAmbulanceAnimation(
  route: AmbulanceRoute,
  events: SimulationEvent[]
) {
  const maxTime = route.timestamps[route.timestamps.length - 1];
  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<[number, number]>(
    route.path[0]
  );
  const [currentBearing, setCurrentBearing] = useState(
    getBearing(route.path[0], route.path[1])
  );
  const [visitedEventIds, setVisitedEventIds] = useState<Set<string>>(new Set());

  const rafRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const visitedRef = useRef<Set<string>>(new Set());
  const playingRef = useRef(false);

  const tick = useCallback(
    (now: number) => {
      if (!playingRef.current) return;
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setSimTime((prev) => {
        const next = Math.min(prev + delta * ANIMATION_SPEED, maxTime);
        const { position, bearing } = interpolatePosition(route, next);
        setCurrentPosition(position);
        setCurrentBearing(bearing);

        for (const evt of events) {
          if (!visitedRef.current.has(evt.id)) {
            if (haversineDistance(position, evt.coordinates) < PROXIMITY_METERS) {
              visitedRef.current.add(evt.id);
              setVisitedEventIds(new Set(visitedRef.current));
              playingRef.current = false;
              setIsPlaying(false);
              lastTimeRef.current = undefined;
              return next;
            }
          }
        }

        if (next >= maxTime) {
          playingRef.current = false;
          setIsPlaying(false);
        }
        return next;
      });

      if (playingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [route, events, maxTime]
  );

  // Event whose marker the ambulance is currently within proximity of (if any).
  // Drives popup visibility — appears on entry, disappears on exit, reappears
  // on any subsequent revisit.
  const nearbyEvent = useMemo<SimulationEvent | null>(() => {
    for (const e of events) {
      if (haversineDistance(currentPosition, e.coordinates) < PROXIMITY_METERS) {
        return e;
      }
    }
    return null;
  }, [events, currentPosition]);

  useEffect(() => {
    if (isPlaying) {
      playingRef.current = true;
      lastTimeRef.current = undefined;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      playingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    playingRef.current = false;
    setSimTime(0);
    setCurrentPosition(route.path[0]);
    setCurrentBearing(getBearing(route.path[0], route.path[1]));
    visitedRef.current = new Set();
    setVisitedEventIds(new Set());
    lastTimeRef.current = undefined;
  }, [route]);

  const jumpToEvent = useCallback((evt: SimulationEvent) => {
    setIsPlaying(false);
    playingRef.current = false;
    setSimTime(evt.timestamp);
    setCurrentPosition(evt.coordinates);
  }, []);

  return {
    simTime,
    isPlaying,
    currentPosition,
    currentBearing,
    visitedEventIds,
    nearbyEvent,
    play,
    pause,
    reset,
    jumpToEvent,
    progress: simTime / maxTime,
  };
}
