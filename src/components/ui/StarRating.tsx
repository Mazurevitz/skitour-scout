/**
 * Star Rating Component
 *
 * Reusable star rating display and input component.
 */

import { Star } from 'lucide-react';
import { STAR_RATINGS } from '@/constants';

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-5 h-5',
  lg: 'w-12 h-12',
};

export function StarRating({
  rating,
  onChange,
  readonly = false,
  size = 'sm',
  className = '',
}: StarRatingProps) {
  const isInteractive = !readonly && onChange;
  const starSize = sizeClasses[size];

  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`Ocena: ${rating} z 5 gwiazdek`}
    >
      {STAR_RATINGS.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => isInteractive && onChange(star)}
          disabled={readonly}
          className={`${isInteractive ? 'p-2 transition-transform active:scale-90 cursor-pointer' : 'cursor-default'}`}
          aria-label={isInteractive ? `Ocena ${star}` : undefined}
        >
          <Star
            className={`${starSize} ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : readonly ? 'text-gray-500' : 'text-gray-600'
            }`}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
