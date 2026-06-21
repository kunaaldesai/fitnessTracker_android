export type WorkoutDaySwipeInput = {
  translationX: number;
  translationY: number;
  velocityX: number;
  velocityY?: number;
};

const DISTANCE_THRESHOLD = 56;
const FLING_DISTANCE_THRESHOLD = 24;
const FLING_VELOCITY_THRESHOLD = 760;
const HORIZONTAL_RATIO = 1.2;

export function getWorkoutDaySwipeDelta({
  translationX,
  translationY,
  velocityX,
  velocityY = 0,
}: WorkoutDaySwipeInput): -1 | 0 | 1 {
  const absX = Math.abs(translationX);
  const absY = Math.abs(translationY);
  const absVelocityX = Math.abs(velocityX);
  const absVelocityY = Math.abs(velocityY);
  const isHorizontal = absX >= Math.max(18, absY * HORIZONTAL_RATIO);

  if (absX >= DISTANCE_THRESHOLD && isHorizontal) {
    return translationX < 0 ? 1 : -1;
  }

  const isHorizontalFling = absVelocityX >= Math.max(FLING_VELOCITY_THRESHOLD, absVelocityY * HORIZONTAL_RATIO);
  if (absX >= FLING_DISTANCE_THRESHOLD && isHorizontal && isHorizontalFling) {
    return velocityX < 0 ? 1 : -1;
  }

  return 0;
}
