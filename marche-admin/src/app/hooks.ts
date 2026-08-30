import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/app/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T,>(sel: (s: RootState) => T) => useSelector(sel);
