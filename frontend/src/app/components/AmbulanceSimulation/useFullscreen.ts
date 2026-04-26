import { useCallback, useEffect, useRef, useState } from 'react';

export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === ref.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(async () => {
    if (!ref.current) return;
    if (document.fullscreenElement === ref.current) {
      await document.exitFullscreen();
    } else {
      await ref.current.requestFullscreen();
    }
  }, []);

  return { ref, isFullscreen, toggle };
}
