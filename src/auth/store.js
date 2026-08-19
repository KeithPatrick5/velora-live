import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const file = path.resolve("data/state.json");

async function load() {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch { return { users: {}, sessions: {} }; }
}
async function save(state) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state, null, 2));
}
export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}
export function verifyPassword(password, record) {
  const actual = crypto.scryptSync(password, record.salt, 64);
  const expected = Buffer.from(record.hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
export async function signup({ name, email, password }) {
  const state = await load();
  if (state.users[email]) throw new Error("An account with that email already exists.");
  const id = crypto.randomUUID();
  state.users[email] = { id, name: name || email.split("@")[0], email, password: hashPassword(password), library: [], items: [], progress: [] };
  await save(state);
  return createSession(email);
}
export async function signin({ email, password }) {
  const state = await load();
  const user = state.users[email];
  if (!user || !verifyPassword(password, user.password)) throw new Error("Email or password is incorrect.");
  return createSession(email);
}
async function createSession(email) {
  const state = await load();
  const sid = crypto.randomBytes(32).toString("hex");
  state.sessions[sid] = { email, createdAt: Date.now() };
  await save(state);
  return { sid, user: publicUser(state.users[email]) };
}
export async function userBySession(sid) {
  if (!sid) return null;
  const state = await load();
  const sess = state.sessions[sid];
  if (!sess || !state.users[sess.email]) return null;
  return { state, user: state.users[sess.email], email: sess.email };
}
export async function logout(sid) {
  const state = await load();
  delete state.sessions[sid];
  await save(state);
}
export async function updateUser(sid, updater) {
  const record = await userBySession(sid);
  if (!record) return null;
  updater(record.user);
  record.state.users[record.email] = record.user;
  await save(record.state);
  return record.user;
}
export function publicUser(user) { return user ? { id: user.id, name: user.name, email: user.email } : null; }
