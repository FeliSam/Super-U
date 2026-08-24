import { Review } from '@/data/reviews';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ReviewsContextValue = {
  userReviews: Review[];
  reviewsForProduct: (productId: string) => Review[];
  addReview: (review: Omit<Review, 'id' | 'date'> & { date?: string }) => void;
};

const ReviewsContext = createContext<ReviewsContextValue | null>(null);

function formatReviewDate(date = new Date()) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [userReviews, setUserReviews] = useState<Review[]>([]);

  const reviewsForProduct = useCallback(
    (productId: string) => userReviews.filter((r) => r.productId === productId),
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
      setUserReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
    },
    [],
  );

  const value = useMemo(
    () => ({ userReviews, reviewsForProduct, addReview }),
    [userReviews, reviewsForProduct, addReview],
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews() {
  const ctx = useContext(ReviewsContext);
  if (!ctx) throw new Error('useReviews must be used within ReviewsProvider');
  return ctx;
}
