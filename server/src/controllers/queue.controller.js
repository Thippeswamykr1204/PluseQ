import { z } from "zod";
import mongoose from "mongoose";
import Queue from "../models/Queue.js";
import Token from "../models/Token.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";

export const createQueueSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional().default(""),
});

export const createQueue = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const queue = await Queue.create({ name, description, manager: req.manager._id });
  ok(res, queue, "Queue created", 201);
});

// List queues for logged-in manager, with live counts (waiting / served today)
export const listQueues = asyncHandler(async (req, res) => {
  const queues = await Queue.find({ manager: req.manager._id }).sort({ createdAt: -1 }).lean();

  const queueIds = queues.map((q) => q._id);
  const counts = await Token.aggregate([
    { $match: { queue: { $in: queueIds }, status: { $in: ["waiting", "serving"] } } },
    { $group: { _id: { queue: "$queue", status: "$status" }, count: { $sum: 1 } } },
  ]);

  const countMap = {};
  for (const c of counts) {
    const qid = c._id.queue.toString();
    countMap[qid] = countMap[qid] || { waiting: 0, serving: 0 };
    countMap[qid][c._id.status] = c.count;
  }

  const enriched = queues.map((q) => ({
    ...q,
    waitingCount: countMap[q._id.toString()]?.waiting || 0,
    servingCount: countMap[q._id.toString()]?.serving || 0,
  }));

  ok(res, enriched);
});

export const getQueue = asyncHandler(async (req, res) => {
  const queue = await Queue.findOne({ _id: req.params.id, manager: req.manager._id });
  if (!queue) throw new ApiError(404, "Queue not found");
  ok(res, queue);
});

export const updateQueue = asyncHandler(async (req, res) => {
  const queue = await Queue.findOneAndUpdate(
    { _id: req.params.id, manager: req.manager._id },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!queue) throw new ApiError(404, "Queue not found");
  ok(res, queue, "Queue updated");
});

export const deleteQueue = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const queue = await Queue.findOneAndDelete(
        { _id: req.params.id, manager: req.manager._id },
        { session }
      );
      if (!queue) throw new ApiError(404, "Queue not found");
      await Token.deleteMany({ queue: queue._id }, { session });
    });
    ok(res, null, "Queue deleted");
  } finally {
    session.endSession();
  }
});
