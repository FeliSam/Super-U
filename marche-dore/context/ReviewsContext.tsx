import { Review } from '@/data/reviews';
import { apiGetAccountState, apiPatchAccountState, loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import { apiRateCourier } from '@/lib/api/orders';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
import { useUiState } from '@/context/UiStateContext';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.reviews.v1';

export type CourierReview = {
  id: string;
  orderId: string;
  courierName: string;
  rating: number;
  comment: string;
  tipAmount?: number;
  date: string;
};

type ReviewsContextValue = {
  ready: boolean;
  userReviews: Review[];
  courierReviews: CourierReview[];
  reviewsForProduct: (productId: string) => Review[];
  hasUserReviewedProduct: (productId: string) => boolean;
  addReview: (review: Omit<Review, 'id' | 'date'> & { date?: string }) => void;
  courierReviewForOrder: (orderId: string) => CourierReview | undefined;
  addCourierReview: (input: {
    orderId: string;
    courierName: string;
    rating: number;
    comment: string;
    tipAmount?: number;
  }) => void;
};

const ReviewsContext = createContext<ReviewsContextValue | null>(null);

function formatReviewDate(date = new Date()) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeOrderId(id: string) {
  return id.replace(/^#/, '').trim();
}

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const { addLoyaltyBonus } = useUiState();
  const accountId = session?.accountId ?? null;
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [courierReviews, setCourierReviews] = useState<CourierReview[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      if (!accountId) {
        setUserReviews([]);
        setCourierReviews([]);
        hydrated.current = true;
        setReady(true);
        return;
      }
      const local = await loadAccountJson<{
        userReviews?: Review[];
        courierReviews?: CourierReview[];
      }>(STORAGE_KEY, accountId);
      let user = Array.isArray(local?.userReviews) ? local.userReviews : [];
      let courier = Array.isArray(local?.courierReviews) ? local.courierReviews : [];
      if (getAuthToken()) {
        const state = await apiGetAccountState();
        if (state?.reviews) {
          if (Array.isArray(state.reviews.userReviews)) user = state.reviews.userReviews as Review[];
          if (Array.isArray(state.reviews.courierReviews)) {
            courier = state.reviews.courierReviews as CourierReview[];
          }
        }
      }
      if (!active) return;
      setUserReviews(user);
      setCourierReviews(courier);
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, { userReviews, courierReviews });
    apiPatchAccountState({ reviews: { userReviews, courierReviews } });
  }, [userReviews, courierReviews, accountId]);

  const reviewsForProduct = useCallback(
    (productId: string) => userReviews.filter((r) => r.productId === productId),
    [userReviews],
  );

  const hasUserReviewedProduct = useCallback(
    (productId: string) => userReviews.some((r) => r.productId === productId),
    [userReviews],
  );

  const addReview = useCallback(
    (input: Omit<Review, 'id' | 'date'> & { date?: string }) => {
      const review: Review = {
        ...input,
        id: `user-${input.productId}-${Date.now()}`,
        date: input.date ?? formatReviewDate(),
        verified: true,
      };
      setUserReviews((prev) => [review, ...prev.filter((r) => r.productId !== review.productId || !r.id.startsWith('user-'))]);
      if (Array.isArray(input.images) && input.images.length > 0) {
        addLoyaltyBonus(50);
      }
    },
    [addLoyaltyBonus],
  );

  const courierReviewForOrder = useCallback(
    (orderId: string) => {
      const key = normalizeOrderId(orderId);
      return courierReviews.find((r) => normalizeOrderId(r.orderId) === key);
    },
    [courierReviews],
  );

  const addCourierReview = useCallback(
    (input: { orderId: string; courierName: string; rating: number; comment: string; tipAmount?: number }) => {
      const orderId = normalizeOrderId(input.orderId);
      const tipAmount = Math.max(0, Math.round(Number(input.tipAmount ?? 0)));
      const review: CourierReview = {
        id: `courier-${orderId}-${Date.now()}`,
        orderId,
        courierName: input.courierName,
        rating: input.rating,
        comment: input.comment.trim(),
        tipAmount,
        date: formatReviewDate(),
      };
      setCourierReviews((prev) => [
        review,
        ...prev.filter((r) => normalizeOrderId(r.orderId) !== orderId),
      ]);
      void apiRateCourier(orderId, input.rating, input.comment, tipAmount).catch(() => undefined);
    },
    [],
  );

  const value = useMemo(
    () => ({
      ready,
      userReviews,
      courierReviews,
      reviewsForProduct,
      hasUserReviewedProduct,
      addReview,
      courierReviewForOrder,
      addCourierReview,
    }),
    [
      ready,
      userReviews,
      courierReviews,
      reviewsForProduct,
      hasUserReviewedProduct,
      addReview,
      courierReviewForOrder,
      addCourierReview,
    ],
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews() {
  const ctx = useContext(ReviewsContext);
  if (!ctx) throw new Error('useReviews must be used within ReviewsProvider');
  return ctx;
}
