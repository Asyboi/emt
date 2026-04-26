import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Maximize2, Minimize2, Locate } from 'lucide-react';
import { MapView, type CameraViewState } from './MapView';
import { EventPanel } from './EventPanel';
import { TimelineCard } from './TimelineCard';
import { PlaybackControls } from './PlaybackControls';
import { useAmbulanceAnimation } from './useAmbulanceAnimation';
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
  const [activeEvent, setActiveEvent] = useState<SimulationEvent | null>(null);
  const [events, setEvents] = useState<SimulationEvent[]>(SIMULATION_EVENTS);
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

  const handleEventReached = useCallback((evt: SimulationEvent) => {
    setActiveEvent(evt);
  }, []);

  const {
    simTime,
    isPlaying,
    currentPosition,
    currentBearing,
    visitedEventIds,
    play,
    pause,
    reset,
    jumpToEvent,
    progress,
  } = useAmbulanceAnimation(AMBULANCE_ROUTE, events, handleEventReached);

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
      setActiveEvent(null);
      play();
      const allDone = events.every((e) => e.id === eventId || e.confirmed);
      if (allDone) onAllConfirmed?.();
    },
    [events, play, onAllConfirmed]
  );

  const handleSkip = useCallback(() => {
    setActiveEvent(null);
    play();
  }, [play]);

  const handleDismiss = useCallback(() => {
    setActiveEvent(null);
    play();
  }, [play]);

  const handleEventClick = useCallback(
    (evt: SimulationEvent) => {
      pause();
      jumpToEvent(evt);
      setActiveEvent(evt);
    },
    [pause, jumpToEvent]
  );

  const confirmedCount = events.filter((e) => e.confirmed).length;

  const { ref: fsRef, isFullscreen, toggle: toggleFullscreen } =
    useFullscreen<HTMLDivElement>();

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
        simTime={simTime}
        activeEvent={activeEvent}
        visitedEventIds={visitedEventIds}
        mode={mode}
        onEventClick={handleEventClick}
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
        <EventPanel
          event={activeEvent}
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

      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 border border-border"
        style={{ background: 'var(--surface)' }}
      >
        <span className="text-xs text-foreground-secondary">
          {mode === 'emt-review' ? '🚑 EMT PCR Review' : '📋 QI Supervisor Review'}
        </span>
      </div>
    </div>
  );
}
