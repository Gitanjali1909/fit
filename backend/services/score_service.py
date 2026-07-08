def calculate_score(workout, food, activity):
    score = 0

    # 1. Workout (40 pts max)
    if workout:
        reps = workout.get("reps", 0)
        score += min(reps / 50 * 40, 40)

    # 2. Activity (30 pts max)
    if activity:
        steps = activity.get("steps", 0) or 0
        score += min(steps / 8000 * 30, 30)

    # 3. Food (30 pts max)
    if food:
        calories = food.get("calories", 0)
        if 1800 <= calories <= 2200:
            score += 30
        else:
            score += max(0, 30 - abs(calories - 2000) / 100)

    return int(score)
