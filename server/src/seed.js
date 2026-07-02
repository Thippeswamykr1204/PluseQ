/**
 * Demo data seeder.
 * Creates one manager, two queues, and ~30 tokens spread across the last
 * 10 days with realistic created/called/completed timestamps — so the
 * Analytics dashboard has real trend/peak-hour data to show on first look.
 *
 * Usage: node src/seed.js
 * Safe to re-run: wipes only data belonging to the demo manager's email.
 */
import "dotenv/config";
import mongoose from "mongoose";
import Manager from "./models/Manager.js";
import Queue from "./models/Queue.js";
import Token from "./models/Token.js";

const DEMO_EMAIL = "demo@pulseq.dev";
const DEMO_PASSWORD = "demo1234";

const NAMES = [
  "Aarav Sharma", "Priya Nair", "Rohan Gupta", "Sneha Iyer", "Vikram Rao",
  "Ananya Das", "Karan Mehta", "Isha Reddy", "Arjun Kumar", "Divya Pillai",
  "Manoj Verma", "Kavya Menon", "Siddharth Joshi", "Neha Bhat", "Rahul Singh",
  "Pooja Desai", "Amit Kapoor", "Ritu Chawla", "Sanjay Nambiar", "Meera Krishnan",
];

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const daysAgo = (days, hour) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, randomBetween(0, 59), 0, 0);
  return d;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for seeding...");

  let manager = await Manager.findOne({ email: DEMO_EMAIL });
  if (manager) {
    const oldQueues = await Queue.find({ manager: manager._id });
    await Token.deleteMany({ queue: { $in: oldQueues.map((q) => q._id) } });
    await Queue.deleteMany({ manager: manager._id });
    console.log("Cleared previous demo data.");
  } else {
    manager = await Manager.create({
      name: "Dr. Asha Rao",
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      hospitalName: "City General Hospital",
    });
    console.log("Created demo manager.");
  }

  const queueDefs = [
    { name: "General OPD", description: "General outpatient consultations" },
    { name: "Cardiology", description: "Cardiology outpatient department" },
  ];

  for (const def of queueDefs) {
    const queue = await Queue.create({ ...def, manager: manager._id });
    let tokenCounter = 0;
    let position = 1;
    const tokensToCreate = [];

    // Spread tokens across the last 10 days, weighted toward business hours (9am-5pm)
    for (let day = 9; day >= 0; day--) {
      const tokensToday = randomBetween(2, 6);
      for (let i = 0; i < tokensToday; i++) {
        tokenCounter += 1;
        const hour = randomBetween(9, 17);
        const createdAt = daysAgo(day, hour);
        const patientName = NAMES[randomBetween(0, NAMES.length - 1)];

        // Older tokens: fully served. Today's last couple: still waiting.
        const isToday = day === 0;
        const isLastOfToday = isToday && i >= tokensToday - 2;

        if (isLastOfToday) {
          tokensToCreate.push({
            queue: queue._id,
            tokenNumber: tokenCounter,
            patientName,
            phone: "",
            priority: Math.random() < 0.15,
            status: "waiting",
            position: position++,
            createdAt,
          });
        } else {
          const waitMinutes = randomBetween(4, 35);
          const serviceMinutes = randomBetween(5, 20);
          const calledAt = new Date(createdAt.getTime() + waitMinutes * 60000);
          const completedAt = new Date(calledAt.getTime() + serviceMinutes * 60000);
          const cancelled = Math.random() < 0.08;

          tokensToCreate.push({
            queue: queue._id,
            tokenNumber: tokenCounter,
            patientName,
            phone: "",
            priority: Math.random() < 0.1,
            status: cancelled ? "cancelled" : "served",
            position: position++,
            createdAt,
            calledAt: cancelled ? null : calledAt,
            completedAt: cancelled ? null : completedAt,
            cancelledAt: cancelled ? calledAt : null,
          });
        }
      }
    }

    await Token.insertMany(tokensToCreate);
    await Queue.findByIdAndUpdate(queue._id, { tokenCounter });
    console.log(`Seeded "${queue.name}" with ${tokensToCreate.length} tokens.`);
  }

  console.log("\nDone. Demo login:");
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
