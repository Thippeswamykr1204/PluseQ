import { z } from "zod";
import mongoose from "mongoose";
import Queue from "../models/Queue.js";
import Token from "../models/Token.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import { getIO } from "../realtime.js";

export const addTokenSchema = z.object({
  patientName: z.string().min(2).max(100),
  phone: z.string().max(20).optional().default(""),
  priority: z.boolean().optional().default(false),
});

const assertOwnedQueue = async (queueId, managerId) => {
  const queue = await Queue.findOne({ _id: queueId, manager: managerId });
  if (!queue) throw new ApiError(404, "Queue not found");
  return queue;
};

const emitQueueUpdate = (queueId) => {
  const io = getIO();
  if (io) io.to(`queue:${queueId}`).emit("queue:updated", { queueId });
};

// Pushed to a manager-scoped room so the Dashboard's live activity feed can
// update in real time without polling. The manager also gets an initial
// snapshot from GET /api/analytics/activity on page load.
const emitActivity = (managerId, activity) => {
  const io = getIO();
  if (io) io.to(`manager:${managerId}`).emit("activity:new", activity);
};

const DEFAULT_SERVICE_TIME_MS = 5 * 60 * 1000; // fallback estimate: 5 min/patient before any history exists

// Average service time (calledAt -> completedAt) over this queue's last 20
// served patients. Used to estimate wait time for people still in line.
const getAvgServiceTimeMs = async (queueId) => {
  const recent = await Token.aggregate([
    { $match: { queue: new mongoose.Types.ObjectId(queueId), status: "served", calledAt: { $ne: null }, completedAt: { $ne: null } } },
    { $sort: { completedAt: -1 } },
    { $limit: 20 },
    { $project: { serviceMs: { $subtract: ["$completedAt", "$calledAt"] } } },
    { $group: { _id: null, avgMs: { $avg: "$serviceMs" } } },
  ]);
  return recent[0]?.avgMs || DEFAULT_SERVICE_TIME_MS;
};

// List tokens for a queue, split by status, sorted by position.
// Each waiting token gets an estimatedWaitMinutes based on how many people
// are ahead of it and this queue's own historical average service time.
export const listTokens = asyncHandler(async (req, res) => {
  await assertOwnedQueue(req.params.id, req.manager._id);

  const tokens = await Token.find({ queue: req.params.id, status: { $ne: "cancelled" } })
    .sort({ position: 1 })
    .lean();

  const waiting = tokens.filter((t) => t.status === "waiting");
  const serving = tokens.filter((t) => t.status === "serving");
  const served = tokens.filter((t) => t.status === "served");

  if (waiting.length > 0) {
    const avgServiceMs = await getAvgServiceTimeMs(req.params.id);
    waiting.forEach((t, idx) => {
      // idx patients are ahead of this one; +1 accounts for whoever is
      // currently being served (if anyone) finishing first.
      const aheadCount = idx + (serving.length > 0 ? 1 : 0);
      t.estimatedWaitMinutes = Math.round((aheadCount * avgServiceMs) / 60000);
    });
  }

  ok(res, { waiting, serving, served });
});

// Add a new patient/token to the end of the waiting line
export const addToken = asyncHandler(async (req, res) => {
  const queue = await assertOwnedQueue(req.params.id, req.manager._id);
  const { patientName, phone, priority } = req.body;

  const session = await mongoose.startSession();
  let token;
  try {
    await session.withTransaction(async () => {
      const updatedQueue = await Queue.findByIdAndUpdate(
        queue._id,
        { $inc: { tokenCounter: 1 } },
        { new: true, session }
      );

      const maxPosDoc = await Token.findOne({ queue: queue._id, status: "waiting" })
        .sort({ position: -1 })
        .session(session);
      const nextPosition = maxPosDoc ? maxPosDoc.position + 1 : 1;

      const created = await Token.create(
        [
          {
            queue: queue._id,
            tokenNumber: updatedQueue.tokenCounter,
            patientName,
            phone,
            priority,
            status: "waiting",
            position: nextPosition,
          },
        ],
        { session }
      );
      token = created[0];
    });
  } finally {
    session.endSession();
  }

  emitQueueUpdate(queue._id);
  emitActivity(queue.manager, {
    id: token._id,
    type: "added",
    label: `${token.patientName} added to the queue`,
    queueName: queue.name,
    tokenNumber: token.tokenNumber,
    timestamp: token.createdAt,
  });
  ok(res, token, "Patient added to queue", 201);
});

