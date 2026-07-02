import request from "supertest";
import { connectTestDB, closeTestDB, clearTestDB } from "./setup.js";

let app;
let token;
let queueId;

const registerAndLogin = async () => {
  const res = await request(app).post("/api/auth/register").send({
    name: "Dr. Test",
    email: "queue-manager@test.com",
    password: "password123",
  });
  return res.body.data.token;
};

const createQueue = async (authToken) => {
  const res = await request(app)
    .post("/api/queues")
    .set("Authorization", `Bearer ${authToken}`)
    .send({ name: "General OPD", description: "Test queue" });
  return res.body.data._id;
};

const addPatient = async (authToken, qId, patientName) => {
  const res = await request(app)
    .post(`/api/queues/${qId}/tokens`)
    .set("Authorization", `Bearer ${authToken}`)
    .send({ patientName });
  return res.body.data;
};

beforeAll(async () => {
  await connectTestDB();
  app = (await import("../src/app.js")).default;
});

beforeEach(async () => {
  await clearTestDB();
  token = await registerAndLogin();
  queueId = await createQueue(token);
});

afterAll(async () => {
  await closeTestDB();
});

describe("Queue creation", () => {
  it("scopes queues to the owning manager only", async () => {
    const otherToken = await (async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Dr. Other",
        email: "other@test.com",
        password: "password123",
      });
      return res.body.data.token;
    })();

    const res = await request(app)
      .get("/api/queues")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("Token lifecycle", () => {
  it("adds a patient with sequential token numbers", async () => {
    const t1 = await addPatient(token, queueId, "Patient A");
    const t2 = await addPatient(token, queueId, "Patient B");
    expect(t1.tokenNumber).toBe(1);
    expect(t2.tokenNumber).toBe(2);
    expect(t1.status).toBe("waiting");
  });

  it("rejects adding a patient with a name under 2 characters", async () => {
    const res = await request(app)
      .post(`/api/queues/${queueId}/tokens`)
      .set("Authorization", `Bearer ${token}`)
      .send({ patientName: "A" });
    expect(res.status).toBe(422);
  });

  it("lists tokens sorted by position", async () => {
    await addPatient(token, queueId, "Patient A");
    await addPatient(token, queueId, "Patient B");
    await addPatient(token, queueId, "Patient C");

    const res = await request(app)
      .get(`/api/queues/${queueId}/tokens`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.waiting.map((t) => t.patientName)).toEqual([
      "Patient A", "Patient B", "Patient C",
    ]);
  });

  it("moves a token up and swaps position with its neighbor", async () => {
    await addPatient(token, queueId, "Patient A");
    const b = await addPatient(token, queueId, "Patient B");

    await request(app)
      .patch(`/api/tokens/${b._id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "up" });

    const res = await request(app)
      .get(`/api/queues/${queueId}/tokens`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data.waiting.map((t) => t.patientName)).toEqual([
      "Patient B", "Patient A",
    ]);
  });

  it("rejects moving the top token further up (boundary)", async () => {
    const a = await addPatient(token, queueId, "Patient A");
    await addPatient(token, queueId, "Patient B");

    const res = await request(app)
      .patch(`/api/tokens/${a._id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "up" });

    expect(res.status).toBe(400);
  });

  it("rejects moving the bottom token further down (boundary)", async () => {
    await addPatient(token, queueId, "Patient A");
    const b = await addPatient(token, queueId, "Patient B");

    const res = await request(app)
      .patch(`/api/tokens/${b._id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "down" });

    expect(res.status).toBe(400);
  });

  it("assigns the top waiting token for service", async () => {
    const a = await addPatient(token, queueId, "Patient A");
    await addPatient(token, queueId, "Patient B");

    const res = await request(app)
      .post(`/api/queues/${queueId}/assign-next`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(a._id);
    expect(res.body.data.status).toBe("serving");
  });

  it("blocks calling a second patient while one is already being served (race condition guard)", async () => {
    await addPatient(token, queueId, "Patient A");
    await addPatient(token, queueId, "Patient B");

    await request(app)
      .post(`/api/queues/${queueId}/assign-next`)
      .set("Authorization", `Bearer ${token}`);

    // Simulate a second "Call Next" click while Patient A is still being served
    const res = await request(app)
      .post(`/api/queues/${queueId}/assign-next`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already being served/i);
  });

  it("returns 400 when assigning next on an empty queue", async () => {
    const res = await request(app)
      .post(`/api/queues/${queueId}/assign-next`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("completes a serving token and moves it to served", async () => {
    const a = await addPatient(token, queueId, "Patient A");
    await request(app)
      .post(`/api/queues/${queueId}/assign-next`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/tokens/${a._id}/complete`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("served");
    expect(res.body.data.completedAt).toBeDefined();
  });

  it("rejects completing a token that isn't currently being served", async () => {
    const a = await addPatient(token, queueId, "Patient A");
    const res = await request(app)
      .patch(`/api/tokens/${a._id}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("cancels a waiting token", async () => {
    const a = await addPatient(token, queueId, "Patient A");
    const res = await request(app)
      .delete(`/api/tokens/${a._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cancelled");
  });

  it("rejects cancelling an already-served token", async () => {
    const a = await addPatient(token, queueId, "Patient A");
    await request(app)
      .post(`/api/queues/${queueId}/assign-next`)
      .set("Authorization", `Bearer ${token}`);
    await request(app)
      .patch(`/api/tokens/${a._id}/complete`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .delete(`/api/tokens/${a._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("prevents a manager from moving/cancelling tokens in a queue they don't own", async () => {
    const a = await addPatient(token, queueId, "Patient A");

    const otherRes = await request(app).post("/api/auth/register").send({
      name: "Dr. Other",
      email: "intruder@test.com",
      password: "password123",
    });
    const otherToken = otherRes.body.data.token;

    const res = await request(app)
      .delete(`/api/tokens/${a._id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});
