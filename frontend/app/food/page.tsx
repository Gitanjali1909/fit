"use client";

import React, { useState, useRef, useEffect } from "react";
import { API } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";

interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
}

interface FoodResult {
  items: FoodItem[];
  total_calories: number;
  suggestion: string;
  logged?: boolean;
}

export default function FoodPage() {
  const [tab, setTab] = useState<"scan" | "upload" | "manual">("scan");
  const [foodInput, setFoodInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FoodResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Camera stream states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setStreamActive(true);
      }
    } catch (err) {
      setCameraError("Camera access failed. Ensure permission is granted or switch to upload/manual input.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStreamActive(false);
    }
  };

  useEffect(() => {
    if (tab === "scan") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [tab]);

  const handleManualAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodInput.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const userId = getOrCreateUserId();
      const res = await fetch(`${API}/food/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ food: foodInput.trim(), user_id: userId }),
      });

      if (!res.ok) throw new Error("Estimation failed");

      const data: FoodResult = await res.json();
      setResult(data);
    } catch (err) {
      setError("AI estimation failed. Using offline backup estimate.");
      setResult({
        items: [{ name: foodInput.trim(), quantity: "1 serving", calories: 380 }],
        total_calories: 380,
        suggestion: "Estimated using offline fallbacks. Check your server connection.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScanAnalyze = async () => {
    if (loading) return;
    
    if (!videoRef.current || !canvasRef.current) {
      setError("No active video feed found.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setError("Canvas context error.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.8);

      await runImageAnalysis(base64);
    } catch (err) {
      setError("Failed to capture snapshot. Check camera settings.");
      setLoading(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAnalyze = async () => {
    if (!selectedImage || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    await runImageAnalysis(selectedImage);
  };

  const runImageAnalysis = async (base64Data: string) => {
    try {
      const userId = getOrCreateUserId();
      const res = await fetch(`${API}/food/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Data, user_id: userId }),
      });

      if (!res.ok) throw new Error("Vision estimation failed");

      const data: FoodResult = await res.json();
      setResult(data);
    } catch (err) {
      setError("Failed to analyze image. Showing offline scan fallback.");
      setResult({
        items: [{ name: "Scanned Food", quantity: "1 serving", calories: 420 }],
        total_calories: 420,
        suggestion: "AI fallback activated. Verify your server connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    setResult(null);
    setError(null);
    setFoodInput("");
    setSelectedImage(null);
    if (tab === "scan") {
      startCamera();
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xs font-semibold uppercase tracking-widest text-white">Food Scanner</h1>
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">Nutrition Calculator</p>
        </div>
      </div>

      {/* THREE-WAY TOGGLER */}
      <div className="flex p-0.5 bg-white/5 border border-white/10 rounded-xl max-w-sm">
        {[
          { id: "scan", label: "📸 Scan" },
          { id: "upload", label: "🖼️ Upload" },
          { id: "manual", label: "✍️ Manual" }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { 
              setTab(item.id as any); 
              setResult(null); 
              setError(null); 
              setSelectedImage(null); 
            }}
            className={`flex-1 py-1.5 text-center rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
              tab === item.id
                ? "bg-emerald-500 text-black shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ERROR TOAST - Premium Glassmorphism */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex items-center justify-between text-xs text-red-400 backdrop-blur-md animate-slideUp">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-[10px] uppercase font-bold text-gray-450 hover:text-white px-2 py-0.5 rounded border border-white/10"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. CAMERA SCAN PANEL */}
      {tab === "scan" && !result && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md space-y-4 relative overflow-hidden shadow-none flex flex-col items-center">
          {cameraError ? (
            <div className="text-center py-8 text-xs text-gray-400 space-y-2 max-w-xs">
              <span className="text-2xl block">📷</span>
              <p>{cameraError}</p>
              <button 
                onClick={startCamera}
                className="mt-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                Retry Camera Access
              </button>
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/5 flex items-center justify-center">
              <video 
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              
              <div className="absolute inset-8 border border-dashed border-emerald-500/30 rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-[8px] uppercase tracking-widest text-emerald-400/50 bg-black/40 px-2 py-0.5 rounded">
                  Center food item
                </span>
              </div>

              {!streamActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-xs text-gray-500">
                  Initializing camera feed...
                </div>
              )}
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          <button
            onClick={handleScanAnalyze}
            disabled={loading || !streamActive}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-gray-600 text-black font-semibold text-xs uppercase tracking-wider py-3 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-spin" />
                <span>Analyzing Meal...</span>
              </>
            ) : (
              <span>📸 Capture & Analyze</span>
            )}
          </button>
        </section>
      )}

      {/* 2. IMAGE UPLOAD PANEL */}
      {tab === "upload" && !result && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md space-y-4 shadow-none flex flex-col items-center">
          <div className="w-full relative min-h-[180px] rounded-xl border border-dashed border-white/15 bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center p-5 text-center">
            {selectedImage ? (
              <div className="relative w-full max-h-[220px] rounded-lg overflow-hidden flex items-center justify-center">
                <img 
                  src={selectedImage} 
                  alt="Food snapshot preview" 
                  className="max-w-full max-h-[200px] object-contain rounded-lg"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-550 border border-red-500/20 text-white rounded-full p-1.5 text-xs select-none cursor-pointer"
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center py-6">
                <span className="text-3xl mb-2">🖼️</span>
                <span className="text-xs font-semibold text-white">Select Food Photo</span>
                <span className="text-[9px] text-gray-500 mt-1">Supports JPEG, PNG</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <button
            onClick={handleUploadAnalyze}
            disabled={loading || !selectedImage}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-gray-600 text-black font-semibold text-xs uppercase tracking-wider py-3 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-spin" />
                <span>Analyzing Meal...</span>
              </>
            ) : (
              <span>Analyze Uploaded Image</span>
            )}
          </button>
        </section>
      )}

      {/* 3. MANUAL INPUT FORM */}
      {tab === "manual" && !result && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md shadow-none">
          <form onSubmit={handleManualAnalyze} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="food-input" className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                What did you eat?
              </label>
              <input
                id="food-input"
                type="text"
                value={foodInput}
                onChange={(e) => setFoodInput(e.target.value)}
                placeholder="e.g. 2 boiled eggs and 1 slice of whole wheat toast"
                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-gray-650"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !foodInput.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-gray-600 text-black font-semibold text-xs uppercase tracking-wider py-3 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.4s]"></span>
                </>
              ) : (
                "Analyze Meal"
              )}
            </button>
          </form>
        </section>
      )}

      {/* RESULTS DISPLAY PANEL */}
      {result && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md shadow-none animate-slideUp space-y-5">
          <div className="flex justify-between items-start border-b border-white/10 pb-3">
            <div>
              <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Estimated Profile</span>
              <h2 className="text-sm font-semibold text-white capitalize mt-0.5">Meal Nutrition Breakdown</h2>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-500/20 uppercase tracking-wider">
              Food Tracked
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Detected Items</span>
            {result.items && result.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs">
                <div className="flex flex-col">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="text-[9px] text-gray-500 mt-0.5">{item.quantity}</span>
                </div>
                <span className="text-emerald-400 font-mono font-bold">{item.calories} kcal</span>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] text-gray-450 uppercase tracking-widest font-black">Total Calories</span>
              <p className="text-[10px] text-gray-500 leading-normal">Sum of portion calculations</p>
            </div>
            <div className="flex items-baseline gap-0.5 text-right">
              <span className="text-4xl font-black font-mono text-emerald-400 tracking-tight">
                {result.total_calories}
              </span>
              <span className="text-[10px] text-gray-500 uppercase font-bold">kcal</span>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl flex items-start gap-2.5">
            <span className="text-sm select-none">💡</span>
            <div className="flex flex-col">
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">AI Nutrition Tip</span>
              <p className="text-xs text-gray-300 leading-relaxed mt-1">{result.suggestion}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleTryAgain}
              className="w-full py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer text-center"
            >
              Analyze Another Meal
            </button>
            <p className="text-[9px] text-gray-550 text-center italic">
              * Calories are calculated using standard values.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
