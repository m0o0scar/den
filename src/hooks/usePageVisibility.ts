'use client';

import { useEffect, useRef, useState } from 'react';

type PageVisibilityState = {
  isPageVisible: boolean;
  resumeVersion: number;
};

function readPageVisible(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  return !document.hidden;
}

export function usePageVisibility(): PageVisibilityState {
  const [isPageVisible, setIsPageVisible] = useState<boolean>(() => readPageVisible());
  const [resumeVersion, setResumeVersion] = useState(0);
  const lastResumeAtRef = useRef(0);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const emitResume = () => {
      const now = Date.now();
      if (now - lastResumeAtRef.current < 150) {
        return;
      }
      lastResumeAtRef.current = now;
      setResumeVersion((current) => current + 1);
    };

    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      if (visible) {
        emitResume();
      }
    };

    const handleFocus = () => {
      if (document.hidden) {
        return;
      }
      setIsPageVisible(true);
      emitResume();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return { isPageVisible, resumeVersion };
}
