"use client";

import React, { useState, useEffect } from "react";
import { 
  fetchDashboardData, 
  logWorkoutApi, 
  logFoodApi, 
  logActivityApi, 
  DashboardData 
} from "@/lib/dashboardApi";
import { getOrCreateUserId } from "@/lib/user";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

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

  const hasData = data && data.has_data;

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto px-4">
      {/* TOP HEADER / GREETINGS */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Hey Champion 👋</h2>
          <p className="text-[10px] text-gray-500 font-medium">Here is your daily fitness digest.</p>
        </div>

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

      {error && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center backdrop-blur-md shadow-none">
          <span className="text-2xl mb-2 block">📋</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">No data yet</h3>
          <p className="text-[11px] text-gray-500 mt-1">Start your first activity to update your score.</p>
        </div>
      )}

      {/* SCORE SECTION */}
      {!hasData ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center backdrop-blur-md shadow-none">
          <span className="text-xl mb-1.5 block select-none">📊</span>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Daily Fitness Score</h3>
          <p className="text-[11px] text-gray-500 mt-1">Complete your day to see your score.</p>
        </div>
      ) : (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md flex items-center justify-between relative overflow-hidden shadow-none">
          <div className="space-y-1.5">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Daily Fitness Score</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-5xl font-black font-mono text-emerald-400 tracking-tighter leading-none">
                {data.activity_score}
              </span>
              <span className="text-xs text-gray-500 font-bold">/100</span>
            </div>
            <p className="text-[10px] text-gray-400 max-w-[220px] leading-relaxed">
              {data.activity_score >= 80 
                ? "Outstanding performance! You are on track to crush your fitness goals."
                : "Keep moving! Every step, rep, and healthy meal helps boost your score."}
            </p>
          </div>

          {/* Progress Circle SVG */}
          <div className="relative w-20 h-20 flex items-center justify-center">
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
                strokeDashoffset={201 - (201 * (data.activity_score / 100))}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <span className="absolute text-[9px] font-bold text-gray-450 uppercase tracking-widest">Score</span>
          </div>
        </section>
      )}

      {/* METRICS GRID */}
      {hasData && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Calories Card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col justify-between h-32 shadow-none">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Calories Balance</span>
              <span className="text-xs">🍱</span>
            </div>
            <div>
              <div className="flex items-baseline gap-0.5 mt-2">
                <span className="text-3xl font-bold font-mono text-white">
                  {data.today_calories_in - data.today_calories_burned}
                </span>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">net kcal</span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-550 mt-2.5">
                <span>In: {data.today_calories_in} kcal</span>
                <span>Out: {data.today_calories_burned} kcal</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col justify-between h-32 shadow-none">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Workout Sessions</span>
              <span className="text-xs">🏋️</span>
            </div>
            <div>
              <div className="flex items-baseline gap-0.5 mt-2">
                <span className="text-3xl font-bold font-mono text-white">
                  {data.workouts_done}
                </span>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">completed</span>
              </div>
              <p className="text-[9px] text-gray-550 mt-2.5">
                {data.reps > 0 ? `${data.reps} total reps logged today.` : "No reps logged today."}
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
                  {data.steps || 0}
                </span>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">steps</span>
              </div>
              <p className="text-[9px] text-gray-550 mt-2.5">
                Target: 8,000 steps baseline.
              </p>
            </div>
          </div>

        </section>
      )}

      {/* AI INSIGHT SECTION */}
      {hasData && (data.ai_insight || data.plan_adjustment) && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md space-y-4 relative overflow-hidden shadow-none">
          <div className="flex items-center gap-2">
            <span className="text-sm">💡</span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">AI Insight of the Day</span>
          </div>
          
          {data.ai_insight && (
            <p className="text-xs text-gray-250 leading-relaxed italic">
              "{data.ai_insight}"
            </p>
          )}

          {data.plan_adjustment && (
            <div className="border-t border-white/5 pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Adaptive Plan Update</span>
              <span className="text-xs font-semibold text-white bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                {data.plan_adjustment}
              </span>
            </div>
          )}
        </section>
      )}

      {/* TACTILE LOGGER DRAWER */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md shadow-none">
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Activity Logger</h2>
            <p className="text-[9px] text-gray-550 font-medium">Log your meals, reps, and steps manually</p>
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
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-650"
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
                className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-650 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all placeholder:text-gray-600"
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

        {/* Quick Suggestions */}
        {!activeLogTab && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
            {[
              { label: "10 Squats", cat: "workout", action: () => { setWorkoutType("Squats"); setWorkoutReps("10"); setActiveLogTab("workout"); } },
              { label: "Banana (105 kcal)", cat: "food", action: () => { setFoodName("Banana"); setFoodCalories("105"); setActiveLogTab("food"); } },
              { label: "30-min walk", cat: "activity", action: () => { setActivityType("Walk"); setActivityDuration("30"); setActivitySteps("3500"); setActiveLogTab("activity"); } },
              { label: "15 Pushups", cat: "workout", action: () => { setWorkoutType("Pushups"); setWorkoutReps("15"); setActiveLogTab("workout"); } }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className="p-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl text-left transition-all group flex flex-col justify-between h-16 shadow-none"
              >
                <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{item.cat}</span>
                <span className="text-[11px] font-semibold text-white group-hover:text-emerald-400 transition-colors">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}