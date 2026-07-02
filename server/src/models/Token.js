import mongoose from "mongoose";

const STATUS = ["waiting", "serving", "served", "cancelled"];

const tokenSchema = new mongoose.Schema(
  {
    queue: { type: mongoose.Schema.Types.ObjectId, ref: "Queue", required: true, index: true },
    tokenNumber: { type: Number, required: true }, // sequential per queue, e.g. 1,2,3
    patientName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    priority: { type: Boolean, default: false }, // e.g. emergency case
    status: { type: String, enum: STATUS, default: "waiting", index: true },
    position: { type: Number, required: true, index: true }, // ordering within "waiting" status
    createdAt: { type: Date, default: Date.now },
    calledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tokenSchema.index({ queue: 1, status: 1, position: 1 });

export const TOKEN_STATUS = STATUS;
export default mongoose.model("Token", tokenSchema);
