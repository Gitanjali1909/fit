"use client";

import React, { useState, useEffect } from "react";
import { 
  fetchDashboardData, 
  logWorkoutApi, 
  logFoodApi, 
  logActivityApi, 
  DashboardData 
} from "@/lib/dashboardApi";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Log tabs
  const [activeLogTab, setActiveLogTab] = useState<"workout" | "food" | "activity" | null>(null);
  const [logStatus, setLogStatus] = useState<string | null>(null);

  // Workout form states
  const [workoutType, setWorkoutType] = useState("");
  const [workoutReps, setWorkoutReps] = useState("");

  // Food form states
  const [foodName, setFoodName] = useState("");
  const [foodCalories, setFoodCalories] = useState("");

  // Activity form states
  const [activityType, setActivityType] = useState("Walk");
  const [customActivityType, setCustomActivityType] = useState("");
  const [activityDuration, setActivityDuration] = useState("");
  const [activitySteps, setActivitySteps] = useState("");
  const [activityCalories, setActivityCalories] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetchDashboardData(1); // Default to user ID 1
      setData(res);
      setError(null);
    } catch (err) {
      setError("Unable to connect to database server on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    const repsNum = parseInt(workoutReps);
    if (!workoutType.trim() || isNaN(repsNum)) return;

    try {
      setLogStatus("Logging...");
      await logWorkoutApi(1, workoutType.trim(), repsNum);
      setLogStatus("Workout logged!");
      setWorkoutType("");
      setWorkoutReps("");
      setTimeout(() => setLogStatus(null), 2000);
      loadDashboard();
    } catch (err) {
      setLogStatus("Error logging workout");
    }
  };

  const handleLogFood = async (e: React.FormEvent) => {
    e.preventDefault();
    const calsNum = parseInt(foodCalories);
    if (!foodName.trim() || isNaN(calsNum)) return;

    try {
      setLogStatus("Logging...");
      await logFoodApi(1, foodName.trim(), calsNum);
      setLogStatus("Food logged!");
      setFoodName("");
      setFoodCalories("");
      setTimeout(() => setLogStatus(null), 2000);
      loadDashboard();
    } catch (err) {
      setLogStatus("Error logging food");
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationNum = parseInt(activityDuration);
    const calsNum = parseInt(activityCalories);
    const stepsNum = activitySteps ? parseInt(activitySteps) : undefined;
    
    const finalType = activityType === "Other" ? customActivityType.trim() : activityType;
    if (!finalType || isNaN(durationNum) || isNaN(calsNum)) return;

    try {
      setLogStatus("Logging...");
      await logActivityApi(1, finalType, durationNum, stepsNum, calsNum);
      setLogStatus("Activity logged!");
      setActivityDuration("");
      setActivitySteps("");
      setActivityCalories("");
      setCustomActivityType("");
      setTimeout(() => setLogStatus(null), 2000);
      loadDashboard();
    } catch (err) {
      setLogStatus("Error logging activity");
    }
  };

  const getNetCalories = () => {
    if (!data) return 0;
    return data.today_calories_in - data.today_calories_burned;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#040404] text-gray-300 font-sans selection:bg-emerald-500/20 relative overflow-hidden pb-16">
      {/* Dynamic styling to hide number input spinners globally on the page */}
      <style jsx global>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Subtle Glows */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-500/5 filter blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/5 filter blur-[100px] rounded-full pointer-events-none"></div>

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#080808]/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xs font-semibold uppercase tracking-widest text-white">Dashboard</h1>
            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">Metrics and Logs</p>
          </div>
        </div>

        <button 
          onClick={loadDashboard}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-lg text-xs font-medium text-gray-300 transition-all select-none cursor-pointer"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H12v9" />
          </svg>
          Sync
        </button>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 mt-6 flex-1 space-y-6 z-10">
        
        {error && (
          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg flex items-center justify-between">
            <span className="text-[11px] text-red-400 font-medium">{error} Showing faked database logic.</span>
            <button onClick={loadDashboard} className="text-[9px] bg-red-500/10 text-red-400 font-medium px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all">Retry</button>
          </div>
        )}

        {/* AI Insight & Adaptive Planning Card */}
        {data && (data.ai_insight || data.plan_adjustment) && (
          <div className="bg-[#080808]/90 border border-emerald-500/10 p-5 rounded-lg flex flex-col sm:flex-row gap-5 shadow-sm animate-slideUp relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 filter blur-2xl rounded-full pointer-events-none"></div>
            
            {/* Left side: AI Insight of the Day */}
            <div className="flex-1 flex gap-3">
              <span className="text-xl select-none">😈</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">AI Insight of the Day</span>
                  <span className="text-[8px] text-gray-500 uppercase font-semibold">Real-Time Evaluation</span>
                </div>
                <p className="text-xs text-gray-200 mt-1.5 leading-normal italic font-medium">
                  "{data.ai_insight || "Analyzing today's telemetry..."}"
                </p>
                {data.adaptive_insights && data.adaptive_insights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {data.adaptive_insights.map((insight, idx) => (
                      <span key={idx} className="bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold uppercase px-2 py-0.5 rounded-md">
                        {insight}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Plan Adjustment */}
            <div className="sm:w-60 border-t sm:border-t-0 sm:border-l border-white/5 pt-4 sm:pt-0 sm:pl-5 flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Plan Adjustment</span>
                <p className="text-xs font-semibold text-white mt-1">
                  {data.plan_adjustment || "Maintain current plan"}
                </p>
              </div>
              <div className="text-[9px] text-gray-500 leading-normal mt-2">
                Adapts target routine automatically to keep your progression safe.
              </div>
            </div>
          </div>
        )}

        {/* STATS MATRIX SECTION */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Daily Fitness Score */}
          <div className="bg-[#090909] border border-white/5 p-4 rounded-lg flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div>
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Metrics</span>
              <h2 className="text-sm font-semibold text-white mt-0.5">Daily Score</h2>
            </div>

            <div className="flex items-center justify-around py-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="#121212" strokeWidth="6" fill="transparent" />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#10b981"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={data ? 251.2 - (251.2 * (data.activity_score / 100)) : 75}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-bold font-mono text-white leading-none">
                    {data ? data.activity_score : "--"}
                  </span>
                  <span className="text-[8px] text-gray-500 uppercase font-medium mt-0.5">/ 100</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-500 uppercase font-bold">Net Calories</span>
                  <span className="text-sm font-semibold text-white font-mono mt-0.5">
                    {data ? getNetCalories() : 0} <span className="text-[9px] text-gray-500">kcal</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-500 uppercase font-bold">Streak</span>
                  <span className="text-xs font-semibold text-orange-400 mt-0.5">
                    🔥 5 Days
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 leading-normal">
              Score adapts in real-time as you log meals, movements, and exercises.
            </p>
          </div>

          {/* Calorie Balance Progress */}
          <div className="bg-[#090909] border border-white/5 p-4 rounded-lg flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Energy</span>
                <h2 className="text-sm font-semibold text-white mt-0.5">Calorie Balance</h2>
              </div>
              <span className="text-xs">🍱</span>
            </div>

            <div className="flex flex-col gap-3 py-3">
              {/* Calories In */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 font-medium">Intake</span>
                  <span className="font-mono text-white font-semibold">{data ? data.today_calories_in : 0} / 2000 kcal</span>
                </div>
                <div className="h-1.5 w-full bg-[#121212] rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-700" 
                    style={{ width: `${data ? Math.min(100, (data.today_calories_in / 2000) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Calories Burned */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 font-medium">Active Burn</span>
                  <span className="font-mono text-white font-semibold">{data ? data.today_calories_burned : 0} / 600 kcal</span>
                </div>
                <div className="h-1.5 w-full bg-[#121212] rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700" 
                    style={{ width: `${data ? Math.min(100, (data.today_calories_burned / 600) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] text-gray-500 border-t border-white/5 pt-2">
              <span>Goal: Deficit</span>
              <span className="text-emerald-400">{data ? Math.max(0, 600 - data.today_calories_burned) : 600} kcal to target</span>
            </div>
          </div>

          {/* Volume Summary */}
          <div className="bg-[#090909] border border-white/5 p-4 rounded-lg flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Activity</span>
                <h2 className="text-sm font-semibold text-white mt-0.5">Workout Index</h2>
              </div>
              <span className="text-xs">🏋️</span>
            </div>

            <div className="py-2 flex items-baseline gap-1 justify-center">
              <span className="text-5xl font-bold font-mono text-white tracking-tight leading-none">
                {data ? data.workouts_done : 0}
              </span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">completed</span>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-2">
              <div className="flex justify-between text-[9px] text-gray-400">
                <span>Daily Routine Target</span>
                <span className="text-white font-mono">3 sessions</span>
              </div>
              <div className="flex gap-1 h-1">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`flex-1 rounded-full transition-all duration-500 ${
                      data && data.workouts_done >= step
                        ? "bg-emerald-500 shadow-sm"
                        : "bg-[#141414]"
                    }`}
                  ></div>
                ))}
              </div>
            </div>
          </div>

        </section>

        {/* REFINED TACTILE LOGGING STATION */}
        <section className="bg-[#080808] border border-white/5 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div>
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Activity Logger</h2>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Log events in the local database</p>
            </div>
            {logStatus && (
              <span className="text-[10px] bg-emerald-955 border border-emerald-900/30 text-emerald-400 font-semibold px-2 py-0.5 rounded-md animate-fadeIn">
                {logStatus}
              </span>
            )}
          </div>

          {/* Form Tabs */}
          <div className="flex p-0.5 bg-white/5 border border-white/5 rounded-lg max-w-sm mb-5">
            {[
              { id: "workout", label: "🏋️ Workout" },
              { id: "food", label: "🍱 Food" },
              { id: "activity", label: "🏃 Activity" }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveLogTab(activeLogTab === tab.id ? null : (tab.id as any))}
                className={`flex-1 py-1.5 text-center rounded-md text-[11px] font-semibold transition-all active:scale-95 cursor-pointer ${
                  activeLogTab === tab.id
                    ? "bg-emerald-500 text-black shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Drawers */}
          {activeLogTab === "workout" && (
            <form onSubmit={handleLogWorkout} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/5 p-4 rounded-lg border border-white/5 animate-slideUp">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Exercise Name</label>
                <input
                  type="text"
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  placeholder="e.g. Pushups, Squats, Bench Press"
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-650"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Reps Count</label>
                <input
                  type="number"
                  value={workoutReps}
                  onChange={(e) => setWorkoutReps(e.target.value)}
                  placeholder="e.g. 15"
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-650 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider rounded-lg h-9 sm:mt-5.5 transition-all active:scale-95 cursor-pointer"
              >
                Save Workout
              </button>
            </form>
          )}

          {activeLogTab === "food" && (
            <form onSubmit={handleLogFood} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/5 p-4 rounded-lg border border-white/5 animate-slideUp">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Food Item Name</label>
                <input
                  type="text"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g. Grilled Chicken breast"
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Calories (kcal)</label>
                <input
                  type="number"
                  value={foodCalories}
                  onChange={(e) => setFoodCalories(e.target.value)}
                  placeholder="e.g. 350"
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider rounded-lg h-9 sm:mt-5.5 transition-all active:scale-95 cursor-pointer"
              >
                Save Food
              </button>
            </form>
          )}

          {activeLogTab === "activity" && (
            <form onSubmit={handleLogActivity} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white/5 p-4 rounded-lg border border-white/5 animate-slideUp">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Activity Mode</label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                >
                  <option value="Walk">Walk 🚶</option>
                  <option value="Run">Run 🏃</option>
                  <option value="Cycling">Cycling 🚴</option>
                  <option value="Other">Other...</option>
                </select>
              </div>

              {activityType === "Other" && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Activity Name</label>
                  <input
                    type="text"
                    value={customActivityType}
                    onChange={(e) => setCustomActivityType(e.target.value)}
                    placeholder="Enter activity name"
                    className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Duration (min)</label>
                <input
                  type="number"
                  value={activityDuration}
                  onChange={(e) => setActivityDuration(e.target.value)}
                  placeholder="e.g. 30"
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Steps Count</label>
                <input
                  type="number"
                  value={activitySteps}
                  onChange={(e) => setActivitySteps(e.target.value)}
                  placeholder="e.g. 5000"
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Calories Burned</label>
                <input
                  type="number"
                  value={activityCalories}
                  onChange={(e) => setActivityCalories(e.target.value)}
                  placeholder="e.g. 150"
                  className="bg-[#121212] border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider rounded-lg h-9 sm:mt-5.5 lg:col-span-1 transition-all active:scale-95 cursor-pointer"
              >
                Save Activity
              </button>
            </form>
          )}

          {/* Quick Suggestions */}
          {!activeLogTab && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
              {[
                { label: "10 Squats", cat: "workout", action: () => { setWorkoutType("Squats"); setWorkoutReps("10"); setActiveLogTab("workout"); } },
                { label: "Banana (105 kcal)", cat: "food", action: () => { setFoodName("Banana"); setFoodCalories("105"); setActiveLogTab("food"); } },
                { label: "Fast Walk (150 kcal)", cat: "activity", action: () => { setActivityType("Walk"); setActivityDuration("30"); setActivityCalories("150"); setActiveLogTab("activity"); } },
                { label: "15 Pushups", cat: "workout", action: () => { setWorkoutType("Pushups"); setWorkoutReps("15"); setActiveLogTab("workout"); } }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="p-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-lg text-left transition-all group flex flex-col justify-between h-16"
                >
                  <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{item.cat}</span>
                  <span className="text-[11px] font-semibold text-white group-hover:text-emerald-400 transition-colors">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}