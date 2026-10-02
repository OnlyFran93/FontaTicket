import type { Appointment } from "../types";

export function sortAppointmentsByDate(appointments: readonly Appointment[]): Appointment[] {
  return [...appointments].sort((a, b) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
  );
}