// Move a waiting token up or down by swapping position with its neighbor
export const moveToken = asyncHandler(async (req, res) => {
  const direction = req.body.direction;
  if (!["up", "down"].includes(direction)) {
    throw new ApiError(422, "direction must be 'up' or 'down'");
  }

  const token = await Token.findById(req.params.tokenId);
  if (!token) throw new ApiError(404, "Token not found");
  await assertOwnedQueue(token.queue, req.manager._id);

  if (token.status !== "waiting") {
    throw new ApiError(400, "Only waiting patients can be reordered");
  }

  const comparator = direction === "up" ? { $lt: token.position } : { $gt: token.position };
  const sortOrder = direction === "up" ? -1 : 1;

  const neighbor = await Token.findOne({
    queue: token.queue,
    status: "waiting",
    position: comparator,
  }).sort({ position: sortOrder });

  if (!neighbor) {
    throw new ApiError(400, `Patient is already at the ${direction === "up" ? "top" : "bottom"} of the queue`);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const tempPos = token.position;
      await Token.findByIdAndUpdate(token._id, { position: neighbor.position }, { session });
      await Token.findByIdAndUpdate(neighbor._id, { position: tempPos }, { session });
    });
  } finally {
    session.endSession();
  }

  emitQueueUpdate(token.queue);
  ok(res, null, "Position updated");
});

// Assign the token currently at the top of the waiting line for service.
// Enforces a single active "serving" token per queue (one counter model).
export const assignNext = asyncHandler(async (req, res) => {
  const queue = await assertOwnedQueue(req.params.id, req.manager._id);

  const alreadyServing = await Token.findOne({ queue: queue._id, status: "serving" });
  if (alreadyServing) {
    throw new ApiError(400, `Patient #${alreadyServing.tokenNumber} is already being served. Complete that first.`);
  }

  const top = await Token.findOne({ queue: queue._id, status: "waiting" }).sort({ position: 1 });
  if (!top) throw new ApiError(400, "Queue is empty. No patients waiting.");

  top.status = "serving";
  top.calledAt = new Date();
  await top.save();

  emitQueueUpdate(queue._id);
  emitActivity(queue.manager, {
    id: top._id,
    type: "serving",
    label: `${top.patientName} called for service`,
    queueName: queue.name,
    tokenNumber: top.tokenNumber,
    timestamp: top.calledAt,
  });
  ok(res, top, `Patient #${top.tokenNumber} called for service`);
});

// Mark the currently-serving token as completed
export const completeToken = asyncHandler(async (req, res) => {
  const token = await Token.findById(req.params.tokenId);
  if (!token) throw new ApiError(404, "Token not found");
  const queue = await assertOwnedQueue(token.queue, req.manager._id);

  if (token.status !== "serving") throw new ApiError(400, "Only a patient currently being served can be completed");

  token.status = "served";
  token.completedAt = new Date();
  await token.save();

  emitQueueUpdate(token.queue);
  emitActivity(queue.manager, {
    id: token._id,
    type: "served",
    label: `${token.patientName} was marked as served`,
    queueName: queue.name,
    tokenNumber: token.tokenNumber,
    timestamp: token.completedAt,
  });
  ok(res, token, "Marked as served");
});

// Cancel a token (soft delete, kept for analytics)
export const cancelToken = asyncHandler(async (req, res) => {
  const token = await Token.findById(req.params.tokenId);
  if (!token) throw new ApiError(404, "Token not found");
  const queue = await assertOwnedQueue(token.queue, req.manager._id);

  if (["served", "cancelled"].includes(token.status)) {
    throw new ApiError(400, `Cannot cancel a token that is already ${token.status}`);
  }

  token.status = "cancelled";
  token.cancelledAt = new Date();
  await token.save();

  emitQueueUpdate(token.queue);
  emitActivity(queue.manager, {
    id: token._id,
    type: "cancelled",
    label: `${token.patientName}'s token was cancelled`,
    queueName: queue.name,
    tokenNumber: token.tokenNumber,
    timestamp: token.cancelledAt,
  });
  ok(res, token, "Token cancelled");
});
