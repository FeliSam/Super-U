import { configureStore } from '@reduxjs/toolkit';
import auth from '@/features/auth/authSlice';
import ui from '@/features/ui/uiSlice';

export const store = configureStore({
  reducer: { auth, ui },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
