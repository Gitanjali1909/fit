"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { calculateAngle, updateSquatCounter, updatePushupCounter, SquatState, PushupState } from "@/lib/repCounter";
import { logWorkoutApi } from "@/lib/dashboardApi";
import { getOrCreateUserId } from "@/lib/user";

// Dynamically import CameraView with SSR disabled to prevent Next.js server-side build crashes
const CameraView = dynamic(() => import("@/components/CameraView"), { ssr: false });

interface SummaryData {
  exercise: string;
  score: string;
  type: "reps" | "duration";
}

export default function WorkoutPage() {
  const [selectedExercise, setSelectedExercise] = useState<"squat" | "pushup" | "plank">("squat");
  const [isActive, setIsActive] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [plankTime, setPlankTime] = useState(0);
  const [feedback, setFeedback] = useState("Align your body in the camera frame to begin.");

  // States for visual posture indicators
  const [kneeAngles, setKneeAngles] = useState({ left: 180, right: 180 });
  const [elbowAngles, setElbowAngles] = useState({ left: 180, right: 180 });
  const [hipAngles, setHipAngles] = useState({ left: 180, right: 180 });

  // Internal rep state trackers
  const [squatState, setSquatState] = useState<SquatState>({
    reps: 0,
    stage: "up",
    lastKneeAngle: 180,
  });
  const [pushupState, setPushupState] = useState<PushupState>({
    reps: 0,
    stage: "up",
    lastElbowAngle: 180,
  });

  // Smoothing historical frames refs (reduced to 3 frames window)
  const kneeHistoryRef = useRef<number[]>([]);
  const elbowHistoryRef = useRef<number[]>([]);
  const hipHistoryRef = useRef<number[]>([]);
  
  // Pushup shoulder vertical fallback history ref
  const shoulderYHistoryRef = useRef<number[]>([]);

  // Rep time lock and plank resume delay refs
  const lastRepTimeRef = useRef<number>(0);
  const plankStraightSinceRef = useRef<number>(0);
  const plankValidRef = useRef(false);

  // Summary display state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  // Interval timer for Plank duration
  useEffect(() => {
    let interval: any = null;
    if (isActive && selectedExercise === "plank") {
      interval = setInterval(() => {
        if (plankValidRef.current) {
          setPlankTime((t) => t + 1);
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, selectedExercise]);

  // Anti-cheat and smoothing calculator helper (reduced window to 3 frames)
  const getSmoothedAngle = (historyRef: React.MutableRefObject<number[]>, rawAngle: number): number | null => {
    const history = historyRef.current;
    if (history.length > 0) {
      const lastAngle = history[history.length - 1];
      if (Math.abs(rawAngle - lastAngle) > 40) {
        console.log(`[Anti-cheat] Joint angle jump of ${Math.abs(rawAngle - lastAngle).toFixed(1)}° ignored (Noise or fast motion)`);
        return null; // Ignore frame
      }
    }
    history.push(rawAngle);
    if (history.length > 3) {
      history.shift();
    }
    const sum = history.reduce((a, b) => a + b, 0);
    return sum / history.length;
  };

  const handlePoseResults = (results: any) => {
    if (!results.poseLandmarks) return;

    const landmarks = results.poseLandmarks;

    if (selectedExercise === "squat") {
      const leftHip = landmarks[23];
      const leftKnee = landmarks[25];
      const leftAnkle = landmarks[27];
      const rightHip = landmarks[24];
      const rightKnee = landmarks[26];
      const rightAnkle = landmarks[28];

      // Visibility confidence check (landmark visibility relaxed to >= 0.4)
      if (
        !leftHip || !leftKnee || !leftAnkle ||
        !rightHip || !rightKnee || !rightAnkle ||
        leftHip.visibility < 0.4 || leftKnee.visibility < 0.4 || leftAnkle.visibility < 0.4 ||
        rightHip.visibility < 0.4 || rightKnee.visibility < 0.4 || rightAnkle.visibility < 0.4
      ) {
        return;
      }

      const leftAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      const avgKneeAngleRaw = (leftAngle + rightAngle) / 2;

      const avgKneeAngle = getSmoothedAngle(kneeHistoryRef, avgKneeAngleRaw);
      if (avgKneeAngle === null) return; // Skip frame due to anti-cheat/noise

      setKneeAngles({
        left: Math.round(leftAngle),
        right: Math.round(rightAngle),
      });

      const avgHipY = (leftHip.y + rightHip.y) / 2;
      const avgKneeY = (leftKnee.y + rightKnee.y) / 2;

      const update = updateSquatCounter(
        avgKneeAngle,
        squatState,
        avgHipY,
        avgKneeY,
        lastRepTimeRef.current
      );

      if (update.repTriggered) {
        lastRepTimeRef.current = Date.now();
      }

      setSquatState(update.state);
      setRepCount(update.state.reps);
      setFeedback(update.feedback);

      // Temporary debug logging
      console.log(`[DEBUG] Knee: ${avgKneeAngle.toFixed(1)}° | Stage: ${update.state.stage}`);

    } else if (selectedExercise === "pushup") {
      const leftShoulder = landmarks[11];
      const leftElbow = landmarks[13];
      const leftWrist = landmarks[15];
      const rightShoulder = landmarks[12];
      const rightElbow = landmarks[14];
      const rightWrist = landmarks[16];
      const leftHip = landmarks[23];
      const leftAnkle = landmarks[27];
      const rightHip = landmarks[24];
      const rightAnkle = landmarks[28];

      // Visibility confidence check (relaxed keypoints visibility to >= 0.4)
      if (
        !leftShoulder || !leftWrist ||
        !rightShoulder || !rightWrist ||
        !leftHip || !leftAnkle || !rightHip || !rightAnkle
      ) {
        return;
      }

      // Check if elbow landmarks are missing or visibility is unstable (< 0.4)
      const elbowUnstable = !leftElbow || !rightElbow || leftElbow.visibility < 0.4 || rightElbow.visibility < 0.4;

      if (elbowUnstable) {
        // FALLBACK: Shoulder vertical displacement tracker
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const shHist = shoulderYHistoryRef.current;
        shHist.push(avgShoulderY);
        if (shHist.length > 20) shHist.shift();

        const minY = Math.min(...shHist);
        const maxY = Math.max(...shHist);
        const range = maxY - minY;

        // Verify clean vertical range of motion
        if (range > 0.04) {
          const thresholdDown = minY + range * 0.7;
          const thresholdUp = minY + range * 0.3;

          if (avgShoulderY > thresholdDown && pushupState.stage === "up") {
            setPushupState(prev => ({ ...prev, stage: "down" }));
            setFeedback("Good depth, now push up (shoulder tracking)");
          }
          if (avgShoulderY < thresholdUp && pushupState.stage === "down") {
            if (Date.now() - lastRepTimeRef.current > 200) {
              setPushupState(prev => ({ ...prev, stage: "up", reps: prev.reps + 1 }));
              setRepCount(r => r + 1);
              lastRepTimeRef.current = Date.now();
              setFeedback("Good rep (shoulder tracking)");
            }
          }
        }
        console.log(`[DEBUG-FALLBACK] Shoulder Y: ${avgShoulderY.toFixed(3)} | Range: ${range.toFixed(3)}`);
      } else {
        // Standard Elbow-Angle tracking
        if (
          leftShoulder.visibility < 0.4 || leftWrist.visibility < 0.4 ||
          rightShoulder.visibility < 0.4 || rightWrist.visibility < 0.4
        ) {
          return;
        }

        const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        const avgElbowAngleRaw = (leftElbowAngle + rightElbowAngle) / 2;

        const avgElbowAngle = getSmoothedAngle(elbowHistoryRef, avgElbowAngleRaw);
        if (avgElbowAngle === null) return;

        setElbowAngles({
          left: Math.round(leftElbowAngle),
          right: Math.round(rightElbowAngle),
        });

        const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftAnkle);
        const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightAnkle);
        const avgHipAngleRaw = (leftHipAngle + rightHipAngle) / 2;

        const avgHipAngle = getSmoothedAngle(hipHistoryRef, avgHipAngleRaw);
        if (avgHipAngle === null) return;

        setHipAngles({
          left: Math.round(leftHipAngle),
          right: Math.round(rightHipAngle),
        });

        const update = updatePushupCounter(
          avgElbowAngle,
          avgHipAngle,
          pushupState,
          lastRepTimeRef.current
        );

        if (update.repTriggered) {
          lastRepTimeRef.current = Date.now();
        }

        setPushupState(update.state);
        setRepCount(update.state.reps);
        setFeedback(update.feedback);

        console.log(`[DEBUG] Elbow: ${avgElbowAngle.toFixed(1)}° | Hip Align: ${avgHipAngle.toFixed(1)}° | Stage: ${update.state.stage}`);
      }

    } else if (selectedExercise === "plank") {
      const leftShoulder = landmarks[11];
      const leftHip = landmarks[23];
      const leftAnkle = landmarks[27];
      const rightShoulder = landmarks[12];
      const rightHip = landmarks[24];
      const rightAnkle = landmarks[28];

      // Visibility confidence check (relaxed keypoints visibility to >= 0.4)
      if (
        !leftShoulder || !leftHip || !leftAnkle ||
        !rightShoulder || !rightHip || !rightAnkle ||
        leftShoulder.visibility < 0.4 || leftHip.visibility < 0.4 || leftAnkle.visibility < 0.4 ||
        rightShoulder.visibility < 0.4 || rightHip.visibility < 0.4 || rightAnkle.visibility < 0.4
      ) {
        return;
      }

      const leftAngle = calculateAngle(leftShoulder, leftHip, leftAnkle);
      const rightAngle = calculateAngle(rightShoulder, rightHip, rightAnkle);
      const avgHipAngleRaw = (leftAngle + rightAngle) / 2;

      const avgHipAngle = getSmoothedAngle(hipHistoryRef, avgHipAngleRaw);
      if (avgHipAngle === null) return; // Skip frame due to anti-cheat/noise

      setHipAngles({
        left: Math.round(leftAngle),
        right: Math.round(rightAngle),
      });

      // Plank checks (Relaxed: start if > 150, stop if < 140)
      if (avgHipAngle < 140) {
        plankValidRef.current = false;
        plankStraightSinceRef.current = 0;
        setFeedback("Body not straight");
      } else if (avgHipAngle >= 150) {
        setFeedback("Hold steady");
        if (plankStraightSinceRef.current === 0) {
          plankStraightSinceRef.current = Date.now();
        } else if (Date.now() - plankStraightSinceRef.current >= 300) {
          // Resume timer after 300ms delay to prevent flicker
          plankValidRef.current = true;
        }
      }

      // Temporary debug logging
      console.log(`[DEBUG] Hip Align: ${avgHipAngle.toFixed(1)}° | Plank Valid: ${plankValidRef.current}`);
    }
  };

  const handleToggleWorkout = () => {
    if (isActive) {
      setIsActive(false);
      
      const userId = getOrCreateUserId();
      if (selectedExercise === "plank") {
        if (plankTime > 0) {
          logWorkoutApi(userId, "Plank", plankTime).catch(() => {});
          setSummaryData({
            exercise: "Plank",
            score: `${plankTime} seconds`,
            type: "duration"
          });
          setShowSummary(true);
        }
      } else {
        const finalReps = selectedExercise === "squat" ? squatState.reps : pushupState.reps;
        if (finalReps > 0) {
          logWorkoutApi(userId, selectedExercise === "squat" ? "Squats" : "Pushups", finalReps).catch(() => {});
          setSummaryData({
            exercise: selectedExercise === "squat" ? "Squats" : "Push-ups",
            score: `${finalReps} reps`,
            type: "reps"
          });
          setShowSummary(true);
        }
      }
    } else {
      // Start session
      setRepCount(0);
      setPlankTime(0);
      setFeedback("Align your body in the camera frame to begin.");
      plankValidRef.current = false;
      plankStraightSinceRef.current = 0;

      kneeHistoryRef.current = [];
      elbowHistoryRef.current = [];
      hipHistoryRef.current = [];
      shoulderYHistoryRef.current = [];
      lastRepTimeRef.current = 0;
      
      setSquatState({ reps: 0, stage: "up", lastKneeAngle: 180 });
      setPushupState({ reps: 0, stage: "up", lastElbowAngle: 180 });
      
      setKneeAngles({ left: 180, right: 180 });
      setElbowAngles({ left: 180, right: 180 });
      setHipAngles({ left: 180, right: 180 });
      
      setIsActive(true);
    }
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    setSummaryData(null);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xs font-semibold uppercase tracking-widest text-white">Workout Trainer</h1>
            <p className="text-[9px] text-gray-555 font-medium uppercase tracking-wider">Real-Time Pose Analysis</p>
          </div>
        </div>
      </div>

      {/* EXERCISE SELECTION UI */}
      {!isActive && !showSummary && (
        <div className="flex flex-col gap-1.5 max-w-sm">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Select Exercise Mode</span>
          <div className="flex p-0.5 bg-white/5 border border-white/10 rounded-xl">
            {[
              { id: "squat", label: "Squat" },
              { id: "pushup", label: "Push-up" },
              { id: "plank", label: "Plank" }
            ].map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => setSelectedExercise(exercise.id as any)}
                className={`flex-1 py-1.5 text-center rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  selectedExercise === exercise.id
                    ? "bg-emerald-500 text-black shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {exercise.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isActive && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-gray-400 font-semibold tracking-wider uppercase select-none">
          Mode Locked: End current session to switch exercises
        </div>
      )}

      {/* MAIN RENDER OR SUMMARY */}
      {showSummary && summaryData ? (
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 text-center backdrop-blur-md max-w-md mx-auto w-full space-y-5 animate-slideUp">
          <div>
            <span className="text-[8px] text-gray-505 uppercase tracking-widest font-black">Workout Completed</span>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider mt-1">{summaryData.exercise} Session</h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl py-6 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-455 uppercase font-black tracking-widest">Score Achieved</span>
            <span className="text-5xl font-black font-mono text-emerald-400 mt-2 tracking-tight">
              {summaryData.score}
            </span>
          </div>

          <p className="text-xs text-gray-305 leading-normal font-medium">
            Good job. Keep consistency.
          </p>

          <button
            onClick={handleCloseSummary}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer text-center"
          >
            Start New Session
          </button>
        </section>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 justify-center items-stretch w-full">
          {/* Left Side: Camera Container */}
          <section className="flex-1 flex flex-col justify-between gap-4">
            <CameraView isActive={isActive} onPoseResults={handlePoseResults} />
            
            <button
              type="button"
              onClick={handleToggleWorkout}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-lg ${
                isActive
                  ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/15"
                  : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/15"
              }`}
            >
              {isActive ? "End session" : `Start ${selectedExercise === "squat" ? "squats" : selectedExercise === "pushup" ? "push-up" : "plank"} detection`}
            </button>
          </section>

          {/* Right Side: Counter & Posture Tracker */}
          <section className="w-full md:w-80 flex flex-col gap-4">
            
            {/* Big Counter Card */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-xl flex flex-col justify-between items-center text-center shadow-md flex-1 min-h-[200px]">
              <div>
                <span className="text-[9px] text-gray-400 uppercase tracking-widest font-black">
                  {selectedExercise === "plank" ? "Plank duration" : `${selectedExercise === "squat" ? "Squat" : "Push-up"} reps`}
                </span>
                <div className="mt-4 flex items-baseline justify-center">
                  <span className="text-7xl font-black font-mono text-white tracking-tighter leading-none">
                    {selectedExercise === "plank" ? plankTime : repCount}
                  </span>
                  <span className="text-xs text-gray-500 font-bold ml-1">
                    {selectedExercise === "plank" ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="w-full mt-4 border-t border-white/10 pt-4">
                <div className="flex flex-col gap-2 text-xs">
                  <span className="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Real-Time Feedback</span>
                  <span className="px-2.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/5 text-gray-300 border border-white/10 min-h-[36px] flex items-center justify-center">
                    {feedback}
                  </span>
                </div>
              </div>
            </div>

            {/* Posture Tracker Details */}
            <div className="bg-white/5 border border-white/10 p-5 rounded-xl shadow-sm">
              <span className="text-[9px] text-gray-400 tracking-widest font-black mb-3.5 block uppercase">Posture Tracker</span>
              
              <div className="space-y-4">
                {selectedExercise === "squat" && (
                  <>
                    {/* Left Knee */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-455">Left Knee angle</span>
                        <span className="font-mono text-white">{kneeAngles.left}°</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (kneeAngles.left / 180) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Right Knee */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-455">Right Knee angle</span>
                        <span className="font-mono text-white">{kneeAngles.right}°</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (kneeAngles.right / 180) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[9px] text-gray-550 leading-normal border-t border-white/10 pt-3.5 mt-4">
                      Tip: Standard squats require you to drop your hips until knees bend past <span className="text-emerald-400 font-bold">120°</span>, then return to a fully straight standing posture (<span className="text-emerald-400 font-bold">&gt; 150°</span>).
                    </div>
                  </>
                )}

                {selectedExercise === "pushup" && (
                  <>
                    {/* Left Elbow */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-455">Left Elbow angle</span>
                        <span className="font-mono text-white">{elbowAngles.left}°</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (elbowAngles.left / 180) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Right Elbow */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-455">Right Elbow angle</span>
                        <span className="font-mono text-white">{elbowAngles.right}°</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (elbowAngles.right / 180) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[9px] text-gray-550 leading-normal border-t border-white/10 pt-3.5 mt-4">
                      Tip: Push-ups require you to bend your elbows past <span className="text-emerald-400 font-bold">110°</span> at the bottom, then extend fully until arms are straight (<span className="text-emerald-400 font-bold">&gt; 150°</span>).
                    </div>
                  </>
                )}

                {selectedExercise === "plank" && (
                  <>
                    {/* Left Hip Alignment */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-455">Left Hip alignment</span>
                        <span className="font-mono text-white">{hipAngles.left}°</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (hipAngles.left / 180) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Right Hip Alignment */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-455">Right Hip alignment</span>
                        <span className="font-mono text-white">{hipAngles.right}°</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (hipAngles.right / 180) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[9px] text-gray-550 leading-normal border-t border-white/10 pt-3.5 mt-4">
                      Tip: Keep your body fully straight (shoulder, hip, and ankle aligned). The hip angle should stay close to <span className="text-emerald-400 font-bold">180°</span> (target <span className="text-emerald-400 font-bold">&gt; 150°</span>).
                    </div>
                  </>
                )}
              </div>
            </div>

          </section>
        </div>
      )}
    </div>
  );
}
