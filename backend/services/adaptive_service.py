def analyze_user(data: dict) -> list:
    insights = []
    steps = data.get("steps", 0) or 0
    calories = data.get("calories", 0) or 0
    workouts = data.get("workouts", 0) or 0  # reps or sessions count

    if steps < 3000:
        insights.append("Low activity")

    if calories > 2200:
        insights.append("High calorie intake")

    if workouts == 0:
        insights.append("No workout")

    return insights


def adjust_plan(insights: list) -> str:
    if not insights:
        return "Maintain current plan"

    recommendations = []
    
    # Priority-based or combined recommendation builder
    if "No workout" in insights:
        recommendations.append("Start light with a 5-min joint mobility routine")
    
    if "Low activity" in insights:
        recommendations.append("Increase tomorrow's step target to 8,000 steps")
        
    if "High calorie intake" in insights:
        recommendations.append("Apply a minor 250 kcal dietary offset next meal")

    return " and ".join(recommendations)


def get_severity(insights_count: int) -> str:
    if insights_count == 0:
        return "low"
    elif insights_count == 1:
        return "low"
    elif insights_count == 2:
        return "medium"
    else:
        return "high"


def evaluate_adaptive_state(data: dict) -> dict:
    insights = analyze_user(data)
    plan = adjust_plan(insights)
    severity = get_severity(len(insights))
    
    return {
        "insights": insights,
        "plan": plan,
        "severity": severity
    }
