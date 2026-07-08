"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { calculateAngle, updateSquatCounter, SquatState } from "@/lib/repCounter";

// Dynamically import CameraView with SSR disabled to prevent Next.js server-side build crashes
const CameraView = dynamic(() => import("@/components/CameraView"), { ssr: false });

export default function WorkoutPage() {
  const [isActive, setIsActive] = useState(false);
  const [kneeAngles, setKneeAngles] = useState({ left: 180, right: 180 });
  const [squatState, setSquatState] = useState<SquatState>({
    reps: 0,
    stage: "up",
    lastKneeAngle: 180,
  });

  const handlePoseResults = (results: any) => {
    if (!results.poseLandmarks) return;

    const landmarks = results.poseLandmarks;
    
    // Landmark index references:
    // Left: Hip (23), Knee (25), Ankle (27)
    // Right: Hip (24), Knee (26), Ankle (28)
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];

    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];

    // Verify keypoints visibility is high enough before calculating reps
    if (
      leftHip && leftKnee && leftAnkle &&
      rightHip && rightKnee && rightAnkle &&
      leftKnee.visibility > 0.5 && rightKnee.visibility > 0.5
    ) {
      const leftAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

      setKneeAngles({
        left: Math.round(leftAngle),
        right: Math.round(rightAngle),
      });

      setSquatState((prev) => updateSquatCounter(leftAngle, rightAngle, prev));
    }
  };

  const handleToggleWorkout = () => {
    if (isActive) {
      setIsActive(false);
    } else {
      // Reset counter states upon start
      setSquatState({ reps: 0, stage: "up", lastKneeAngle: 180 });
      setKneeAngles({ left: 180, right: 180 });
      setIsActive(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#030303] text-gray-250 font-sans selection:bg-emerald-500/20 relative overflow-hidden pb-16">
      {/* Subtle top glow */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent filter blur-3xl pointer-events-none"></div>

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#080808]/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 animate-pulse">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xs font-semibold uppercase tracking-widest text-white">Workout Vision</h1>
            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">Squat Detection Protocol</p>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 mt-8 flex flex-col md:flex-row gap-6 justify-center items-stretch z-10">
        
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
            {isActive ? "End session" : "Start squats detection"}
          </button>
        </section>

        {/* Right Side: Reps Counter & Status Panels */}
        <section className="w-full md:w-80 flex flex-col gap-4">
          
          {/* Big Reps Counter Card */}
          <div className="bg-[#080808] border border-white/5 p-6 rounded-2xl flex flex-col justify-between items-center text-center shadow-md flex-1 min-h-[220px]">
            <div>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Squat reps</span>
              <div className="mt-4 flex items-baseline justify-center">
                <span className="text-7xl font-black font-mono text-white tracking-tighter leading-none">
                  {squatState.reps}
                </span>
              </div>
            </div>

            <div className="w-full mt-4 border-t border-white/5 pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Position State</span>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  squatState.stage === "down" 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : "bg-white/5 text-gray-400 border border-white/5"
                }`}>
                  {squatState.stage === "down" ? "Squatting (Bent)" : "Standing (Up)"}
                </span>
              </div>
            </div>
          </div>

          {/* Knee Angles Data Panel */}
          <div className="bg-[#080808] border border-white/5 p-5 rounded-2xl shadow-sm">
            <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black mb-3.5 block">Joint Angles Matrix</span>
            
            <div className="space-y-4">
              {/* Left Knee */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-400">Left Knee angle</span>
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
                  <span className="text-gray-400">Right Knee angle</span>
                  <span className="font-mono text-white">{kneeAngles.right}°</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (kneeAngles.right / 180) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="text-[9px] text-gray-500 leading-normal border-t border-white/5 pt-3.5 mt-4">
              Tip: Standard squats require you to drop your hips until knees bend past <span className="text-emerald-400 font-bold">110°</span>, then return to a fully straight standing posture (<span className="text-emerald-400 font-bold">&gt; 160°</span>).
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
