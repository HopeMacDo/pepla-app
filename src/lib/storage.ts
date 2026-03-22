import { createStore, del, get, getMany, keys, set } from "idb-keyval";
import type { Appointment, IntakeRequest } from "./models";

const appStore = createStore("pepla-booking", "app");

type KVKey = `intake:${string}` | `appt:${string}`;

export async function putIntake(req: IntakeRequest) {
  await set(`intake:${req.id}` satisfies KVKey, req, appStore);
}
export async function listIntake(): Promise<IntakeRequest[]> {
  const allKeys = (await keys(appStore)).filter((k) => typeof k === "string" && k.startsWith("intake:")) as string[];
  const items = (await getMany(allKeys, appStore)) as Array<IntakeRequest | undefined>;
  return items.filter(Boolean) as IntakeRequest[];
}

export async function putAppointment(appt: Appointment) {
  await set(`appt:${appt.id}` satisfies KVKey, appt, appStore);
}
export async function listAppointments(): Promise<Appointment[]> {
  const allKeys = (await keys(appStore)).filter((k) => typeof k === "string" && k.startsWith("appt:")) as string[];
  const items = (await getMany(allKeys, appStore)) as Array<Appointment | undefined>;
  return items.filter(Boolean) as Appointment[];
}
export async function deleteAppointment(id: string) {
  await del(`appt:${id}` satisfies KVKey, appStore);
}
