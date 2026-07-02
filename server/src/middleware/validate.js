import { ApiError } from "../utils/ApiError.js";

// Generic zod-schema validator middleware factory
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return next(new ApiError(422, "Invalid input", details));
  }
  req.body = result.data;
  next();
};
