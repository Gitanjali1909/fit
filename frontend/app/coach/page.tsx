"use client";

import { useState, useEffect, useRef } from "react";
import { sendMessage } from "@/lib/api";
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

  const theme = {
    accent: mode === "coach" ? "emerald" : "red",
    text: mode === "coach" ? "text-emerald-400" : "text-red-400",
    bgTint: mode === "coach" ? "bg-[#0c1612]" : "bg-[#1c0f0f]",
    bgTintHover: mode === "coach" ? "hover:bg-[#0f1d17]" : "hover:bg-[#241313]",
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

    const personalityInstruction =
      mode === "roast"
        ? "\n(Reply in ROAST MODE: You are extremely sarcastic, savage, and funny. Roast my laziness, call out any excuses, keep it brief but highly motivational through tough love. Focus heavily on roasting.)"
        : "\n(Reply in COACH MODE: You are supportive, clear, structured, and encouraging. Give highly practical fitness guidance.)";

    const profileContext = `[User Context: Age ${profile.age}, Weight ${profile.weight}kg, Height ${profile.height}cm, Goal: ${profile.goal}]`;

    try {
      const data = await sendMessage(cleanedText);
      const replyText = data.reply || "No response received. Try again.";

      const planData = parsePlanResponse(replyText);
      const isPlan = planData !== null;

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
        prompt = `Create a custom daily workout and diet plan for me. Format it exactly like this:
Goal: [Target Goal]
Workout:
- [exercise 1]
- [exercise 2]
Diet:
- [meal/macro tip 1]
- [meal/macro tip 2]`;
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
    handleSend(prompt);
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
          const isMajor = t % 10 === 0;
          return (
            <div key={t} className="flex flex-col items-center shrink-0 w-2 transition-all duration-355">
              <div
                className={`w-0.5 rounded-t-full transition-all duration-300 ${
                  isSelected
                    ? `h-4 bg-gradient-to-t ${theme.gradient} shadow-sm shadow-emerald-500/20`
                    : isMajor
                    ? "h-2.5 bg-gray-600"
                    : "h-1 bg-gray-800"
                }`}
              ></div>
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
    <div className="flex flex-col h-screen bg-[#030303] text-gray-200 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      
      <div className={`absolute top-0 inset-x-0 h-64 bg-gradient-to-b ${theme.gradientBg} filter blur-3xl pointer-events-none transition-all duration-500`}></div>

      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slideUp {
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-out forwards;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <header className="flex items-center justify-between px-6 py-4 bg-[#080808]/90 backdrop-blur-md border-b border-gray-900/50 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${theme.gradient} shadow-lg ${theme.glow} transition-all duration-500`}>
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-white">Fit AI Coach</h1>

            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Vision Connected</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
         
          <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
                <circle cx="14" cy="14" r="12" stroke="#161616" strokeWidth="2.5" fill="transparent" />
                <circle
                  cx="14"
                  cy="14"
                  r="12"
                  stroke={mode === "coach" ? "#10b981" : "#ef4444"}
                  strokeWidth="2.5"
                  fill="transparent"
                  strokeDasharray="75.4"
                  strokeDashoffset="18"
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute text-[8px] font-bold text-white">85</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Daily Score</span>
              <span className="text-xs font-black text-white font-mono leading-none">🔥 5d Streak</span>
            </div>
          </div>

         
          <button 
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className={`flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 active:scale-95 border ${isEditingProfile ? theme.borderSolid : "border-white/5"} rounded-xl text-xs font-bold text-gray-300 transition-all`}
          >
            <span>{profile.age} yrs • {profile.weight} kg • {profile.height} cm • {profile.goal}</span>
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

       
          <div className="flex p-0.5 bg-white/5 border border-white/5 rounded-xl">
            <button
              onClick={() => setMode("coach")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition-all duration-300 active:scale-95 ${
                mode === "coach"
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/10"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Coach
            </button>
            <button
              onClick={() => setMode("roast")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition-all duration-300 active:scale-95 ${
                mode === "roast"
                  ? "bg-red-500 text-white shadow-md shadow-red-500/10"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Roast 😈
            </button>
          </div>
        </div>
      </header>

      {isEditingProfile && (
        <div className="p-4 bg-[#080808]/95 backdrop-blur-md border-b border-gray-900/60 flex flex-col gap-4 animate-slideUp z-10 shadow-2xl">
          <div className="max-w-5xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
  
            <div className="bg-[#0e0e0e] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Age</span>
                <span className={`text-xs font-bold ${theme.text}`}>{profile.age} yrs</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-1">
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, age: Math.max(16, Number(profile.age) - 1).toString() })}
                  aria-label="Decrease age"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/5 text-sm font-bold text-white transition-all select-none"
                >
                  -
                </button>
                <span className="text-2xl font-black font-mono text-white tracking-tight">{profile.age}</span>
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, age: Math.min(90, Number(profile.age) + 1).toString() })}
                  aria-label="Increase age"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/5 text-sm font-bold text-white transition-all select-none"
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
                aria-label="Age slider"
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1"
              />
            </div>

            <div className="bg-[#0e0e0e] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Weight</span>
                <span className={`text-xs font-bold ${theme.text}`}>{profile.weight} kg</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-1">
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, weight: Math.max(40, Number(profile.weight) - 1).toString() })}
                  aria-label="Decrease weight"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/5 text-sm font-bold text-white transition-all select-none"
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
                  aria-label="Increase weight"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/5 text-sm font-bold text-white transition-all select-none"
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
                aria-label="Weight slider"
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1"
              />
            </div>

    
            <div className="bg-[#0e0e0e] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Height</span>
                <span className={`text-xs font-bold ${theme.text}`}>{profile.height} cm</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-1">
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, height: Math.max(100, Number(profile.height) - 1).toString() })}
                  aria-label="Decrease height"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/5 text-sm font-bold text-white transition-all select-none"
                >
                  -
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black font-mono text-white tracking-tight">{profile.height}</span>
                  {renderRuler(parseInt(profile.height) || 170, 100, 220)}
                </div>
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, height: Math.min(220, Number(profile.height) + 1).toString() })}
                  aria-label="Increase height"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center border border-white/5 text-sm font-bold text-white transition-all select-none"
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
                aria-label="Height slider"
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-1"
              />
            </div>

            <div className="bg-[#0e0e0e] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
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
                          : "border-white/5 bg-[#121212] hover:bg-[#161616]"
                      }`}
                    >
                      <span className="text-xs">{g.icon}</span>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-extrabold text-white">{g.label}</span>
                        <span className="text-[7px] text-gray-500">{g.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="flex justify-end max-w-5xl mx-auto w-full mt-1">
            <button
              onClick={() => setIsEditingProfile(false)}
              className={`px-5 py-2 bg-gradient-to-r ${theme.gradient} text-black font-black uppercase tracking-wider rounded-xl text-[10px] transition-all shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer`}
            >
              Apply Training Context
            </button>
          </div>
        </div>
      )}

      
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-[85%] ${
                  isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                } animate-slideUp`}
              >
 
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-all duration-350 ${
                    isUser
                      ? "bg-white/5 border border-white/10 text-gray-300"
                      : msg.mode === "roast"
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {isUser ? (
                    <span className="text-[10px] font-black uppercase tracking-wider">Me</span>
                  ) : msg.mode === "roast" ? (
                    "😈"
                  ) : (
                    "💪"
                  )}
                </div>

                <div className="space-y-4 flex-1">
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed border transition-all duration-300 relative ${
                      isUser
                        ? "bg-[#101010]/80 backdrop-blur-md border-white/5 text-white rounded-tr-none shadow-md"
                        : msg.mode === "roast"
                        ? "bg-[#180e0e]/85 backdrop-blur-md border-red-950/40 text-gray-200 rounded-tl-none shadow-red-900/5 shadow-lg"
                        : "bg-[#08120e]/85 backdrop-blur-md border-emerald-950/40 text-gray-200 rounded-tl-none shadow-emerald-900/5 shadow-lg"
                    }`}
                  >
                    {!isUser && (
                      <span className={`absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                        msg.mode === "roast" ? "bg-red-950/50 border-red-800/30 text-red-400" : "bg-emerald-950/50 border-emerald-800/30 text-emerald-400"
                      }`}>
                        {msg.mode === "roast" ? "Savage Roast" : "Smart Advice"}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </div>

                  {msg.isPlan && msg.planData && (
                    <div className={`bg-[#0d0d0d]/80 backdrop-blur-md border ${theme.border} hover:border-white/10 rounded-2xl p-5 shadow-2xl transition-all duration-300 animate-slideUp`}>
                      <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                        <div className="flex items-center gap-2.5">
                          <span className={`p-2 ${theme.iconBg} rounded-xl ${theme.iconText}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </span>
                          <div>
                            <h3 className="font-extrabold text-white text-sm">Target: {msg.planData.goal}</h3>
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">AI Adaptation Engine</span>
                          </div>
                        </div>
                        <span className={`text-[9px] bg-white/5 border border-white/5 text-gray-300 font-black px-2.5 py-1 rounded-lg uppercase tracking-wider`}>
                          Active Protocol
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div className="bg-[#121212]/50 border border-white/5 p-4 rounded-xl">
                          <h4 className={`text-[10px] font-black ${theme.text} uppercase tracking-widest mb-3 flex items-center gap-2`}>
                            🏋️ Workout Program
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
                            <p className="text-xs text-gray-500">No workout detail found. Ask for details.</p>
                          )}
                        </div>

                        <div className="bg-[#121212]/50 border border-white/5 p-4 rounded-xl">
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
                            <p className="text-xs text-gray-500">No nutritional details found. Ask for details.</p>
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
            <div className="flex gap-4 max-w-3xl mr-auto animate-fadeIn">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${theme.iconBg} ${theme.iconText}`}>
                {mode === "roast" ? "😈" : "💪"}
              </div>
              <div className="flex items-center gap-1.5 bg-[#0f0f0f]/80 backdrop-blur-md border border-white/5 px-4 py-3 rounded-2xl rounded-tl-none shadow-md">
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dots} animate-bounce`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dots} animate-bounce [animation-delay:0.2s]`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dots} animate-bounce [animation-delay:0.4s]`}></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

 
      <footer className="p-4 sm:p-6 bg-[#080808]/90 backdrop-blur-md border-t border-gray-900/60 sticky bottom-0 z-20">
        <div className="max-w-3xl mx-auto space-y-4">
          
         
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: "Create my plan", icon: "📋" },
              { label: "Today's workout", icon: "🏋️" },
              { label: "What should I eat?", icon: "🍱" },
              { label: "Analyze my progress", icon: "📊" }
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => triggerQuickAction(action.label)}
                className={`px-4 py-2 bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-bold text-gray-300 hover:text-white rounded-xl border border-white/5 hover:border-white/10 shadow-lg transition-all shrink-0 cursor-pointer flex items-center gap-1.5`}
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
              className={`flex-1 px-4 py-3.5 bg-[#0f0f0f] border border-white/5 focus:ring-1 focus:ring-emerald-500/25 ${theme.borderFocus} rounded-2xl text-sm text-white outline-none transition-all`}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={loading || !input.trim()}
              className={`px-6 ${theme.buttonBg} disabled:bg-gray-900 disabled:text-gray-600 disabled:border-transparent text-black font-black text-xs uppercase tracking-wider rounded-2xl transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-white/5 shadow-xl`}
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}