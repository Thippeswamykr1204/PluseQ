# PulseQ — Hospital Queue Management System

A production-grade, real-time queue management system for hospitals. Managers create queues (e.g. "General OPD", "Cardiology"), add patients as tokens, reorder or prioritize them, call the next patient with one click, and track wait-time analytics — all updating live across every connected screen via WebSockets.

**Live demo:** _add your deployed link here_
**Video walkthrough:** _add your Loom/YouTube link here_

---

## Problem Statement

Manual token/queue management in hospitals (shouting numbers, paper tokens, whiteboards) causes confusion, unfair jumps in line, and no visibility into wait times or peak load. PulseQ gives a queue manager a single screen to run the line fairly, handle emergencies (priority tokens), and see analytics that reveal bottlenecks (e.g. which hour has the longest waits) so staffing can be adjusted.

---

## Feature Checklist

| Requirement | Status | Notes |
|---|---|---|
| Manager login | ✅ | JWT auth, bcrypt-hashed passwords |
| Create multiple queues | ✅ | Scoped per manager |
| Add patient → auto token | ✅ | Sequential per-queue token numbers |
| Display waiting list | ✅ | Live via WebSocket, sorted by position |
| Reorder (move up/down) | ✅ | Atomic position swap, boundary-safe |
| Serve next patient (1 click) | ✅ | Enforces single active "serving" slot per queue |
| Cancel a token | ✅ | Soft-delete (status=cancelled), kept for analytics |
| Analytics dashboard | ✅ | Wait time, service time, trend, peak-hour heatmap, per-queue comparison |

---

## Why These Engineering Decisions

**Position-based ordering, not array reordering.**
Each token stores an integer `position`. Moving up/down swaps the position value with the adjacent token in a MongoDB transaction — O(1) and race-safe, instead of rewriting an entire ordered array on every move (which doesn't scale and is prone to lost-update races under concurrent managers).

**Single "serving" slot per queue.**
A hospital counter serves one patient at a time. The `assignNext` endpoint checks server-side (not just in the UI) whether a token is already `serving` before allowing another — closing a real concurrency bug that a naive "just flip status" implementation would miss if two tabs click "Call Next" simultaneously.

**Soft-delete for cancellations.**
Cancelled tokens are marked `status: "cancelled"` rather than removed, so analytics (cancellation rate, no-show trends) stay accurate.

**Transactions on state-changing writes.**
Adding a token (increment counter + create doc) and moving a token (swap two positions) both run inside a MongoDB session/transaction, so a crash mid-operation can't leave the queue in a half-updated state.

**Real-time via Socket.io, not polling.**
Every mutation (`add`, `move`, `assign`, `complete`, `cancel`) emits `queue:updated` to a room scoped to that queue. Any manager viewing the same queue on another device sees the change instantly — this is what makes the app feel like real hospital software instead of a CRUD form.

**Validation at every layer.**
Zod schemas validate all request bodies server-side (never trust the client); React forms validate client-side for instant feedback. Every destructive action (cancel token) requires a confirmation dialog.

---

## Architecture

```
hospital-queue/
├── server/                 Express + MongoDB API
│   └── src/
│       ├── config/         DB connection
│       ├── models/         Manager, Queue, Token (Mongoose schemas + indexes)
│       ├── middleware/     auth (JWT), validate (Zod), errorHandler
│       ├── controllers/    business logic per domain
│       ├── routes/         REST endpoints, thin — just wiring
│       ├── utils/          ApiError, asyncHandler, JWT signing
│       └── realtime.js     Socket.io room broadcast
│
└── client/                 React (Vite) SPA
    └── src/
        ├── api/            axios instance with interceptors
        ├── context/        AuthContext (JWT session)
        ├── components/     reusable UI primitives (Modal, ConfirmDialog, StatCard, Skeleton...)
        ├── pages/          Login, Register, Dashboard, QueueDetail, Analytics
        └── routes/         ProtectedRoute guard
```

**Stack:** MongoDB + Express + React + Node (MERN), Socket.io for real-time, Tailwind CSS + Framer Motion for UI, Recharts for analytics, Zod for validation.

---

## REST API Reference

All routes except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

```
POST   /api/auth/register            Create manager account
POST   /api/auth/login               Log in, returns JWT
GET    /api/auth/me                  Current manager profile

POST   /api/queues                   Create queue
GET    /api/queues                   List manager's queues (with live counts)
GET    /api/queues/:id               Get one queue
PATCH  /api/queues/:id               Update queue
DELETE /api/queues/:id               Delete queue + its tokens

GET    /api/queues/:id/tokens        List tokens (waiting / serving / served)
POST   /api/queues/:id/tokens        Add patient → creates token
POST   /api/queues/:id/assign-next   Call the top waiting token for service
GET    /api/queues/:id/analytics     Wait time, trend, peak hours for this queue

PATCH  /api/tokens/:tokenId/move     Body: { direction: "up" | "down" }
PATCH  /api/tokens/:tokenId/complete Mark the serving token as served
DELETE /api/tokens/:tokenId          Cancel a token

GET    /api/analytics/overview       Aggregated stats across all queues
```

Every response follows `{ success, message, data }`; every error follows `{ success: false, message, details }` with the correct HTTP status (400/401/404/409/422/500).

---

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB (local instance or a free MongoDB Atlas cluster)

### 1. Backend
```bash
cd server
cp .env.example .env     # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev              # http://localhost:5000
```

### 2. Frontend
```bash
cd client
cp .env.example .env     # defaults already point at localhost:5000
npm install
npm run dev               # http://localhost:5173
```

Open `http://localhost:5173`, register a manager account, and start creating queues.

---

## Deployment Suggestion

- **Frontend:** Vercel (connect the `client/` folder, set `VITE_API_URL` / `VITE_SOCKET_URL` env vars to the deployed backend URL)
- **Backend:** Render / Railway (set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` env vars)
- **Database:** MongoDB Atlas free tier

---

## Possible Future Enhancements

- SMS/WhatsApp notification to patient when their token is called (Twilio)
- Public read-only "Now Serving" screen for a waiting-room TV display
- Multi-counter support (several staff serving the same queue in parallel)
- Role-based access (admin vs. front-desk operator) within one hospital account
- Estimated wait time shown to each waiting patient, computed from historical service-time average
