"use client";

import React from "react";

export default function ProgressPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-3 w-full">
      <span className="text-4xl select-none">📈</span>
      <h1 className="text-sm font-bold uppercase tracking-widest text-white">Progress Hub</h1>
      <p className="text-xs text-gray-500 max-w-xs leading-normal">
        Your historical training analytics, calorie charts, and strength curves will visualize here.
      </p>
    </div>
  );
}
