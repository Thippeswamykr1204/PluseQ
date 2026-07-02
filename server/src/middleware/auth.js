import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Manager from "../models/Manager.js";

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "Not authenticated. Missing token.");
  }
  const token = header.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const manager = await Manager.findById(decoded.id);
  if (!manager) throw new ApiError(401, "Manager no longer exists");
  req.manager = manager;
  next();
});
