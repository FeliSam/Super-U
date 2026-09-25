import { APP_TOUR_STEPS, type AppTourStep } from '@/lib/appTour';
import { navigateTab } from '@/lib/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUiState } from '@/context/UiStateContext';
import { usePathname, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AppTourContextValue = {
  active: boolean;
  stepIndex: number;
  step: AppTourStep | null;
  total: number;
  next: () => void;
  skip: () => void;
};

const AppTourContext = createContext<AppTourContextValue | null>(null);

export function AppTourProvider({ children }: { children: React.ReactNode }) {
  const { session, ready, needsOnboarding } = useAuth();
  const { appTourDone, setAppTourDone } = useUiState();
  const pathname = usePathname();
  const segments = useSegments();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const inSetup = segments[0] === '(auth)' || segments[0] === 'account';

  useEffect(() => {
    if (!ready || !session || needsOnboarding || appTourDone || active || inSetup) return;
    const onTabs =
      pathname === '/' ||
      pathname === '/index' ||
      pathname.startsWith('/explore') ||
      pathname.startsWith('/cart') ||
      pathname.startsWith('/chat') ||
      pathname.startsWith('/profile');
    if (!onTabs) return;
    setStepIndex(0);
    setActive(true);
    if (pathname !== '/' && pathname !== '/index') navigateTab('/');
  }, [ready, session, needsOnboarding, appTourDone, active, inSetup, pathname]);

  const finish = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    setAppTourDone(true);
  }, [setAppTourDone]);

  const next = useCallback(() => {
    const upcoming = stepIndex + 1;
    if (upcoming >= APP_TOUR_STEPS.length) {
      finish();
      return;
    }
    const nextStep = APP_TOUR_STEPS[upcoming];
    const current = APP_TOUR_STEPS[stepIndex];
    if (nextStep.href !== current.href) {
      navigateTab(nextStep.href);
    }
    setStepIndex(upcoming);
  }, [finish, stepIndex]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const value = useMemo(
    () => ({
      active,
      stepIndex,
      step: active ? APP_TOUR_STEPS[stepIndex] ?? null : null,
      total: APP_TOUR_STEPS.length,
      next,
      skip,
    }),
    [active, next, skip, stepIndex],
  );

  return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}

export function useAppTour() {
  const ctx = useContext(AppTourContext);
  if (!ctx) throw new Error('useAppTour must be used within AppTourProvider');
  return ctx;
}
