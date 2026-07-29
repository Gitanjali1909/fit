const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://fit-65of.onrender.com";

export interface WorkoutLogItem {
  type: string;
  reps: number;
  id: number;
}

export interface FoodLogItem {
  food_name: string;
  calories: number;
  id: number;
}

export interface ActivityLogItem {
  activity_type: string;
  duration: number;
  steps: number | null;
  calories_burned: number;
  id: number;
}

export interface DashboardData {
  today_calories_in: number;
  today_calories_burned: number;
  workouts_done: number;
  activity_score: number;
  ai_insight: string;
  adaptive_insights: string[];
  plan_adjustment: string;
  steps: number;
  reps: number;
  score: number;
  insight: string;
  calories_in: number;
  calories_out: number;
  has_data?: boolean;
  score_explanation?: string;
  score_breakdown?: {
    workout: number;
    diet: number;
    steps: number;
  };
  workouts: WorkoutLogItem[];
  food: FoodLogItem[];
  activity: ActivityLogItem[];
}

export const fetchDashboardData = async (userId: string): Promise<DashboardData> => {
  const res = await fetch(`${BASE_URL}/dashboard/${userId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return res.json();
};

export const fetchScoreApi = async (workout: any, food: any, activity: any, userId: string) => {
  const res = await fetch(`${BASE_URL}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workout, food, activity, user_id: userId }),
  });
  return res.json();
};

export const fetchInsightApi = async (workout: any, food: any, activity: any, userId: string, score?: number) => {
  const res = await fetch(`${BASE_URL}/insight`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workout, food, activity, score, user_id: userId }),
  });
  return res.json();
};

export const logWorkoutApi = async (userId: string, type: string, reps: number) => {
  const res = await fetch(`${BASE_URL}/log/workout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, type, reps }),
  });
  return res.json();
};

export const logFoodApi = async (userId: string, foodName: string, calories: number) => {
  const res = await fetch(`${BASE_URL}/log/food`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, food_name: foodName, calories }),
  });
  return res.json();
};

export const logActivityApi = async (
  userId: string,
  activityType: string,
  duration: number,
  steps?: number,
  caloriesBurned: number = 0
) => {
  const res = await fetch(`${BASE_URL}/log/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      activity_type: activityType,
      duration,
      steps,
      calories_burned: caloriesBurned,
    }),
  });
  return res.json();
};

// Plan persistence methods
export const savePlanApi = async (userId: string, planContent: string) => {
  const res = await fetch(`${BASE_URL}/plan/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, plan_content: planContent }),
  });
  return res.json();
};

export const fetchPlanApi = async (userId: string) => {
  const res = await fetch(`${BASE_URL}/plan/${userId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  return res.json();
};

export const resetTodayApi = async (userId: string) => {
  const res = await fetch(`${BASE_URL}/reset-today`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });
  return res.json();
};

export const deleteLogApi = async (logType: string, logId: number) => {
  const res = await fetch(`${BASE_URL}/log/${logType}/${logId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return res.json();
};

export const deleteFoodLogApi = async (logId: number) => {
  return deleteLogApi("food", logId);
};
