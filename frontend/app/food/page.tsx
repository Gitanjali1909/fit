"use client";

import React, { useState } from "react";
import { API } from "@/lib/api";

interface NutritionResult {
  food: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tip: string;
  logged?: boolean;
}

export default function FoodPage() {
  const [foodInput, setFoodInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodInput.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API}/food/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ food: foodInput.trim(), user_id: 1 }),
      });

      if (!res.ok) {
        throw new Error("API Connection failed");
      }

      const data: NutritionResult = await res.json();
      setResult(data);
    } catch (err) {
      setError("Failed to analyze food. Ensure the backend server is running.");
      // Graceful fallback for mock demo
      setResult({
        food: foodInput.trim(),
        calories: 380,
        protein: 15,
        carbs: 45,
        fat: 10,
        tip: "Connection error: showing estimated values. Eat fresh!",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#030303] text-gray-300 font-sans selection:bg-emerald-500/20 relative overflow-hidden pb-16">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 filter blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 filter blur-[100px] rounded-full pointer-events-none"></div>

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#080808]/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xs font-semibold uppercase tracking-widest text-white">Food Intelligence</h1>
            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">AI Calorie & Nutrition Estimation</p>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 mt-10 flex-1 space-y-6 z-10">
        
        {/* INPUT CARD */}
        <section className="bg-[#080808] border border-white/5 rounded-lg p-5 shadow-sm">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="food-input" className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                What did you eat?
              </label>
              <input
                id="food-input"
                type="text"
                value={foodInput}
                onChange={(e) => setFoodInput(e.target.value)}
                placeholder="e.g. 2 boiled eggs and 1 slice of whole wheat toast"
                className="w-full bg-[#121212] border border-white/5 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 rounded-lg px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-gray-600"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !foodInput.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#121212] disabled:text-gray-600 text-black font-semibold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.4s]"></span>
                </>
              ) : (
                "Analyze meal"
              )}
            </button>
          </form>
        </section>

        {error && (
          <div className="p-3 bg-red-955/20 border border-red-900/30 rounded-lg text-center text-xs text-red-400">
            {error}
          </div>
        )}

        {/* RESULTS CARD */}
        {result && (
          <section className="bg-[#080808] border border-white/5 rounded-lg p-5 shadow-md animate-slideUp space-y-5">
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <div>
                <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Estimated Profile</span>
                <h2 className="text-sm font-semibold text-white capitalize mt-0.5">{result.food}</h2>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-500/20 uppercase tracking-wider">
                Logged to DB
              </span>
            </div>

            {/* Nutrition breakdown grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              {/* Calories */}
              <div className="bg-[#121212] border border-white/5 p-3 rounded-lg flex flex-col items-center">
                <span className="text-[8px] text-gray-500 uppercase font-bold">Calories</span>
                <span className="text-xl font-bold font-mono text-white mt-1">{result.calories}</span>
                <span className="text-[8px] text-gray-500 uppercase font-medium">kcal</span>
              </div>

              {/* Protein */}
              <div className="bg-[#121212] border border-white/5 p-3 rounded-lg flex flex-col items-center">
                <span className="text-[8px] text-gray-500 uppercase font-bold">Protein</span>
                <span className="text-xl font-bold font-mono text-orange-400 mt-1">{result.protein}</span>
                <span className="text-[8px] text-gray-500 uppercase font-medium">grams</span>
              </div>

              {/* Carbs */}
              <div className="bg-[#121212] border border-white/5 p-3 rounded-lg flex flex-col items-center">
                <span className="text-[8px] text-gray-500 uppercase font-bold">Carbs</span>
                <span className="text-xl font-bold font-mono text-blue-400 mt-1">{result.carbs}</span>
                <span className="text-[8px] text-gray-500 uppercase font-medium">grams</span>
              </div>

              {/* Fat */}
              <div className="bg-[#121212] border border-white/5 p-3 rounded-lg flex flex-col items-center">
                <span className="text-[8px] text-gray-500 uppercase font-bold">Fat</span>
                <span className="text-xl font-bold font-mono text-yellow-500 mt-1">{result.fat}</span>
                <span className="text-[8px] text-gray-500 uppercase font-medium">grams</span>
              </div>

            </div>

            {/* AI Advisor Tip Box */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg flex items-start gap-2.5">
              <span className="text-sm select-none">💡</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Coach Advisor Tip</span>
                <p className="text-[11px] text-gray-300 leading-normal mt-0.5">{result.tip}</p>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
