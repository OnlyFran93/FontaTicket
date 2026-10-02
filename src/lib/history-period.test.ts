import { describe, expect, it } from "vitest";
import type { Ticket } from "../types";
import { summarizeTickets, ticketsInDateRange, ticketsMatchingCustomer } from "./history-period";

function ticket(
  id: string,
  createdAt: string,
  lines: Ticket["lines"],
  total: number,
): Ticket {
  return { id, createdAt, lines, total };
}

function localIso(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

describe("history period helpers", () => {
  const augustTicket = ticket("august", localIso(2026, 8, 15, 12), [
    { id: "labor", description: "Mano de obra", unitPrice: 1, quantity: 50 },
    { id: "material", description: "Tubería", unitPrice: 12.5, quantity: 2 },
  ], 75);
  const septemberTicket = ticket("september", localIso(2026, 9, 1, 0), [
    { id: "labor", description: "Mano de obra", unitPrice: 1, quantity: 100 },
    { id: "material", description: "Grifo", unitPrice: 20, quantity: 1 },
  ], 120);

  it("includes both boundary dates and excludes tickets outside the selected range", () => {
    const tickets = [
      ticket("before", localIso(2026, 7, 31, 23, 59), [], 0),
      augustTicket,
      ticket("last-day", localIso(2026, 8, 31, 23, 59), [], 0),
      septemberTicket,
    ];
    expect(ticketsInDateRange(tickets, "2026-08-01", "2026-08-31").map(({ id }) => id))
      .toEqual(["august", "last-day"]);
    expect(ticketsInDateRange(tickets, "", "").map(({ id }) => id)).toEqual(["before", "august", "last-day", "september"]);
    expect(ticketsInDateRange(tickets, "2026-09-01", "2026-08-01")).toEqual([]);
  });

  it("separates labor from materials and totals only included tickets", () => {
    const summary = summarizeTickets([augustTicket]);
    expect(summary).toEqual({ labor: 50, materials: 25, total: 75 });
    expect(summarizeTickets([septemberTicket])).toEqual({ labor: 100, materials: 20, total: 120 });
  });

  it("filters tickets by full or partial customer name regardless of case and accents", () => {
    const namedTicket = { ...augustTicket, id: "named", customer: "José Muñoz" };
    const otherTicket = { ...septemberTicket, id: "other", customer: "Ana" };
    const tickets = [namedTicket, otherTicket, augustTicket];

    const matchingTickets = ticketsMatchingCustomer(tickets, "jose");
    expect(matchingTickets.map(({ id }) => id)).toEqual(["named"]);
    expect(ticketsMatchingCustomer(tickets, "MUÑO").map(({ id }) => id)).toEqual(["named"]);
    expect(ticketsMatchingCustomer(tickets, "  ")).toEqual(tickets);
    expect(ticketsMatchingCustomer(tickets, "inexistente")).toEqual([]);
    expect(summarizeTickets(matchingTickets)).toEqual({ labor: 50, materials: 25, total: 75 });
  });
});
