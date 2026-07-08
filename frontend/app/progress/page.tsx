"use client";

import React from "react";

export default function ProgressPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-6 text-center selection:bg-emerald-500/20">
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent filter blur-3xl pointer-events-none"></div>
      
      <span className="text-4xl mb-3 select-none">📈</span>
      <h1 className="text-sm font-bold uppercase tracking-widest text-white">Progress Hub</h1>
      <p className="text-xs text-gray-500 max-w-xs mt-2 leading-normal">
        Your historical training analytics, calorie charts, and strength curves will visualize here.
      </p>
    </div>
  );
}
