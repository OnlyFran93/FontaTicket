import type { Ticket } from "../types";
import { matchesSearch } from "./core";

export interface PeriodSummary {
  labor: number;
  materials: number;
  total: number;
}

function ticketDate(ticket: Ticket): string | null {
  const date = new Date(ticket.createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ticketsInDateRange(tickets: readonly Ticket[], from: string, to: string): Ticket[] {
  if (from && to && from > to) return [];
  return tickets.filter((ticket) => {
    const date = ticketDate(ticket);
    return date !== null && (!from || date >= from) && (!to || date <= to);
  });
}

export function ticketsMatchingCustomer(tickets: readonly Ticket[], query: string): Ticket[] {
  if (!query.trim()) return [...tickets];
  return tickets.filter((ticket) => matchesSearch(query, ticket.customer));
}

export function summarizeTickets(tickets: readonly Ticket[]): PeriodSummary {
  let labor = 0;
  let materials = 0;
  let total = 0;
  for (const ticket of tickets) {
    total += ticket.total;
    for (const line of ticket.lines) {
      const amount = line.quantity * line.unitPrice;
      if (line.description.trim().toLocaleLowerCase("es") === "mano de obra") {
        labor += amount;
      } else {
        materials += amount;
      }
    }
  }
  return {
    labor: Math.round((labor + Number.EPSILON) * 100) / 100,
    materials: Math.round((materials + Number.EPSILON) * 100) / 100,
    total: Math.round((total + Number.EPSILON) * 100) / 100,
  };
}
