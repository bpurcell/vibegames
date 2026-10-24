import { openDB } from "idb";
import type { Session } from "./types";
const db = () =>
  openDB("identity-studio", 1, {
    upgrade(db) {
      db.createObjectStore("sessions", { keyPath: "id" });
    },
  });
export async function listSessions(): Promise<Session[]> {
  return (await (await db()).getAll("sessions")).sort(
    (a: Session, b: Session) => b.updatedAt.localeCompare(a.updatedAt),
  );
}
export async function saveSession(session: Session) {
  await (await db()).put("sessions", session);
}
export async function deleteSession(id: string) {
  await (await db()).delete("sessions", id);
}
export async function deleteAll() {
  await (await db()).clear("sessions");
}
