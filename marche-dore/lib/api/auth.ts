import { apiAvailable, apiFetch, ApiError } from '@/lib/api/http';

export type ApiUser = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  onboardingDone: boolean;
  birthDate?: string;
  createdAt?: string;
};

type AuthOk = { ok: true; token: string; user: ApiUser };
type AuthFail = { ok: false; error: string };

export async function apiLogin(identifier: string, password: string): Promise<AuthOk | AuthFail> {
  try {
    return await apiFetch<AuthOk>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function apiRegister(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthOk | AuthFail> {
  try {
    return await apiFetch<AuthOk>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function apiMe(): Promise<ApiUser | null> {
  try {
    const res = await apiFetch<{ ok: true; user: ApiUser }>('/auth/me');
    return res.user;
  } catch {
    return null;
  }
}

export async function apiCompleteOnboarding() {
  await apiFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ onboardingDone: true }),
  });
}

export async function apiPatchProfile(patch: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
}): Promise<ApiUser | null> {
  try {
    const res = await apiFetch<{ ok: true; user: ApiUser }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return res.user;
  } catch {
    return null;
  }
}
