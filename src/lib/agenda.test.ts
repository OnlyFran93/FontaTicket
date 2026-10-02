import { describe, expect, it } from "vitest";
import { sortAppointmentsByDate } from "./agenda";
import type { Appointment } from "../types";

const appointment = (id: string, date: string, time: string): Appointment => ({
  id,
  client: "Cliente",
  date,
  time,
  address: "Dirección",
  work: "Trabajo",
  materials: [],
});

describe("agenda", () => {
  it("orders appointments by date and then time without mutating its input", () => {
    const appointments = [
      appointment("late", "2026-10-03", "16:30"),
      appointment("next-day", "2026-10-04", "08:00"),
      appointment("early", "2026-10-03", "09:15"),
    ];

    expect(sortAppointmentsByDate(appointments).map(({ id }) => id)).toEqual(["early", "late", "next-day"]);
    expect(appointments.map(({ id }) => id)).toEqual(["late", "next-day", "early"]);
  });
});
