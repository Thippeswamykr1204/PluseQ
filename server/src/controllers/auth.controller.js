import { z } from "zod";
import Manager from "../models/Manager.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import { signJwt } from "../utils/generateToken.js";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  hospitalName: z.string().max(120).optional().default(""),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, hospitalName } = req.body;

  const existing = await Manager.findOne({ email });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const manager = await Manager.create({ name, email, password, hospitalName });
  const token = signJwt({ id: manager._id });

  ok(
    res,
    {
      token,
      manager: { id: manager._id, name: manager.name, email: manager.email, hospitalName: manager.hospitalName },
    },
    "Account created successfully",
    201
  );
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const manager = await Manager.findOne({ email }).select("+password");
  if (!manager) throw new ApiError(401, "Invalid email or password");

  const match = await manager.comparePassword(password);
  if (!match) throw new ApiError(401, "Invalid email or password");

  const token = signJwt({ id: manager._id });

  ok(res, {
    token,
    manager: { id: manager._id, name: manager.name, email: manager.email, hospitalName: manager.hospitalName },
  }, "Logged in successfully");
});

export const me = asyncHandler(async (req, res) => {
  ok(res, {
    id: req.manager._id,
    name: req.manager.name,
    email: req.manager.email,
    hospitalName: req.manager.hospitalName,
  });
});
