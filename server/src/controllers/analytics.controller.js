import mongoose from "mongoose";
import Queue from "../models/Queue.js";
import Token from "../models/Token.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";

const assertOwnedQueue = async (queueId, managerId) => {
  const queue = await Queue.findOne({ _id: queueId, manager: managerId });
  if (!queue) throw new ApiError(404, "Queue not found");
  return queue;
};

// Analytics for a single queue: avg wait time, throughput, trend, status breakdown
export const queueAnalytics = asyncHandler(async (req, res) => {
  const queue = await assertOwnedQueue(req.params.id, req.manager._id);
  const qid = new mongoose.Types.ObjectId(queue._id);

  const [statusBreakdown] = await Promise.all([
    Token.aggregate([
      { $match: { queue: qid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Avg wait time (createdAt -> calledAt) for tokens that were called
  const waitTimeAgg = await Token.aggregate([
    { $match: { queue: qid, calledAt: { $ne: null } } },
    {
      $project: {
        waitMs: { $subtract: ["$calledAt", "$createdAt"] },
      },
    },
    { $group: { _id: null, avgWaitMs: { $avg: "$waitMs" }, maxWaitMs: { $max: "$waitMs" }, minWaitMs: { $min: "$waitMs" } } },
  ]);

  // Avg service time (calledAt -> completedAt)
  const serviceTimeAgg = await Token.aggregate([
    { $match: { queue: qid, calledAt: { $ne: null }, completedAt: { $ne: null } } },
    { $project: { serviceMs: { $subtract: ["$completedAt", "$calledAt"] } } },
    { $group: { _id: null, avgServiceMs: { $avg: "$serviceMs" } } },
  ]);

  // Queue length trend: tokens created per day, last 14 days
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const trend = await Token.aggregate([
    { $match: { queue: qid, createdAt: { $gte: fourteenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        added: { $sum: 1 },
        served: { $sum: { $cond: [{ $eq: ["$status", "served"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Peak hour heatmap: count of tokens added grouped by hour of day
  const hourly = await Token.aggregate([
    { $match: { queue: qid } },
    { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const statusMap = { waiting: 0, serving: 0, served: 0, cancelled: 0 };
  for (const s of statusBreakdown) statusMap[s._id] = s.count;

  ok(res, {
    statusBreakdown: statusMap,
    avgWaitTimeMs: waitTimeAgg[0]?.avgWaitMs || 0,
    minWaitTimeMs: waitTimeAgg[0]?.minWaitMs || 0,
    maxWaitTimeMs: waitTimeAgg[0]?.maxWaitMs || 0,
    avgServiceTimeMs: serviceTimeAgg[0]?.avgServiceMs || 0,
    trend,
    hourlyDistribution: hourly,
    totalPatients: Object.values(statusMap).reduce((a, b) => a + b, 0),
  });
});

// Aggregated analytics across ALL queues owned by manager (overview dashboard)
export const overviewAnalytics = asyncHandler(async (req, res) => {
  const queues = await Queue.find({ manager: req.manager._id }).select("_id name");
  const qids = queues.map((q) => q._id);

  const statusBreakdown = await Token.aggregate([
    { $match: { queue: { $in: qids } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const waitTimeAgg = await Token.aggregate([
    { $match: { queue: { $in: qids }, calledAt: { $ne: null } } },
    { $project: { waitMs: { $subtract: ["$calledAt", "$createdAt"] } } },
    { $group: { _id: null, avgWaitMs: { $avg: "$waitMs" } } },
  ]);

  const perQueue = await Token.aggregate([
    { $match: { queue: { $in: qids } } },
    {
      $group: {
        _id: "$queue",
        total: { $sum: 1 },
        served: { $sum: { $cond: [{ $eq: ["$status", "served"] }, 1, 0] } },
        waiting: { $sum: { $cond: [{ $eq: ["$status", "waiting"] }, 1, 0] } },
      },
    },
  ]);

  const queueNameMap = Object.fromEntries(queues.map((q) => [q._id.toString(), q.name]));
  const perQueueEnriched = perQueue.map((p) => ({
    queueId: p._id,
    queueName: queueNameMap[p._id.toString()] || "Unknown",
    total: p.total,
    served: p.served,
    waiting: p.waiting,
  }));

  const statusMap = { waiting: 0, serving: 0, served: 0, cancelled: 0 };
  for (const s of statusBreakdown) statusMap[s._id] = s.count;

  ok(res, {
    totalQueues: queues.length,
    statusBreakdown: statusMap,
    avgWaitTimeMs: waitTimeAgg[0]?.avgWaitMs || 0,
    perQueue: perQueueEnriched,
  });
});

// Condensed "today" stats for the dashboard header strip
export const todaySummary = asyncHandler(async (req, res) => {
  const queues = await Queue.find({ manager: req.manager._id }).select("_id");
  const qids = queues.map((q) => q._id);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [patientsToday, servedToday, waitTimeAgg] = await Promise.all([
    Token.countDocuments({ queue: { $in: qids }, createdAt: { $gte: startOfDay } }),
    Token.countDocuments({ queue: { $in: qids }, status: "served", completedAt: { $gte: startOfDay } }),
    Token.aggregate([
      { $match: { queue: { $in: qids }, calledAt: { $ne: null }, createdAt: { $gte: startOfDay } } },
      { $project: { waitMs: { $subtract: ["$calledAt", "$createdAt"] } } },
      { $group: { _id: null, avgWaitMs: { $avg: "$waitMs" } } },
    ]),
  ]);

  ok(res, {
    patientsToday,
    servedToday,
    avgWaitTodayMs: waitTimeAgg[0]?.avgWaitMs || 0,
    activeQueues: queues.length,
  });
});

// Recent activity feed across all of the manager's queues, derived from
// token status transitions (uses each token's `updatedAt`, which Mongoose
// bumps automatically on every save — no separate activity log needed).
export const recentActivity = asyncHandler(async (req, res) => {
  const queues = await Queue.find({ manager: req.manager._id }).select("_id name");
  const qids = queues.map((q) => q._id);
  const queueNameMap = Object.fromEntries(queues.map((q) => [q._id.toString(), q.name]));

  const tokens = await Token.find({ queue: { $in: qids } })
    .sort({ updatedAt: -1 })
    .limit(15)
    .lean();

  const labelFor = (t) => {
    if (t.status === "cancelled") return { type: "cancelled", label: `${t.patientName}'s token was cancelled` };
    if (t.status === "served") return { type: "served", label: `${t.patientName} was marked as served` };
    if (t.status === "serving") return { type: "serving", label: `${t.patientName} called for service` };
    return { type: "added", label: `${t.patientName} added to the queue` };
  };

  const activity = tokens.map((t) => ({
    id: t._id,
    tokenNumber: t.tokenNumber,
    queueName: queueNameMap[t.queue.toString()] || "Unknown queue",
    timestamp: t.updatedAt,
    ...labelFor(t),
  }));

  ok(res, activity);
});
