import { Review } from '@/data/reviews';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.reviews.v1';

export type CourierReview = {
  id: string;
  orderId: string;
  courierName: string;
  rating: number;
  comment: string;
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
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [courierReviews, setCourierReviews] = useState<CourierReview[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as {
            userReviews?: Review[];
            courierReviews?: CourierReview[];
          };
          if (Array.isArray(parsed.userReviews)) setUserReviews(parsed.userReviews);
          if (Array.isArray(parsed.courierReviews)) setCourierReviews(parsed.courierReviews);
        }
      } catch {
        // ignore
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
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userReviews, courierReviews }),
    ).catch(() => undefined);
  }, [userReviews, courierReviews]);

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
    },
    [],
  );

  const courierReviewForOrder = useCallback(
    (orderId: string) => {
      const key = normalizeOrderId(orderId);
      return courierReviews.find((r) => normalizeOrderId(r.orderId) === key);
    },
    [courierReviews],
  );

  const addCourierReview = useCallback(
    (input: { orderId: string; courierName: string; rating: number; comment: string }) => {
      const orderId = normalizeOrderId(input.orderId);
      const review: CourierReview = {
        id: `courier-${orderId}-${Date.now()}`,
        orderId,
        courierName: input.courierName,
        rating: input.rating,
        comment: input.comment.trim(),
        date: formatReviewDate(),
      };
      setCourierReviews((prev) => [
        review,
        ...prev.filter((r) => normalizeOrderId(r.orderId) !== orderId),
      ]);
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
