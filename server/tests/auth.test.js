import request from "supertest";
import { connectTestDB, closeTestDB, clearTestDB } from "./setup.js";

let app;

beforeAll(async () => {
  await connectTestDB();
  app = (await import("../src/app.js")).default;
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

describe("Auth", () => {
  const payload = {
    name: "Dr. Test Manager",
    email: "manager@test.com",
    password: "password123",
    hospitalName: "Test Hospital",
  };

  it("registers a new manager and returns a JWT", async () => {
    const res = await request(app).post("/api/auth/register").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.manager.email).toBe(payload.email);
    expect(res.body.data.manager.password).toBeUndefined();
  });

  it("rejects registration with a duplicate email", async () => {
    await request(app).post("/api/auth/register").send(payload);
    const res = await request(app).post("/api/auth/register").send(payload);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects registration with invalid input (short password)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...payload, email: "another@test.com", password: "123" });
    expect(res.status).toBe(422);
  });

  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/register").send(payload);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it("rejects login with wrong password", async () => {
    await request(app).post("/api/auth/register").send(payload);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("blocks access to protected routes without a token", async () => {
    const res = await request(app).get("/api/queues");
    expect(res.status).toBe(401);
  });
});
