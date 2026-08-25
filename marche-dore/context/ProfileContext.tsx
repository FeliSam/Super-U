import { userProfile as seedProfile, type UserProfile } from '@/data/account';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.profile.v1';

type ProfileContextValue = {
  ready: boolean;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setProfile: (next: UserProfile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function sanitizeProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<UserProfile>;
  const firstName = typeof p.firstName === 'string' ? p.firstName.trim() : '';
  const lastName = typeof p.lastName === 'string' ? p.lastName.trim() : '';
  if (!firstName && !lastName) return null;
  return {
    firstName: firstName || seedProfile.firstName,
    lastName: lastName || seedProfile.lastName,
    email: (typeof p.email === 'string' && p.email.trim()) || seedProfile.email,
    phone: (typeof p.phone === 'string' && p.phone.trim()) || seedProfile.phone,
    birthDate: (typeof p.birthDate === 'string' && p.birthDate.trim()) || seedProfile.birthDate,
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(seedProfile);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = sanitizeProfile(JSON.parse(raw));
          if (parsed) setProfileState(parsed);
        }
      } catch {
        // keep seed
      } finally {
        if (active) {
          hydrated.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile)).catch(() => {});
  }, [profile]);

  const setProfile = useCallback((next: UserProfile) => {
    setProfileState({
      firstName: next.firstName.trim() || seedProfile.firstName,
      lastName: next.lastName.trim() || seedProfile.lastName,
      email: next.email.trim() || seedProfile.email,
      phone: next.phone.trim() || seedProfile.phone,
      birthDate: next.birthDate.trim() || seedProfile.birthDate,
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfileState((prev) => ({
      firstName: (patch.firstName ?? prev.firstName).trim() || seedProfile.firstName,
      lastName: (patch.lastName ?? prev.lastName).trim() || seedProfile.lastName,
      email: (patch.email ?? prev.email).trim() || seedProfile.email,
      phone: (patch.phone ?? prev.phone).trim() || seedProfile.phone,
      birthDate: (patch.birthDate ?? prev.birthDate).trim() || seedProfile.birthDate,
    }));
  }, []);

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
