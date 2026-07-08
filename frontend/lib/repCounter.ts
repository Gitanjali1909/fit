export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// Calculate the angle between three landmarks (e.g. Hip -> Knee -> Ankle)
// b is the vertex (Knee)
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  
  return angle;
}

export interface SquatState {
  reps: number;
  stage: "up" | "down";
  lastKneeAngle: number;
}

// Simple Squat Counter logic using knee angle thresholds
// standing = angle > 160, squatting = angle < 110
export function updateSquatCounter(
  leftKneeAngle: number,
  rightKneeAngle: number,
  state: SquatState
): SquatState {
  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
  let newReps = state.reps;
  let newStage = state.stage;

  // Squat Down Detection (Knees bent)
  if (avgKneeAngle < 110 && state.stage === "up") {
    newStage = "down";
  }

  // Squat Up Detection (Back to standing) - Complete 1 rep
  if (avgKneeAngle > 160 && state.stage === "down") {
    newStage = "up";
    newReps += 1;
  }

  return {
    reps: newReps,
    stage: newStage,
    lastKneeAngle: avgKneeAngle,
  };
}
