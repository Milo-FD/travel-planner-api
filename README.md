# Travel Planner API

An AI-powered travel planning REST API that generates personalized day-by-day itineraries using real-time weather forecasts and live web search for local events.

Built with Node.js, Express, PostgreSQL, and Claude AI. Companion iOS app built with SwiftUI and MapKit.

---

## Features

- **Full JWT authentication** with bcrypt-hashed passwords
- **Real-time weather integration** via OpenWeather API
- **AI-generated itineraries** using Anthropic's Claude with web search
- **Smart day-by-day planning** that matches activities to weather conditions
- **Mood-based preferences** — vibes-first activity recommendations
- **Live event discovery** — finds real festivals, markets, and events happening during your trip
- **Geocoded activity locations** — every activity includes lat/lng coordinates via Nominatim
- **iOS companion app** built with SwiftUI and MapKit

---

## 🏗️ Architecture

```
src/
├── controllers/      # Request handlers
├── services/         # Business logic and external integrations
│   ├── plans.service.js
│   ├── itinerary.service.js
│   ├── weather.service.js
│   └── geocoding.service.js
├── routes/           # API route definitions
├── middleware/        # Auth, error handling
├── db/               # PostgreSQL connection pool
└── utils/            # AppError, async wrapper, validation schemas
```

The API follows a clean **routes → controllers → services** pattern with separation of concerns. Business logic lives in services, controllers handle HTTP, and routes wire it all together.

---

## Tech Stack

**Backend**

- Node.js + Express
- PostgreSQL with normalized schema
- JWT for authentication
- bcrypt for password hashing
- Joi for input validation

**External Services**

- Anthropic Claude API (claude-haiku, with web search tool)
- OpenWeather API
- Nominatim (OpenStreetMap) for geocoding activity locations

**iOS App**

- SwiftUI
- MapKit
- Async/await networking
- MVVM architecture

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- An [Anthropic API key](https://console.anthropic.com)
- An [OpenWeather API key](https://openweathermap.org)

### Installation

1. Clone the repo

```bash
git clone https://github.com/Milo-FD/travel-planner-api.git
cd travel-planner-api
```

2. Install dependencies

```bash
npm install
```

3. Create your `.env` file based on `.env.example`

```bash
cp .env.example .env
```

Then fill in your values:

```
PORT=3000
DATABASE_URL=postgresql://localhost:5432/travel_planner
JWT_SECRET=your_secret_here
OPENWEATHER_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

4. Set up the database

```sql
psql postgres
CREATE DATABASE travel_planner;
\c travel_planner
```

Then run the schema:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  preferences JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weather JSONB
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id UUID REFERENCES plan_days(id) ON DELETE CASCADE,
  time_slot TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT,
  reason TEXT,
  place_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);
```

5. Run the server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Log in and receive JWT |
| `GET`  | `/auth/me` | Get current user (requires token) |

### Plans

All plan endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST`   | `/api/v1/plans` | Generate a new AI-powered trip plan |
| `GET`    | `/api/v1/plans` | List all your plans |
| `GET`    | `/api/v1/plans/:id` | Get a single plan with full itinerary |
| `DELETE` | `/api/v1/plans/:id` | Delete a plan |

### Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `DELETE` | `/api/v1/plans/:id/days/:dayId/activities/:activityId` | Delete a specific activity |
| `POST`   | `/api/v1/plans/:id/days/:dayId/activities/regenerate` | Regenerate an activity for a time slot |

### Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/discovery?city=San Francisco` | Get daily discovery cards for a city |

---

### Example: Create a Plan

```bash
curl -X POST http://localhost:3000/api/v1/plans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "San Francisco",
    "startDate": "2026-04-25",
    "endDate": "2026-04-27",
    "mood": "romanticEra"
  }'
```

### Example Response

```json
{
  "id": "1394b51f-984d-4360-b2fe-59d61106d63f",
  "location": "San Francisco",
  "status": "ready",
  "days": [
    {
      "date": "2026-04-25",
      "weather": { "condition": "Cloudy", "tempHigh": 68, "tempLow": 55 },
      "activities": [
        {
          "timeSlot": "morning",
          "title": "HEAD WEST Marketplace at Ferry Building",
          "placeName": "Ferry Building Marketplace",
          "lat": 37.7955,
          "lng": -122.3937,
          "description": "Browse emerging local brands and handmade goods at this iconic SF waterfront market.",
          "type": "outdoor",
          "reason": "Perfect slow morning energy — coffee, ceramics, and city views."
        }
      ]
    }
  ]
}
```

---

## How It Works

When a user creates a plan, the API:

1. Validates input with Joi schemas
2. Saves a `pending` plan to PostgreSQL
3. Fetches a 5-day weather forecast from OpenWeather
4. Sends weather + mood preferences to Claude with web search enabled
5. Claude searches the web for real local events during those dates
6. Claude returns a structured JSON itinerary tailored to weather and mood
7. The API stores days and activities in normalized tables
8. Geocodes each activity's venue name using Nominatim and stores `lat`/`lng` coordinates
9. Updates plan status to `ready` and returns the complete plan with map coordinates

---

## Security & Best Practices

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 7-day expiry
- Parameterized SQL queries (SQL injection protection)
- Input validation on all routes
- Custom error class with proper HTTP status codes
- Sensitive credentials never committed (`.env` in `.gitignore`)
- Plan resources scoped to authenticated user

---

## iOS App

The companion iOS app is built with SwiftUI using async/await and MVVM architecture. Features include:

- Login & registration flow
- Trip list with swipe-to-delete
- Multi-step trip creation form with mood selection
- Day-by-day itinerary view with weather icons and time-of-day indicators
- Activity detail overlay with image, description, and vibe reasoning
- **Interactive MapKit map** pinned to each activity's real venue location
- **One-tap Google Maps directions** from any activity

---

## Roadmap

- [ ] Like/dislike activities for personalization
- [ ] Real-time weather updates
- [ ] Background job processing for slow AI generation
- [ ] Rate limiting
- [x] Regenerate a specific activity
- [x] Maps integration with activity locations
- [x] Google Maps directions from activity detail

---

## License

---

## Author

Built by Brian (Milo) as a portfolio project demonstrating full-stack development with AI integration.

LinkedIn: http://www.linkedin.com/in/briancristos
