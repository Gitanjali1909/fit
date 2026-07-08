"use client";

import React, { useRef, useEffect, useState } from "react";
import { initPose } from "@/lib/pose";

interface CameraViewProps {
  isActive: boolean;
  onPoseResults: (results: any) => void;
}

export default function CameraView({ isActive, onPoseResults }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<any>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Pose model
  useEffect(() => {
    let active = true;

    async function loadPose() {
      if (!isActive) return;
      setIsLoading(true);
      setError(null);

      try {
        const pose = await initPose();
        if (!active) return;
        
        if (pose) {
          pose.onResults((results: any) => {
            if (!active) return;
            onPoseResults(results);
            drawFullBodySkeleton(results);
          });
          poseRef.current = pose;
        }
      } catch (err) {
        setError("Failed to initialize MediaPipe Pose model.");
      } finally {
        setIsLoading(false);
      }
    }

    loadPose();

    return () => {
      active = false;
      if (poseRef.current) {
        poseRef.current.close();
        poseRef.current = null;
      }
    };
  }, [isActive]);

  // Handle webcam stream and process frames
  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (!isActive || !videoRef.current) return;
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            aspectRatio: 4/3,
            facingMode: "user" 
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        activeStreamRef.current = stream;

        // Custom high-performance requestAnimationFrame loop to send frames to MediaPipe
        const processFrame = async () => {
          if (!active || !videoRef.current || !isActive) return;

          if (videoRef.current.readyState >= 3 && poseRef.current) {
            try {
              await poseRef.current.send({ image: videoRef.current });
            } catch (err) {
              // Ignore frame errors
            }
          }
          animationFrameRef.current = requestAnimationFrame(processFrame);
        };

        animationFrameRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        setError("Webcam access denied. Please grant camera permission.");
      }
    }

    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      active = false;
      stopCamera();
    };
  }, [isActive, isLoading]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    clearCanvas();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Draw full body skeleton (ears, eyes, shoulders, arms, torso, and legs)
  const drawFullBodySkeleton = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) return;

    const landmarks = results.poseLandmarks;
    const w = canvas.width;
    const h = canvas.height;

    // Draw connecting lines with high visibility
    const drawLine = (p1: number, p2: number, color = "#10b981", width = 3) => {
      const pt1 = landmarks[p1];
      const pt2 = landmarks[p2];
      if (pt1 && pt2 && pt1.visibility > 0.5 && pt2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(pt1.x * w, pt1.y * h);
        ctx.lineTo(pt2.x * w, pt2.y * h);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    };

    // --- DRAW BODY CONNECTIONS ---
    
    // Head / Face details (eyes, nose, mouth)
    drawLine(0, 1, "#ffffff", 1); // nose to left eye
    drawLine(0, 4, "#ffffff", 1); // nose to right eye
    drawLine(7, 8, "#ffffff", 1); // left ear to right ear

    // Shoulders & Torso
    drawLine(11, 12, "#10b981", 4); // Left shoulder to Right shoulder
    drawLine(11, 23, "#10b981", 3); // Left shoulder to Left hip
    drawLine(12, 24, "#10b981", 3); // Right shoulder to Right hip
    drawLine(23, 24, "#10b981", 4); // Left hip to Right hip

    // Left Arm
    drawLine(11, 13, "#34d399", 3); // Shoulder to Elbow
    drawLine(13, 15, "#34d399", 3); // Elbow to Wrist

    // Right Arm
    drawLine(12, 14, "#34d399", 3); // Shoulder to Elbow
    drawLine(14, 16, "#34d399", 3); // Elbow to Wrist

    // Left Leg
    drawLine(23, 25, "#059669", 4); // Hip to Knee
    drawLine(25, 27, "#059669", 4); // Knee to Ankle

    // Right Leg
    drawLine(24, 26, "#059669", 4); // Hip to Knee
    drawLine(26, 28, "#059669", 4); // Knee to Ankle

    // --- DRAW LANDMARK KEYPOINT DOTS ---
    // Render keypoints for nose, shoulders, elbows, wrists, hips, knees, ankles
    const keyJoints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    
    keyJoints.forEach((idx) => {
      const pt = landmarks[idx];
      if (pt && pt.visibility > 0.5) {
        ctx.beginPath();
        // Nose dot is smaller, joints are larger
        const radius = idx === 0 ? 3 : 5;
        ctx.arc(pt.x * w, pt.y * h, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = idx === 0 ? "#ffffff" : "#10b981";
        ctx.stroke();
      }
    });
  };

  return (
    <div className="relative w-full aspect-video max-w-xl mx-auto bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* Video stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />

      {/* Canvas overlays */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#050505]/90 flex flex-col items-center justify-center gap-3 z-25 animate-fadeIn">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></span>
          </div>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Initializing Pose Engine</span>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center p-6 text-center z-20">
          <span className="text-xl mb-2">⚠️</span>
          <p className="text-xs text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {/* Idle Overlay */}
      {!isActive && !isLoading && !error && (
        <div className="absolute inset-0 bg-[#050505]/90 flex flex-col items-center justify-center z-20">
          <span className="text-4xl mb-3">🎥</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Camera Offline</span>
        </div>
      )}
    </div>
  );
}
