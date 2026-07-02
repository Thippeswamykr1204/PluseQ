import mongoose from "mongoose";

const queueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "Manager", required: true, index: true },
    isActive: { type: Boolean, default: true },
    tokenCounter: { type: Number, default: 0 }, // monotonically increasing, used for unique token numbers
  },
  { timestamps: true }
);

queueSchema.index({ manager: 1, createdAt: -1 });

export default mongoose.model("Queue", queueSchema);
