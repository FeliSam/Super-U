import { type UserProfile } from '@/data/account';
import { apiGetAccountState, apiPatchAccountState, loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.profile.v1';

const EMPTY_PROFILE: UserProfile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  photoUri: '',
};

type ProfileContextValue = {
  ready: boolean;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setProfile: (next: UserProfile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function identityFields(p: Pick<UserProfile, 'firstName' | 'lastName' | 'email' | 'phone' | 'birthDate'>) {
  return {
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    email: p.email.trim(),
    phone: p.phone.trim(),
    birthDate: p.birthDate.trim(),
  };
}

function profilesEqual(a: UserProfile, b: UserProfile) {
  return (
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.email === b.email &&
    a.phone === b.phone &&
    a.birthDate === b.birthDate &&
    (a.photoUri ?? '') === (b.photoUri ?? '')
  );
}

function identityChanged(a: UserProfile, b: UserProfile) {
  return (
    a.firstName !== b.firstName ||
    a.lastName !== b.lastName ||
    a.email !== b.email ||
    a.phone !== b.phone ||
    a.birthDate !== b.birthDate
  );
}

function fromSession(
  session: { firstName: string; lastName: string; email: string; phone: string; birthDate?: string } | null,
  birthDate: string,
  photoUri: string,
): UserProfile {
  if (!session) return EMPTY_PROFILE;
  return {
    firstName: session.firstName,
    lastName: session.lastName,
    email: session.email,
    phone: session.phone,
    birthDate: birthDate || session.birthDate || '',
    photoUri,
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady, applyProfile } = useAuth();
  const accountId = session?.accountId ?? null;
  const [profile, setProfileState] = useState<UserProfile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      if (!accountId || !session) {
        setProfileState(EMPTY_PROFILE);
        hydrated.current = true;
        setReady(true);
        return;
      }
      const local = await loadAccountJson<UserProfile>(STORAGE_KEY, accountId);
      let birthDate = local?.birthDate ?? session.birthDate ?? '';
      let photoUri = typeof local?.photoUri === 'string' ? local.photoUri : '';
      if (getAuthToken()) {
        const state = await apiGetAccountState();
        if (typeof state?.birthDate === 'string') birthDate = state.birthDate;
        if (typeof state?.photoUri === 'string') photoUri = state.photoUri;
      }
      if (!active) return;
      setProfileState(fromSession(session, birthDate, photoUri));
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
    // Identity fields come from the session snapshot at account switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload per account
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, profile);
  }, [profile, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    apiPatchAccountState({ birthDate: profile.birthDate });
  }, [profile.birthDate, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    apiPatchAccountState({ photoUri: profile.photoUri ?? '' });
  }, [profile.photoUri, accountId]);

  const setProfile = useCallback(
    (next: UserProfile) => {
      setProfileState((prev) => {
        const normalized: UserProfile = {
          ...identityFields(next),
          photoUri: (next.photoUri ?? prev.photoUri ?? '').trim(),
        };
        if (profilesEqual(prev, normalized)) return prev;
        if (identityChanged(prev, normalized)) void applyProfile(identityFields(normalized));
        return normalized;
      });
    },
    [applyProfile],
  );

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      setProfileState((prev) => {
        const next: UserProfile = {
          firstName: (patch.firstName ?? prev.firstName).trim(),
          lastName: (patch.lastName ?? prev.lastName).trim(),
          email: (patch.email ?? prev.email).trim(),
          phone: (patch.phone ?? prev.phone).trim(),
          birthDate: (patch.birthDate ?? prev.birthDate).trim(),
          photoUri: (patch.photoUri ?? prev.photoUri ?? '').trim(),
        };
        if (profilesEqual(prev, next)) return prev;
        if (identityChanged(prev, next)) void applyProfile(identityFields(next));
        return next;
      });
    },
    [applyProfile],
  );

  const value = useMemo(
    () => ({ ready, profile, updateProfile, setProfile }),
    [ready, profile, updateProfile, setProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
