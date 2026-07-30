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

export interface PushupState {
  reps: number;
  stage: "up" | "down";
  lastElbowAngle: number;
}

export function updateSquatCounter(
  avgKneeAngle: number,
  state: SquatState,
  avgHipY: number,
  avgKneeY: number,
  lastRepTime: number
): { state: SquatState; feedback: string; repTriggered: boolean } {
  let newReps = state.reps;
  let newStage = state.stage;
  let feedback = "Stand straight";
  let repTriggered = false;

  // Relaxed squat thresholds: knee angle < 120 and hip Y below knee Y
  const isDeep = avgKneeAngle < 120 || avgHipY > avgKneeY;

  if (isDeep && state.stage === "up") {
    newStage = "down";
    feedback = "Good depth, now stand up";
  }

  // Relaxed up threshold: knee angle > 150
  if (avgKneeAngle > 150 && state.stage === "down") {
    if (Date.now() - lastRepTime > 200) {
      newStage = "up";
      newReps += 1;
      feedback = "Good rep";
      repTriggered = true;
    }
  } else if (state.stage === "down" && avgKneeAngle < 130) {
    feedback = "Stand up completely";
  } else if (state.stage === "up" && avgKneeAngle < 135 && !isDeep) {
    feedback = "Go lower";
  }

  return {
    state: {
      reps: newReps,
      stage: newStage,
      lastKneeAngle: avgKneeAngle,
    },
    feedback,
    repTriggered,
  };
}

export function updatePushupCounter(
  avgElbowAngle: number,
  avgHipAngle: number,
  state: PushupState,
  lastRepTime: number
): { state: PushupState; feedback: string; repTriggered: boolean } {
  let newReps = state.reps;
  let newStage = state.stage;
  let feedback = "Get ready";
  let repTriggered = false;

  // Relaxed body alignment: straight if angle > 150
  if (avgHipAngle < 150) {
    return {
      state,
      feedback: "Keep body straight",
      repTriggered: false
    };
  }

  // Relaxed down threshold: elbow angle < 110
  if (avgElbowAngle < 110 && state.stage === "up") {
    newStage = "down";
    feedback = "Good depth, now push up";
  }

  // Relaxed up threshold: elbow angle > 150
  if (avgElbowAngle > 150 && state.stage === "down") {
    if (Date.now() - lastRepTime > 200) {
      newStage = "up";
      newReps += 1;
      feedback = "Good rep";
      repTriggered = true;
    }
  } else if (state.stage === "down" && avgElbowAngle < 130) {
    feedback = "Keep pushing up";
  } else if (state.stage === "up" && avgElbowAngle > 115 && avgElbowAngle < 140) {
    feedback = "Go lower";
  } else if (avgElbowAngle >= 140 && avgElbowAngle < 150) {
    feedback = "Straighten arms";
  }

  return {
    state: {
      reps: newReps,
      stage: newStage,
      lastElbowAngle: avgElbowAngle,
    },
    feedback,
    repTriggered,
  };
}
