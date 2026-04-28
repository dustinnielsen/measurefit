# RunCoach — Product Requirements Document

## Overview

RunCoach is a personal iOS running coach app that generates structured, adaptive weekly training plans based on a user's fitness profile and goal. It is not a run tracker. It does not require a subscription, backend, or account. All data lives on-device.

---

## Goals

- Generate scientifically grounded weekly training plans tailored to each user
- Make training plans accessible without coaching fees or subscriptions
- Prioritize injury prevention over performance optimization
- Remain simple enough for a beginner while useful for an intermediate runner

## Non-Goals

- GPS tracking / live run recording
- Social features
- Integration with Apple Health (v1)
- AI/LLM plan generation (rule-based is sufficient)

---

## User Inputs

### Profile

| Field | Type | Options |
|---|---|---|
| Age | Integer | 13–99 |
| Running Ability | Enum | Beginner, Intermediate, Advanced |
| Current Weekly Mileage | Float | Miles per week |
| Longest Recent Run | Float | Miles (within last 4 weeks) |
| Goal | Enum | Get Fit, Lose Weight, 5K, 10K, Half Marathon, Marathon, Faster Mile |
| Goal Date | Date? | Optional target race/goal date |
| Available Running Days | Integer | 2–7 days per week |
| Preferred Long Run Day | Enum | Sun, Mon, Tue, Wed, Thu, Fri, Sat |
| Injury History | [Enum] | None, Knee, IT Band, Shin Splints, Plantar Fasciitis, Hip, Back, Hamstring, Other |
| Strength Training Days | Integer | 0–3 days per week |
| Training Style | Enum | Conservative, Balanced, Aggressive |

---

## Training Plan Generation Rules

### Volume

- Base weekly mileage = current weekly mileage (floor: 5 miles for beginners)
- Max weekly increase: Conservative 5%, Balanced 8%, Aggressive 10%
- Every 4th week is a deload: volume drops to ~80% of previous week
- Long run = 25–35% of weekly total (lower end for beginners)
- Target peak mileage is determined by goal:
  - Get Fit / Lose Weight: 20–30 mpw
  - 5K: 20–30 mpw
  - 10K: 25–35 mpw
  - Half Marathon: 35–45 mpw
  - Marathon: 45–55 mpw
  - Faster Mile: 20–30 mpw (more quality, less volume)

### Intensity Distribution

- 80% of weekly runs should be Easy
- 20% can be Hard (Tempo, Intervals)
- Beginners: no speed work in first 4 weeks
- Intermediate: 1 quality session/week
- Advanced: up to 2 quality sessions/week

### Workout Scheduling

- Long run always on preferred long run day
- No back-to-back hard workouts (quality + quality, or long + quality)
- Rest day should follow long run or precede it if it cannot follow
- Strength on designated strength days, never after a hard run
- Mobility on rest days or as cooldown add-on

### Injury-Adjusted Rules

| Injury | Adjustment |
|---|---|
| Knee / IT Band | No hills in speed work, extra mobility day |
| Shin Splints | Cap weekly increase at 5% regardless of style, extra rest |
| Plantar Fasciitis | No barefoot/minimal; add mobility, no back-to-back running days |
| Hip / Back | Limit tempo to conversational pace; extra strength day (glutes/core) |
| Hamstring | No intervals in first 6 weeks; limit speed to strides |

### Deload Weeks (Week 4, 8, 12, …)

- Total volume ~80% of previous week
- Drop the quality session; replace with an easy run
- Long run shortened to ~20% of total instead of 30–35%
- Described to user as "recovery week"

---

## Plan Duration

- If no goal date: generate a rolling 8-week base plan, re-evaluate after
- If goal date is provided: calculate weeks to goal, build a full periodized plan ending with a 1-week taper
- Minimum plan: 4 weeks
- Maximum plan: 20 weeks (longer goals should be broken into phases)

---

## Workout Types

| Type | Description |
|---|---|
| Easy Run | Conversational pace, Zone 1–2 |
| Long Run | Slower than easy, builds aerobic base and mental endurance |
| Tempo Run | Comfortably hard, ~10K race pace, sustained effort |
| Intervals | Short hard efforts (e.g. 6×400m at 5K pace) with recovery jogs |
| Strides | 4–6 × 20-second accelerations at end of easy run, not truly hard |
| Rest | Full rest or optional walk |
| Strength | Bodyweight or gym session; focus on glutes, core, hips |
| Mobility | Stretching, yoga, foam rolling; ~20 min |

---

## Feedback Loop (v2)

- After each week, user marks runs as Completed / Skipped / Modified
- App adjusts next week's volume if >30% of runs were skipped
- User can rate fatigue on a 1–5 scale each Sunday

---

## Constraints

- iOS 17+ (SwiftData)
- No account/login required
- Offline-first; all data on-device
- Single user profile per device (v1)
