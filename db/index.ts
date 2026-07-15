import { getDatabase } from "@/lib/server/bindings";

export function getDb() {
  return getDatabase();
}
