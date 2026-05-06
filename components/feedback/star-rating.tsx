'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  count?: number;
}

export default function StarRating({
  rating,
  onRatingChange,
  readonly = false,
  size = 'md',
  showCount = false,
  count = 0,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const displayRating = readonly ? rating : hoverRating || rating;

  const handleClick = (value: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (!readonly) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => handleClick(value)}
            onMouseEnter={() => handleMouseEnter(value)}
            onMouseLeave={handleMouseLeave}
            disabled={readonly}
            className={`
              ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
              transition-transform
              ${!readonly ? 'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded' : ''}
            `}
            aria-label={`${value} star${value !== 1 ? 's' : ''}`}
          >
            <Star
              className={`
                ${sizeClasses[size]}
                ${
                  value <= displayRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-none text-gray-300'
                }
                transition-colors
              `}
            />
          </button>
        ))}
      </div>

      {showCount && count > 0 && <span className="text-sm text-gray-500 ml-1">({count})</span>}

      {!readonly && !showCount && (
        <span className="text-sm text-gray-600 ml-2">
          {rating > 0 ? `${rating}/5` : 'Select rating'}
        </span>
      )}
    </div>
  );
}
