export async function initPose() {
  if (typeof window === "undefined") return null;

  const mpPose = await import("@mediapipe/pose");

  const pose = new mpPose.Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return pose;
}
