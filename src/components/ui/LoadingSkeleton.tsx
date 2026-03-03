/**
 * Loading Skeleton Component
 *
 * Reusable loading placeholder for content.
 */

import { SKELETON_COUNT } from '@/constants';

interface LoadingSkeletonProps {
  count?: number;
  height?: string;
  className?: string;
}

export function LoadingSkeleton({
  count = SKELETON_COUNT,
  height = 'h-20',
  className = '',
}: LoadingSkeletonProps) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`${height} bg-gray-800 rounded-xl ${className}`}
        />
      ))}
    </div>
  );
}
