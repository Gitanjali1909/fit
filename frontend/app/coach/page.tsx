"use client";

import { useState, useEffect, useRef } from "react";
import { sendMessage } from "@/lib/api";
import { savePlanApi, fetchPlanApi } from "@/lib/dashboardApi";
import { getOrCreateUserId } from "@/lib/user";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: "coach" | "roast";
  isPlan?: boolean;
  planData?: {
    goal: string;
    workout: string[];
    diet: string[];
  };
}

interface UserProfile {
  age: string;
  weight: string;
  height: string;
  goal: string;
}

export default function CoachPage() {
  const [profile, setProfile] = useState<UserProfile>({
    age: "24",
    weight: "75",
    height: "178",
    goal: "Muscle Gain",
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [mode, setMode] = useState<"coach" | "roast">("coach");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Yo. I'm your AI Coach. Ready to stop making excuses and put in the work? Tell me your age, weight, height, and goal, or select one of the actions below.",
      mode: "coach",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load existing plan from database on mount
  useEffect(() => {
    const userId = getOrCreateUserId();
    fetchPlanApi(userId)
      .then((data) => {
        if (data && data.plan_content && !data.plan_content.startsWith("No active plan")) {
          const planData = parsePlanResponse(data.plan_content);
          setMessages((prev) => [
            ...prev,
            {
              id: "saved-plan",
              role: "assistant",
              content: data.plan_content,
              mode: "coach",
              isPlan: true,
              planData: planData || undefined,
            },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const theme = {
    accent: mode === "coach" ? "emerald" : "red",
    text: mode === "coach" ? "text-emerald-400" : "text-red-400",
    bgTint: mode === "coach" ? "bg-emerald-500/5" : "bg-red-500/5",
    bgTintHover: mode === "coach" ? "hover:bg-emerald-500/10" : "hover:bg-red-500/10",
    border: mode === "coach" ? "border-emerald-500/20" : "border-red-500/20",
    borderFocus: mode === "coach" ? "focus:border-emerald-500" : "focus:border-red-500",
    borderSolid: mode === "coach" ? "border-emerald-500" : "border-red-500",
    gradient: mode === "coach" ? "from-emerald-400 to-emerald-600" : "from-red-500 to-rose-600",
    gradientBg: mode === "coach" ? "from-emerald-500/5 via-transparent to-transparent" : "from-red-500/5 via-transparent to-transparent",
    glow: mode === "coach" ? "shadow-emerald-500/10" : "shadow-red-500/10",
    buttonBg: mode === "coach" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-red-500 hover:bg-red-400",
    dots: mode === "coach" ? "bg-emerald-400" : "bg-red-500",
    textMuted: mode === "coach" ? "text-emerald-500/70" : "text-red-500/70",
    bubbleBorder: mode === "coach" ? "border-emerald-500/10" : "border-red-500/10",
    iconBg: mode === "coach" ? "bg-emerald-500/10" : "bg-red-500/10",
    iconText: mode === "coach" ? "text-emerald-400" : "text-red-450",
  };

  const parsePlanResponse = (text: string) => {
    const goalMatch = text.match(/(?:Goal|Goal:)\s*([^\n]+)/i);
    const workoutSection = text.match(/(?:Workout Plan|Workout|Workouts):([\s\S]*?)(?:Diet Plan|Diet|Nutrition:|$)/i);
    const dietSection = text.match(/(?:Diet Plan|Diet|Nutrition):([\s\S]*?)(?:Workout Plan|Workout|Workouts:|$)/i) || 
                        text.match(/(?:Diet Plan|Diet|Nutrition):([\s\S]*?)$/i);

    if (!workoutSection && !dietSection && !goalMatch) {
      if (text.toLowerCase().includes("plan") && (text.includes("1.") || text.includes("-"))) {
        return {
          goal: profile.goal || "Custom Fitness Goal",
          workout: ["Custom exercises suggested - see chat text below"],
          diet: ["Nutrition advice suggested - see chat text below"],
        };
      }
      return null;
    }

    const parseList = (sectionText: string | undefined) => {
      if (!sectionText) return [];
      return sectionText
        .split("\n")
        .map((line) => line.replace(/^[\s*-•\d.)]+/, "").trim())
        .filter((line) => line.length > 0);
    };

    return {
      goal: goalMatch ? goalMatch[1].trim() : profile.goal,
      workout: workoutSection ? parseList(workoutSection[1]) : [],
      diet: dietSection ? parseList(dietSection[1]) : [],
    };
  };

  const handleSend = async (textToSend: string) => {
    const cleanedText = textToSend.trim();
    if (!cleanedText || loading) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: "user",
      content: cleanedText,
      mode: mode,
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendMessage(cleanedText, profile, mode);
      const replyText = data.reply || "No response received. Try again.";

      const planData = parsePlanResponse(replyText);
      const isPlan = planData !== null;

      if (isPlan) {
        const userId = getOrCreateUserId();
        savePlanApi(userId, replyText).catch(() => {});
      }

      const newAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: replyText,
        mode: mode,
        isPlan,
        planData: planData || undefined,
      };

      setMessages((prev) => [...prev, newAiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Connection error. Make sure your FastAPI backend is running on port 8000.",
          mode: mode,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerQuickAction = (actionText: string) => {
    let prompt = "";
    switch (actionText) {
      case "Create my plan":
        prompt = `Create a custom daily workout and diet plan for me. Goal: ${profile.goal}`;
        break;
      case "Today's workout":
        prompt = "Give me a quick workout I can do right now with no equipment.";
        break;
      case "What should I eat?":
        prompt = "Recommend a healthy, high-protein meal or snack option.";
        break;
      case "Analyze my progress":
        prompt = "I did all my reps today and ate clean. Give me a brief status check.";
        break;
      default:
        prompt = actionText;
    }
    setInput(prompt);
  };

  const updateHeightInCm = (feet: number, inches: number) => {
    const totalIn = feet * 12 + inches;
    const calculatedCm = Math.round(totalIn * 2.54).toString();
    setProfile((prev) => ({ ...prev, height: calculatedCm }));
  };

  const displayHeight = () => {
    if (heightUnit === "cm") {
      return `${profile.height} cm`;
    }
    const cmVal = parseFloat(profile.height) || 178;
    const totalIn = cmVal / 2.54;
    const f = Math.floor(totalIn / 12);
    const i = Math.round(totalIn % 12);
    return `${f}'${i}"`;
  };

  const renderRuler = (val: number, min: number, max: number) => {
    const ticks = [];
    const minVal = Math.max(min, val - 10);
    const maxVal = Math.min(max, val + 10);

    for (let i = minVal; i <= maxVal; i += 2) {
      ticks.push(i);
    }

    return (
      <div className="relative flex items-end justify-center gap-1 h-8 w-full overflow-hidden px-2 mt-1 select-none">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gray-800"></div>
        {ticks.map((t) => {
          const isSelected = t === val;
          return (
            <div key={t} className="flex flex-col items-center gap-1 shrink-0">
              <span className={`text-[7px] font-mono leading-none ${isSelected ? "text-emerald-450 font-bold" : "text-gray-650"}`}>
                {t % 10 === 0 ? t : ""}
              </span>
              <div className={`w-0.5 rounded-full transition-all ${isSelected ? "h-4 bg-emerald-500" : t % 10 === 0 ? "h-2.5 bg-gray-600" : "h-1.5 bg-gray-800"}`} />
            </div>
          );
        })}
      </div>
    );
  };

  const goals = [
    { id: "Muscle Gain", label: "Muscle Gain", desc: "Build mass", icon: "💪" },
    { id: "Fat Loss", label: "Fat Loss", desc: "Shred fat", icon: "🔥" },
    { id: "Endurance", label: "Endurance", desc: "Boost cardio", icon: "🏃" },
    { id: "Maintenance", label: "Maintenance", desc: "Optimize health", icon: "⚖️" },
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* HEADER */}
      <header className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md shadow-none">
        <div className="flex items-center gap-3">
          <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${theme.gradient} shadow-none transition-all duration-500`}>
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-white">Fit AI Coach</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">System Ready</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className={`flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border ${isEditingProfile ? theme.borderSolid : "border-white/10"} rounded-lg text-xs font-semibold text-gray-300 transition-all`}
          >
            <span>{profile.age} yrs • {profile.weight} kg • {displayHeight()}</span>
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          {/* Mode Selector */}
          <div className="flex p-0.5 bg-white/5 border border-white/10 rounded-lg">
            <button
              onClick={() => setMode("coach")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-300 active:scale-95 ${
                mode === "coach"
                  ? "bg-emerald-500 text-black shadow-none"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Coach
            </button>
            <button
              onClick={() => setMode("roast")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-300 active:scale-95 ${
                mode === "roast"
                  ? "bg-red-500 text-white shadow-none"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Roast 😈
            </button>
          </div>
        </div>
      </header>

      {/* ACTIVE MODE STATUS BADGE */}
      <div className={`p-3 border rounded-xl text-xs font-medium backdrop-blur-md transition-all duration-500 flex items-center justify-between ${
        mode === "coach"
          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
          : "bg-red-500/5 border-red-500/20 text-red-400"
      }`}>
        <span className="flex items-center gap-1.5">
          <span>{mode === "coach" ? "🌿" : "😈"}</span>
          <span>{mode === "coach" ? "Supportive AI Coach Mode Active" : "Savage AI Roast Mode Active (Brace yourself)"}</span>
        </span>
        <span className="text-[9px] uppercase tracking-wider font-bold opacity-60">Differentiated Response Engaged</span>
      </div>

      {/* PROFILE CONTEXT DRAWER */}
      {isEditingProfile && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-4 animate-slideUp z-10 shadow-2xl backdrop-blur-md">
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Age selector */}
            <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Age</span>
                <span className={`text-xs font-bold ${theme.text}`}>{profile.age} yrs</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-1">
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, age: Math.max(16, Number(profile.age) - 1).toString() })}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/10 text-sm font-bold text-white transition-all select-none"
                >
                  -
                </button>
                <span className="text-2xl font-black font-mono text-white tracking-tight">{profile.age}</span>
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, age: Math.min(90, Number(profile.age) + 1).toString() })}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/10 text-sm font-bold text-white transition-all select-none"
                >
                  +
                </button>
              </div>
              <input
                type="range"
                min="16"
                max="90"
                value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1"
              />
            </div>

            {/* Weight selector */}
            <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Weight</span>
                <span className={`text-xs font-bold ${theme.text}`}>{profile.weight} kg</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-1">
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, weight: Math.max(40, Number(profile.weight) - 1).toString() })}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/10 text-sm font-bold text-white transition-all select-none"
                >
                  -
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black font-mono text-white tracking-tight">{profile.weight}</span>
                  {renderRuler(parseInt(profile.weight) || 75, 40, 180)}
                </div>
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, weight: Math.min(180, Number(profile.weight) + 1).toString() })}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/10 text-sm font-bold text-white transition-all select-none"
                >
                  +
                </button>
              </div>
              <input
                type="range"
                min="40"
                max="180"
                value={profile.weight}
                onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1"
              />
            </div>

            {/* Height selector with unit toggler */}
            <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Height</span>
                <div className="flex items-center gap-1 bg-white/5 p-0.5 border border-white/10 rounded-md">
                  <button
                    type="button"
                    onClick={() => setHeightUnit("cm")}
                    className={`px-1 py-0.5 rounded text-[8px] font-bold transition-all ${heightUnit === "cm" ? "bg-emerald-500 text-black" : "text-gray-400"}`}
                  >
                    CM
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeightUnit("ft")}
                    className={`px-1 py-0.5 rounded text-[8px] font-bold transition-all ${heightUnit === "ft" ? "bg-emerald-500 text-black" : "text-gray-400"}`}
                  >
                    FT
                  </button>
                </div>
              </div>

              {heightUnit === "cm" ? (
                <>
                  <div className="flex items-center justify-between gap-4 py-1">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, height: Math.max(100, Number(profile.height) - 1).toString() })}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/10 text-sm font-bold text-white transition-all select-none"
                    >
                      -
                    </button>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black font-mono text-white tracking-tight">{profile.height} cm</span>
                      {renderRuler(parseInt(profile.height) || 170, 100, 220)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, height: Math.min(220, Number(profile.height) + 1).toString() })}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/10 text-sm font-bold text-white transition-all select-none"
                    >
                      +
                    </button>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="220"
                    value={profile.height}
                    onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                    className="w-full h-1 bg-gray-850 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1"
                  />
                </>
              ) : (
                <>
                  {(() => {
                    const cmVal = parseFloat(profile.height) || 178;
                    const totalIn = cmVal / 2.54;
                    const f = Math.floor(totalIn / 12);
                    const i = Math.round(totalIn % 12);
                    return (
                      <div className="flex flex-col gap-1.5 py-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400">Feet</span>
                          <span className="font-mono font-bold text-white">{f} ft</span>
                        </div>
                        <input
                          type="range"
                          min="3"
                          max="8"
                          value={f}
                          onChange={(e) => updateHeightInCm(parseInt(e.target.value), i)}
                          className="w-full h-1 bg-gray-850 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between items-center text-[10px] mt-1">
                          <span className="text-gray-400">Inches</span>
                          <span className="font-mono font-bold text-white">{i} in</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="11"
                          value={i}
                          onChange={(e) => updateHeightInCm(f, parseInt(e.target.value))}
                          className="w-full h-1 bg-gray-850 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Goal selector */}
            <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black mb-1.5">Goal</span>
              <div className="grid grid-cols-2 gap-1.5 flex-1">
                {goals.map((g) => {
                  const isSelected = profile.goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setProfile({ ...profile, goal: g.id })}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all relative overflow-hidden group active:scale-95 ${
                        isSelected
                          ? `${theme.borderSolid} bg-white/5`
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs">{g.icon}</span>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-extrabold text-white">{g.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CHAT VIEW SECTION */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between min-h-[350px] shadow-none backdrop-blur-md">
        
        {/* Messages Feed */}
        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 pb-4 scrollbar-none">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"} animate-slideUp`}>
                
                {/* Profile bubble */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-none ${
                  isUser 
                    ? "bg-white/10 text-white border border-white/15" 
                    : `${theme.iconBg} ${theme.iconText} border ${theme.bubbleBorder}`
                }`}>
                  {isUser ? "👤" : msg.mode === "roast" ? "😈" : "💪"}
                </div>

                {/* Msg Container */}
                <div className="space-y-2">
                  <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-xs leading-relaxed ${
                    isUser 
                      ? "bg-white/5 text-white border border-white/10 rounded-tr-none" 
                      : `bg-white/5 text-gray-250 border border-white/10 rounded-tl-none`
                  }`}>
                    {msg.content}
                  </div>

                  {/* Render parsed fitness plans */}
                  {msg.isPlan && msg.planData && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-none space-y-4 animate-slideUp w-full max-w-lg">
                      <div className="border-b border-white/10 pb-2">
                        <span className="text-[8px] text-gray-500 uppercase tracking-widest font-black">Generated Target Plan</span>
                        <h3 className="text-xs font-extrabold text-white mt-0.5 capitalize">
                          🎯 Goal: {msg.planData.goal}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                          <h4 className={`text-[10px] font-black ${theme.text} uppercase tracking-widest mb-3 flex items-center gap-2`}>
                            🏋️ Exercise Routine
                          </h4>
                          {msg.planData.workout.length > 0 ? (
                            <ul className="space-y-2">
                              {msg.planData.workout.map((item, idx) => (
                                <li key={idx} className="text-xs text-gray-300 flex items-start gap-2.5">
                                  <span className={`text-sm ${theme.text} leading-none mt-0.5`}>•</span>
                                  <span className="font-medium leading-relaxed">{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500">No workout detail found.</p>
                          )}
                        </div>

                        <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                          <h4 className={`text-[10px] font-black ${theme.text} uppercase tracking-widest mb-3 flex items-center gap-2`}>
                            🍱 Nutrition Protocol
                          </h4>
                          {msg.planData.diet.length > 0 ? (
                            <ul className="space-y-2">
                              {msg.planData.diet.map((item, idx) => (
                                <li key={idx} className="text-xs text-gray-300 flex items-start gap-2.5">
                                  <span className={`text-sm ${theme.text} leading-none mt-0.5`}>•</span>
                                  <span className="font-medium leading-relaxed">{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500">No nutritional details found.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto animate-fadeIn">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-none ${theme.iconBg} ${theme.iconText}`}>
                {mode === "roast" ? "😈" : "💪"}
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-none">
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dots} animate-bounce`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dots} animate-bounce [animation-delay:0.2s]`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dots} animate-bounce [animation-delay:0.4s]`}></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Footer input controllers */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: "Create my plan", icon: "📋" },
              { label: "Today's workout", icon: "🏋️" },
              { label: "What should I eat?", icon: "🍱" },
              { label: "Analyze my progress", icon: "📊" }
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => triggerQuickAction(action.label)}
                className={`px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-[10px] font-bold text-gray-300 hover:text-white rounded-lg border border-white/10 shadow-none transition-all shrink-0 cursor-pointer flex items-center gap-1`}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
              placeholder="Ask about diet, workout, progress..."
              className={`flex-1 px-4 py-2.5 bg-white/5 border border-white/10 focus:ring-1 focus:ring-emerald-500/25 ${theme.borderFocus} rounded-xl text-xs text-white outline-none transition-all placeholder:text-gray-650`}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={loading || !input.trim()}
              className={`px-5 ${theme.buttonBg} disabled:bg-white/5 disabled:text-gray-600 disabled:border-transparent text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-white/10`}
            >
              Send
            </button>
          </div>
        </div>

      </section>

    </div>
  );
}