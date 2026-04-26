import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Maximize2, Minimize2, Locate } from 'lucide-react';
import { WebMercatorViewport } from '@deck.gl/core';
import { MapView, type CameraViewState } from './MapView';
import { EventCallouts } from './EventCallouts';
import { TimelineCard } from './TimelineCard';
import { PlaybackControls } from './PlaybackControls';
import { useAmbulanceAnimation, interpolatePosition } from './useAmbulanceAnimation';
import { useFullscreen } from './useFullscreen';
import { AMBULANCE_ROUTE } from './data/route';
import { SIMULATION_EVENTS } from './data/events';
import type { SimulationEvent, MapMode } from './types';

interface AmbulanceSimulationProps {
  mode?: MapMode;
  onAllConfirmed?: () => void;
}

const FOLLOWING_ZOOM = 17;
const FOLLOWING_PITCH = 60;

export function AmbulanceSimulation({
  mode = 'qa-review',
  onAllConfirmed,
}: AmbulanceSimulationProps) {
  const [events, setEvents] = useState<SimulationEvent[]>(() =>
    SIMULATION_EVENTS.map((e) => ({
      ...e,
      coordinates: interpolatePosition(AMBULANCE_ROUTE, e.timestamp).position,
    }))
  );
  const [followMode, setFollowMode] = useState(true);
  const userInteractedRef = useRef(false);

  const initialView = useMemo<CameraViewState>(() => {
    const start = AMBULANCE_ROUTE.path[0];
    const end = AMBULANCE_ROUTE.path[AMBULANCE_ROUTE.path.length - 1];
    return {
      longitude: (start[0] + end[0]) / 2,
      latitude: (start[1] + end[1]) / 2,
      zoom: 13,
      pitch: 0,
      bearing: 0,
    };
  }, []);

  const [viewState, setViewState] = useState<CameraViewState>(initialView);

  // Wall-clock pulse phase for the event-marker rings — independent of playback
  // so markers keep flashing when the simulation is paused.
  const [pulsePhase, setPulsePhase] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      // ~1.4Hz pulse
      setPulsePhase(((now - start) / 1000) * Math.PI * 1.4);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const {
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
    progress,
  } = useAmbulanceAnimation(AMBULANCE_ROUTE, events);

  // Cards are visible iff the ambulance is within proximity of an event AND
  // the user hasn't manually closed the card for this visit. The dismissal
  // clears as soon as the ambulance leaves proximity, so revisits show again.
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null);
  useEffect(() => {
    if (!nearbyEvent) setDismissedEventId(null);
  }, [nearbyEvent]);
  const activeEvent =
    nearbyEvent && nearbyEvent.id !== dismissedEventId ? nearbyEvent : null;
  const handleCloseCard = useCallback(() => {
    if (nearbyEvent) setDismissedEventId(nearbyEvent.id);
  }, [nearbyEvent]);

  // Aerial → following intro: only fires if the user hasn't taken control yet.
  useEffect(() => {
    const t = setTimeout(() => {
      if (userInteractedRef.current) return;
      setFollowMode(true);
      setViewState({
        longitude: currentPosition[0],
        latitude: currentPosition[1],
        zoom: FOLLOWING_ZOOM,
        pitch: FOLLOWING_PITCH,
        bearing: currentBearing,
      });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While following, RAF-driven position/bearing updates flow into the camera.
  useEffect(() => {
    if (!followMode) return;
    setViewState((prev) => ({
      ...prev,
      longitude: currentPosition[0],
      latitude: currentPosition[1],
      bearing: currentBearing,
    }));
  }, [followMode, currentPosition, currentBearing]);

  const handleViewStateChange = useCallback(
    (
      next: CameraViewState,
      interaction: { isDragging: boolean; isZooming: boolean; isPanning: boolean }
    ) => {
      setViewState(next);
      const userDriven =
        interaction.isDragging || interaction.isZooming || interaction.isPanning;
      if (userDriven) {
        userInteractedRef.current = true;
        if (followMode) setFollowMode(false);
      }
    },
    [followMode]
  );

  const recenterOnAmbulance = useCallback(() => {
    setFollowMode(true);
    setViewState({
      longitude: currentPosition[0],
      latitude: currentPosition[1],
      zoom: FOLLOWING_ZOOM,
      pitch: FOLLOWING_PITCH,
      bearing: currentBearing,
    });
  }, [currentPosition, currentBearing]);

  const handleConfirm = useCallback(
    (eventId: string) => {
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, confirmed: true } : e))
      );
      play();
      const allDone = events.every((e) => e.id === eventId || e.confirmed);
      if (allDone) onAllConfirmed?.();
    },
    [events, play, onAllConfirmed]
  );

  const handleSkip = useCallback(() => {
    play();
  }, [play]);

  const handleDismiss = useCallback(() => {
    play();
  }, [play]);

  const handleEventClick = useCallback(
    (evt: SimulationEvent) => {
      pause();
      jumpToEvent(evt);
    },
    [pause, jumpToEvent]
  );

  // Space toggles play/pause. Skip while typing in inputs or when the EventPanel
  // is open (so confirm/skip actions stay keyboard-accessible).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (activeEvent) return;
      e.preventDefault();
      if (isPlaying) pause();
      else play();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, play, pause, activeEvent]);

  const confirmedCount = events.filter((e) => e.confirmed).length;

  const { ref: fsRef, isFullscreen, toggle: toggleFullscreen } =
    useFullscreen<HTMLDivElement>();

  // Track the map container's screen dimensions so we can project the active
  // event's lng/lat into pixel space for the callout cards.
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = fsRef.current;
    if (!el) return;
    const measure = () =>
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fsRef]);

  const activeEventAnchor = useMemo(() => {
    if (!activeEvent || !containerSize.w || !containerSize.h) return null;
    const vp = new WebMercatorViewport({
      width: containerSize.w,
      height: containerSize.h,
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
    });
    const [x, y] = vp.project([
      activeEvent.coordinates[0],
      activeEvent.coordinates[1],
    ]);
    return { x, y };
  }, [activeEvent, viewState, containerSize]);

  return (
    <div
      ref={fsRef}
      className="relative w-full h-full"
      style={{
        minHeight: '500px',
        background: 'var(--background)',
      }}
    >
      <MapView
        route={AMBULANCE_ROUTE}
        events={events}
        currentPosition={currentPosition}
        currentBearing={currentBearing}
        simTime={simTime}
        activeEvent={activeEvent}
        visitedEventIds={visitedEventIds}
        mode={mode}
        pulsePhase={pulsePhase}
        onEventClick={handleEventClick}
        onBackgroundClick={handleCloseCard}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
      />

      <TimelineCard
        events={events}
        activeEventId={activeEvent?.id ?? null}
        visitedEventIds={visitedEventIds}
        mode={mode}
        onEventClick={handleEventClick}
      />

      {mode === 'emt-review' && (
        <div
          className="absolute top-4 left-4 rounded-lg px-3 py-2 border border-border"
          style={{ background: 'var(--surface)' }}
        >
          <div className="text-xs text-foreground-secondary">PCR Review Progress</div>
          <div className="text-sm font-semibold text-foreground">
            {confirmedCount} / {events.length} confirmed
          </div>
          {confirmedCount === events.length && (
            <div className="text-xs text-success mt-1">✓ Ready to submit</div>
          )}
        </div>
      )}

      {/* Map controls — top-right cluster, below the timeline card */}
      <div className="absolute top-4 right-64 flex flex-col gap-2">
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-foreground-secondary hover:text-foreground transition-colors"
          style={{ background: 'var(--surface)' }}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={recenterOnAmbulance}
          title={followMode ? 'Following ambulance' : 'Recenter on ambulance'}
          className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center transition-colors ${
            followMode
              ? 'text-primary'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
          style={{ background: 'var(--surface)' }}
        >
          <Locate className="w-4 h-4" />
        </button>
      </div>

      {activeEvent && (
        <EventCallouts
          event={activeEvent}
          anchor={activeEventAnchor}
          containerSize={containerSize}
          mode={mode}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
          onDismiss={handleDismiss}
        />
      )}

      <PlaybackControls
        isPlaying={isPlaying}
        progress={progress}
        simTime={simTime}
        onPlay={play}
        onPause={pause}
        onReset={reset}
      />

      {mode === 'emt-review' && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 border border-border"
          style={{ background: 'var(--surface)' }}
        >
          <span className="text-xs text-foreground-secondary">🚑 EMT PCR Review</span>
        </div>
      )}
    </div>
  );
}
