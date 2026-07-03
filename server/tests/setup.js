import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// A standalone MongoMemoryServer does NOT support transactions
// ("Transaction numbers are only allowed on a replica set member or mongos").
// Our controllers use session.withTransaction() (add token, move token),
// matching production Atlas (which is always a replica set), so the test
// harness must also be a replica set — a single-node one is enough for tests.
let replset;

export const connectTestDB = async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_do_not_use_in_prod";
  process.env.JWT_EXPIRES_IN = "1h";
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replset.getUri());
};

export const closeTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await replset.stop();
};

export const clearTestDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};
