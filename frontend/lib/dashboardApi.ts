import { API } from "./api";

export interface DashboardData {
  today_calories_in: number;
  today_calories_burned: number;
  workouts_done: number;
  activity_score: number;
  ai_insight: string;
  adaptive_insights: string[];
  plan_adjustment: string;
}

export const fetchDashboardData = async (userId: number = 1): Promise<DashboardData> => {
  const res = await fetch(`${API}/dashboard/${userId}`, {
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

export const fetchScoreApi = async (workout: any, food: any, activity: any) => {
  const res = await fetch(`${API}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workout, food, activity }),
  });
  return res.json();
};

export const fetchInsightApi = async (workout: any, food: any, activity: any, score?: number) => {
  const res = await fetch(`${API}/insight`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workout, food, activity, score }),
  });
  return res.json();
};

export const logWorkoutApi = async (userId: number, type: string, reps: number) => {
  const res = await fetch(`${API}/log/workout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, type, reps }),
  });
  return res.json();
};

export const logFoodApi = async (userId: number, foodName: string, calories: number) => {
  const res = await fetch(`${API}/log/food`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, food_name: foodName, calories }),
  });
  return res.json();
};

export const logActivityApi = async (
  userId: number,
  activityType: string,
  duration: number,
  steps?: number,
  caloriesBurned: number = 0
) => {
  const res = await fetch(`${API}/log/activity`, {
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
