'use client';

import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TrainerRatingDisplayProps {
  trainerId: string;
  averageRating: number;
  totalRatings: number;
  avgTeachingQuality?: number;
  avgCommunication?: number;
  avgMotivation?: number;
  avgPunctuality?: number;
  ratingDistribution?: {
    rating5: number;
    rating4: number;
    rating3: number;
    rating2: number;
    rating1: number;
  };
  showDetails?: boolean;
}

export function TrainerRatingDisplay({
  averageRating,
  totalRatings,
  avgTeachingQuality,
  avgCommunication,
  avgMotivation,
  avgPunctuality,
  ratingDistribution,
  showDetails = true,
}: TrainerRatingDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Trainer Rating</span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{averageRating.toFixed(1)}</span>
            <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Based on {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
        </p>

        {showDetails && ratingDistribution && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Rating Distribution</h4>
            {[5, 4, 3, 2, 1].map((rating) => {
              const count =
                ratingDistribution[`rating${rating}` as keyof typeof ratingDistribution];
              const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="w-12 text-sm">{rating} stars</span>
                  <Progress value={percentage} className="flex-1" />
                  <span className="w-8 text-sm text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {showDetails &&
          (avgTeachingQuality || avgCommunication || avgMotivation || avgPunctuality) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Category Ratings</h4>
              <div className="grid grid-cols-2 gap-3">
                {avgTeachingQuality && (
                  <CategoryRating label="Teaching" rating={avgTeachingQuality} />
                )}
                {avgCommunication && (
                  <CategoryRating label="Communication" rating={avgCommunication} />
                )}
                {avgMotivation && <CategoryRating label="Motivation" rating={avgMotivation} />}
                {avgPunctuality && <CategoryRating label="Punctuality" rating={avgPunctuality} />}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

function CategoryRating({ label, rating }: { label: string; rating: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      </div>
    </div>
  );
}
