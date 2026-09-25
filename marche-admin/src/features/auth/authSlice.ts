import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, setToken, getToken } from '@/lib/api';

export type Staff = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  storeId: string | null;
  canEditPrices: boolean;
  canCreateProducts: boolean;
  canEditStock: boolean;
  canHr: boolean;
  canReadHr: boolean;
};

const STAFF_KEY = 'marche-admin-staff';

function peekStaff(): Staff | null {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? (JSON.parse(raw) as Staff) : null;
  } catch {
    return null;
  }
}

function cacheStaff(staff: Staff | null) {
  try {
    if (staff) localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    else localStorage.removeItem(STAFF_KEY);
  } catch {
    /* ignore */
  }
}

export const loginAdmin = createAsyncThunk(
  'auth/login',
  async (creds: { email: string; password: string }) => {
    const res = await api<{ token: string }>('/ops/login', {
      method: 'POST',
      body: JSON.stringify(creds),
    });
    setToken(res.token);
    const me = await api<{ staff: Staff }>('/admin/me');
    return { token: res.token, staff: me.staff };
  },
);

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  const me = await api<{ staff: Staff }>('/admin/me');
  return me.staff;
});

const peeked = peekStaff();
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    staff: peeked,
    status: (peeked && getToken() ? 'ready' : 'idle') as 'idle' | 'loading' | 'ready' | 'error',
    error: '' as string,
  },
  reducers: {
    logout(state) {
      setToken(null);
      cacheStaff(null);
      state.staff = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAdmin.pending, (s) => {
        s.status = 'loading';
        s.error = '';
      })
      .addCase(loginAdmin.fulfilled, (s, a) => {
        s.staff = a.payload.staff;
        cacheStaff(a.payload.staff);
        s.status = 'ready';
      })
      .addCase(loginAdmin.rejected, (s, a) => {
        setToken(null);
        cacheStaff(null);
        s.status = 'error';
        s.error = a.error.message || 'Connexion impossible.';
      })
      .addCase(bootstrapAuth.pending, (s) => {
        if (!s.staff) s.status = 'loading';
      })
      .addCase(bootstrapAuth.fulfilled, (s, a) => {
        s.staff = a.payload;
        cacheStaff(a.payload);
        s.status = 'ready';
      })
      .addCase(bootstrapAuth.rejected, (s) => {
        setToken(null);
        cacheStaff(null);
        s.staff = null;
        s.status = 'idle';
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
