import { createSlice } from '@reduxjs/toolkit';

const KEY = 'marche-admin-theme';

function initial(): 'light' | 'dark' {
  const saved = localStorage.getItem(KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { theme: typeof window === 'undefined' ? ('light' as const) : initial() },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, state.theme);
      document.documentElement.dataset.theme = state.theme;
    },
    applyTheme(state) {
      document.documentElement.dataset.theme = state.theme;
    },
  },
});

export const { toggleTheme, applyTheme } = uiSlice.actions;
export default uiSlice.reducer;
