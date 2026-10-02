import { describe, expect, it } from "vitest";
import { ticketAsText } from "./ticket-text";
import type { Ticket } from "../types";

const ticket: Ticket = {
  id: "ticket-1",
  createdAt: "2026-10-02T10:00:00.000Z",
  customer: "Ana García",
  lines: [
    { id: "line-1", description: "Grifo", reference: "GR-1", unitPrice: 12.5, quantity: 2 },
    { id: "line-2", description: "Instalación", unitPrice: 8, quantity: 1 },
  ],
  total: 33,
};

describe("ticketAsText", () => {
  it("copies customer, references, quantities, line totals and ticket total", () => {
    const text = ticketAsText(ticket);
    expect(text).toContain("Cliente: Ana García");
    expect(text).toContain("Grifo\nRef. GR-1\n2 × 12,50 € = 25,00 €");
    expect(text).toContain("Instalación\n1 × 8,00 € = 8,00 €");
    expect(text).toContain("TOTAL: 33,00 €");
  });

  it("does not add an empty client when it is not provided", () => {
    expect(ticketAsText({ ...ticket, customer: undefined })).not.toContain("Cliente:");
  });

  it("includes PENDIENTE only for tickets marked as unpaid", () => {
    expect(ticketAsText(ticket)).not.toContain("Pagado");
    expect(ticketAsText({ ...ticket, pendingPayment: true })).toContain("PENDIENTE");
    expect(ticketAsText({ ...ticket, pendingPayment: false })).not.toContain("PENDIENTE");
  });
});
