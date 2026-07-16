"use client";

import React, { useState, useEffect } from "react";
import { 
  fetchDashboardData, 
  logWorkoutApi, 
  logFoodApi, 
  logActivityApi, 
  resetTodayApi,
  deleteFoodLogApi,
  deleteLogApi,
  DashboardData 
} from "@/lib/dashboardApi";
import { getOrCreateUserId } from "@/lib/user";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  // Quick Log tabs
  const [activeLogTab, setActiveLogTab] = useState<"workout" | "food" | "activity" | null>(null);
  const [logStatus, setLogStatus] = useState<string | null>(null);

  const formatWorkoutDisplay = (type: string, reps: number) => {
    const clean = type.trim().toLowerCase();
    let display = type;
    
    if (clean === "pushup" || clean === "pushups" || clean === "push-up" || clean === "push-ups") {
      display = "Pushups";
    } else if (clean === "squat" || clean === "squats") {
      display = "Squats";
    } else if (clean === "pullup" || clean === "pullups" || clean === "pull-up" || clean === "pull-ups") {
      display = "Pullups";
    } else if (clean === "lunge" || clean === "lunges") {
      display = "Lunges";
    } else if (clean === "situp" || clean === "situps" || clean === "sit-up" || clean === "sit-ups") {
      display = "Situps";
    } else if (clean === "plank" || clean === "planks") {
      display = "Planks";
    } else {
      const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
      display = capitalized.endsWith("s") ? capitalized : capitalized + "s";
    }
    
    return `${display} – ${reps} reps`;
  };

  const handleDeleteLog = async (logType: "workout" | "food" | "activity", logId: number) => {
    if (deletingIds.includes(logId)) return;
    setDeletingIds((prev) => [...prev, logId]);

    const previousData = data ? { ...data } : null;

    // Optimistic Update
    if (data) {
      const updated = { ...data };
      if (logType === "food") {
        const item = data.food.find((f) => f.id === logId);
        const cals = item ? item.calories : 0;
        updated.today_calories_in = Math.max(0, data.today_calories_in - cals);
        updated.calories_in = Math.max(0, data.calories_in - cals);
        updated.food = data.food.filter((f) => f.id !== logId);
      } else if (logType === "workout") {
        const item = data.workouts.find((w) => w.id === logId);
        const reps = item ? item.reps : 0;
        updated.workouts_done = Math.max(0, data.workouts_done - 1);
        updated.reps = Math.max(0, data.reps - reps);
        updated.workouts = data.workouts.filter((w) => w.id !== logId);
      } else if (logType === "activity") {
        const item = data.activity.find((a) => a.id === logId);
        const cals_out = item ? item.calories_burned : 0;
        const steps = item && item.steps ? item.steps : 0;
        updated.today_calories_burned = Math.max(0, data.today_calories_burned - cals_out);
        updated.calories_out = Math.max(0, data.calories_out - cals_out);
        updated.steps = Math.max(0, data.steps - steps);
        updated.activity = data.activity.filter((a) => a.id !== logId);
      }
      setData(updated);
    }

    try {
      setLogStatus(`Removing ${logType}...`);
      await deleteLogApi(logType, logId);
      setLogStatus("Item removed successfully!");
      setTimeout(() => setLogStatus(null), 2000);
      
      // Fetch fresh data from backend to ensure score calculation is synced
      const userId = getOrCreateUserId();
      const res = await fetchDashboardData(userId); 
      setData(res);
    } catch (err) {
      setLogStatus("Error removing log");
      setTimeout(() => setLogStatus(null), 2000);
      if (previousData) {
        setData(previousData);
      }
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== logId));
    }
  };

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

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(false);
      const userId = getOrCreateUserId();
      const res = await fetchDashboardData(userId); 
      setData(res);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleResetToday = async () => {
    if (!confirm("Are you sure you want to clear all logs recorded today? This cannot be undone.")) return;
    try {
      setLoading(true);
      const userId = getOrCreateUserId();
      await resetTodayApi(userId);
      setLogStatus("Today's data reset!");
      setTimeout(() => setLogStatus(null), 2000);
      loadDashboard();
    } catch (err) {
      setLogStatus("Error resetting logs");
    } finally {
      setLoading(false);
    }
  };

  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    const repsNum = parseInt(workoutReps);
    if (!workoutType.trim() || isNaN(repsNum)) return;

    try {
      setLogStatus("Logging...");
      const userId = getOrCreateUserId();
      await logWorkoutApi(userId, workoutType.trim(), repsNum);
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
      const userId = getOrCreateUserId();
      await logFoodApi(userId, foodName.trim(), calsNum);
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
    const stepsNum = activitySteps ? parseInt(activitySteps) : undefined;
    
    const finalType = activityType === "Other" ? customActivityType.trim() : activityType;
    if (!finalType || isNaN(durationNum)) return;

    try {
      setLogStatus("Logging...");
      const userId = getOrCreateUserId();
      // Pass undefined for calories so backend calculates it using weight and MET values
      await logActivityApi(userId, finalType, durationNum, stepsNum, undefined);
      setLogStatus("Activity logged!");
      setActivityDuration("");
      setActivitySteps("");
      setCustomActivityType("");
      setTimeout(() => setLogStatus(null), 2000);
      loadDashboard();
    } catch (err) {
      setLogStatus("Error logging activity");
    }
  };

  // Safe aggregated value mapping
  const score = data ? data.activity_score : 0;
  const calsIn = data ? data.today_calories_in : 0;
  const calsOut = data ? data.today_calories_burned : 0;
  const netCals = calsIn - calsOut;
  const workoutsCount = data ? data.workouts_done : 0;
  const totalReps = data ? data.reps : 0;
  const dailySteps = data ? data.steps : 0;
  const hasData = data && data.has_data;

  // Score breakdown calculations read directly from backend
  const workoutPoints = data?.score_breakdown?.workout ?? 0;
  const dietPoints = data?.score_breakdown?.diet ?? 0;
  const stepsPoints = data?.score_breakdown?.steps ?? 0;
  const scoreExplanation = data?.score_explanation ?? "";

  return (
    <div className="flex flex-col gap-3 w-full max-w-3xl mx-auto px-4">
      {/* TOP HEADER / GREETINGS */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Hey Champion 👋</h2>
          <p className="text-[10px] text-gray-500 font-medium">Here is your daily fitness digest.</p>
        </div>

        <div className="flex items-center gap-2">
          {hasData && (
            <button 
              onClick={handleResetToday}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/20 rounded-xl text-[10px] font-semibold text-red-400 transition-all select-none cursor-pointer disabled:opacity-50"
            >
              Reset Today
            </button>
          )}

          <button 
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 transition-all select-none cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H12v9" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center backdrop-blur-md shadow-none">
          <span className="text-2xl mb-2 block">📋</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Connection status</h3>
          <p className="text-[11px] text-gray-500 mt-1">Unable to load dashboard data. Check backend connection.</p>
        </div>
      )}

      {/* CONDITIONAL RENDER: Empty state vs Real statistics */}
      {!hasData ? (
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 text-center backdrop-blur-md shadow-none flex flex-col items-center justify-center gap-2">
          <span className="text-3xl mb-1 select-none">🎯</span>
          <h3 className="text-sm font-bold text-white tracking-tight">No activity logged today</h3>
          <p className="text-[11px] text-gray-500 max-w-xs leading-normal">
            Start by adding your first workout, meal, or activity below.
          </p>
        </section>
      ) : (
        <>
          {/* Daily Fitness Score */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md relative overflow-hidden shadow-none flex flex-col gap-4">
            <div className="flex items-center justify-between w-full">
              <div className="space-y-1.5">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Daily Fitness Score</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-5xl font-black font-mono text-emerald-400 leading-none">
                    {score}
                  </span>
                  <span className="text-xs text-gray-500 font-bold">/100</span>
                </div>
                <p className="text-[10px] text-gray-400 max-w-[240px] leading-relaxed font-medium">
                  {scoreExplanation || "Start recording today to build up your fitness score."}
                </p>
              </div>

              {/* Progress Circle SVG */}
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.03)" strokeWidth="5.5" fill="transparent" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="#10b981"
                    strokeWidth="5.5"
                    fill="transparent"
                    strokeDasharray="201"
                    strokeDashoffset={201 - (201 * (score / 100))}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <span className="absolute text-[9px] font-bold text-gray-450 uppercase tracking-widest">Score</span>
              </div>
            </div>

            {/* Score Breakdown Dropdown Panel */}
            <div className="border-t border-white/10 pt-3">
              <button 
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-[9px] text-emerald-450 hover:text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5 select-none cursor-pointer transition-colors"
              >
                <span>{showBreakdown ? "Hide Score Breakdown ▲" : "Show Score Breakdown ▼"}</span>
              </button>

              {showBreakdown && (
                <div className="mt-3 text-[10px] text-gray-400 space-y-2 animate-slideUp">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <span className="flex items-center gap-1.5">🏋️ Workout Volume</span>
                    <span className="font-mono text-white font-bold">+{workoutPoints} pts</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <span className="flex items-center gap-1.5">🍱 Diet & Calories</span>
                    <span className="font-mono text-white font-bold">+{dietPoints} pts</span>
                  </div>
                  <div className="flex justify-between items-center pb-0.5">
                    <span className="flex items-center gap-1.5">🏃 Steps Volume</span>
                    <span className="font-mono text-white font-bold">+{stepsPoints} pts</span>
                  </div>
                  <p className="text-[9px] text-gray-550 pt-1 leading-normal italic">
                    Breakdown rules: Workout = up to 40 pts (target 50 reps); Diet = up to 40 pts (target &le; 2000 kcal); Steps = up to 20 pts (target 8000 steps).
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Metrics Grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Calories Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col justify-between h-32 shadow-none">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Calories Balance</span>
                <span className="text-xs">🍱</span>
              </div>
              <div>
                <div className="flex items-baseline gap-0.5 mt-2">
                  <span className="text-3xl font-bold font-mono text-white">
                    {netCals}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">net kcal</span>
                </div>
                <div className="flex justify-between text-[9px] text-gray-555 mt-2.5">
                  <span>In: {calsIn} kcal</span>
                  <span>Out: {calsOut} kcal</span>
                </div>
              </div>
            </div>

            {/* Workouts Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col justify-between h-32 shadow-none">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Workout Sessions</span>
                <span className="text-xs">🏋️</span>
              </div>
              <div>
                <div className="flex items-baseline gap-0.5 mt-2">
                  <span className="text-3xl font-bold font-mono text-white">
                    {workoutsCount}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">completed</span>
                </div>
                <p className="text-[9px] text-gray-555 mt-2.5">
                  {totalReps > 0 ? `${totalReps} total reps logged today.` : "No reps logged today."}
                </p>
              </div>
            </div>

            {/* Steps/Activity Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col justify-between h-32 shadow-none">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Daily steps</span>
                <span className="text-xs">🚶</span>
              </div>
              <div>
                <div className="flex items-baseline gap-0.5 mt-2">
                  <span className="text-3xl font-bold font-mono text-white">
                    {dailySteps}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">steps</span>
                </div>
                <p className="text-[9px] text-gray-555 mt-2.5">
                  Target: 8,000 steps baseline.
                </p>
              </div>
            </div>

          </section>

          {/* Today's Logs Dynamic List */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md space-y-3.5 shadow-none">
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Today's Logs</h2>
              <p className="text-[9px] text-gray-550 font-medium">Items you recorded today</p>
            </div>
            
            <div className="flex flex-col gap-2">
              {data.workouts && data.workouts.map((w) => (
                <div key={`w-${w.id}`} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs group transition-all">
                  <span className="font-semibold text-white">🏋️ {formatWorkoutDisplay(w.type, w.reps)}</span>
                  <button
                    onClick={() => handleDeleteLog("workout", w.id)}
                    disabled={deletingIds.includes(w.id)}
                    className="text-red-400/50 hover:text-red-400 hover:scale-105 active:scale-95 transition-all p-1 cursor-pointer select-none disabled:opacity-30"
                    title="Remove workout log"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              
              {data.food && data.food.map((f) => (
                <div key={`f-${f.id}`} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs group transition-all">
                  <span className="font-semibold text-white">🍱 {f.food_name}</span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-emerald-400 font-mono font-bold">+{f.calories} kcal</span>
                    <button
                      onClick={() => handleDeleteLog("food", f.id)}
                      disabled={deletingIds.includes(f.id)}
                      className="text-red-400/50 hover:text-red-400 hover:scale-105 active:scale-95 transition-all p-1 cursor-pointer select-none disabled:opacity-30"
                      title="Remove food log"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              
              {data.activity && data.activity.map((a) => (
                <div key={`a-${a.id}`} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs group transition-all">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">🏃 {a.activity_type.charAt(0).toUpperCase() + a.activity_type.slice(1)}</span>
                    {a.steps && a.steps > 0 ? (
                      <span className="text-[9px] text-gray-500 mt-0.5">{a.steps.toLocaleString()} steps</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <span className="text-red-400 font-mono font-bold">-{a.calories_burned} kcal</span>
                      <span className="block text-[9px] text-gray-500 mt-0.5">{a.duration} min</span>
                    </div>
                    <button
                      onClick={() => handleDeleteLog("activity", a.id)}
                      disabled={deletingIds.includes(a.id)}
                      className="text-red-400/50 hover:text-red-400 hover:scale-105 active:scale-95 transition-all p-1 cursor-pointer select-none disabled:opacity-30"
                      title="Remove activity log"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* TACTILE LOGGER DRAWER */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md shadow-none">
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Activity Logger</h2>
            <p className="text-[9px] text-gray-555 font-medium">Log your meals, reps, and steps manually</p>
          </div>
          {logStatus && (
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 font-semibold px-2 py-0.5 rounded-lg">
              {logStatus}
            </span>
          )}
        </div>

        {/* Form Selector Tabs */}
        <div className="flex p-0.5 bg-white/5 border border-white/10 rounded-xl max-w-sm mb-5">
          {[
            { id: "workout", label: "🏋️ Workout" },
            { id: "food", label: "🍱 Food" },
            { id: "activity", label: "🏃 Activity" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveLogTab(activeLogTab === tab.id ? null : (tab.id as any))}
              className={`flex-1 py-1.5 text-center rounded-lg text-[11px] font-semibold transition-all active:scale-95 cursor-pointer ${
                activeLogTab === tab.id
                  ? "bg-emerald-500 text-black shadow-sm"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Workout Form */}
        {activeLogTab === "workout" && (
          <form onSubmit={handleLogWorkout} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/5 p-4 rounded-xl border border-white/10 animate-slideUp">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Exercise Name</label>
              <input
                type="text"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                placeholder="e.g. Squats, Pushups"
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Reps Completed</label>
              <input
                type="number"
                value={workoutReps}
                onChange={(e) => setWorkoutReps(e.target.value)}
                placeholder="e.g. 15"
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider rounded-lg h-9 sm:mt-5 transition-all active:scale-95 cursor-pointer"
            >
              Save Workout
            </button>
          </form>
        )}

        {/* Food Form */}
        {activeLogTab === "food" && (
          <form onSubmit={handleLogFood} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/5 p-4 rounded-xl border border-white/10 animate-slideUp">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Food Name</label>
              <input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g. Protein shake"
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Calories (kcal)</label>
              <input
                type="number"
                value={foodCalories}
                onChange={(e) => setFoodCalories(e.target.value)}
                placeholder="e.g. 250"
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider rounded-lg h-9 sm:mt-5 transition-all active:scale-95 cursor-pointer"
            >
              Save Food
            </button>
          </form>
        )}

        {/* Activity Form */}
        {activeLogTab === "activity" && (
          <form onSubmit={handleLogActivity} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/5 p-4 rounded-xl border border-white/10 animate-slideUp">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Activity Mode</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full bg-zinc-900 text-white border border-white/10 rounded-lg p-2 focus:outline-none text-xs cursor-pointer"
              >
                <option value="Walk">Walk 🚶</option>
                <option value="Run">Run 🏃</option>
                <option value="Cycling">Cycling 🚴</option>
                <option value="Skipping">Skipping 🦘</option>
                <option value="Other">Other...</option>
              </select>
            </div>

            {activityType === "Other" && (
              <div className="flex flex-col gap-1.5 animate-fadeIn">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Activity Name</label>
                <input
                  type="text"
                  value={customActivityType}
                  onChange={(e) => setCustomActivityType(e.target.value)}
                  placeholder="Enter activity name"
                  className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655"
                  required
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Duration (min)</label>
              <input
                type="number"
                value={activityDuration}
                onChange={(e) => setActivityDuration(e.target.value)}
                placeholder="e.g. 30"
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Steps Count (Optional)</label>
              <input
                type="number"
                value={activitySteps}
                onChange={(e) => setActivitySteps(e.target.value)}
                placeholder="Steps (optional)"
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-655 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase tracking-wider rounded-lg h-9 sm:mt-5 lg:col-span-1 transition-all active:scale-95 cursor-pointer"
            >
              Save Activity
            </button>
          </form>
        )}
      </section>
    </div>
  );
}