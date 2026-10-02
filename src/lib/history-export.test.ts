import { describe, expect, it } from "vitest";
import type { Ticket } from "../types";
import { exportHistoryCsv } from "./history-export";

describe("history CSV export", () => {
  it("exports selected ticket details as Excel-compatible semicolon CSV", () => {
    const ticket: Ticket = {
      id: "ticket-1",
      createdAt: "2026-10-02T13:30:00.000Z",
      customer: 'José "Pepe"; García',
      lines: [
        { id: "labor", description: "Mano de obra", unitPrice: 1, quantity: 50 },
        { id: "material", description: "Codo; PVC", unitPrice: 8.5, quantity: 2 },
      ],
      total: 67,
    };

    const csv = exportHistoryCsv([ticket]);
    const rows = csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n");

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(rows[0]).toBe('"Fecha";"Cliente";"Productos";"Cantidades";"Mano de obra";"Materiales";"Descuentos";"Total";"Estado de pago"');
    expect(rows[1]).toContain('"José ""Pepe""; García"');
    expect(rows[1]).toContain('"Mano de obra | Codo; PVC"');
    expect(rows[1]).toContain('"50 | 2"');
    expect(rows[1]).toContain('"50,00";"17,00";"";"67,00";""');
    expect(rows[1]).not.toContain("Pagado");
    expect(exportHistoryCsv([{ ...ticket, pendingPayment: true }])).toContain('"67,00";"PENDIENTE"');
  });

  it("exports no data rows for an empty filtered history", () => {
    expect(exportHistoryCsv([]).replace(/^\uFEFF/, "").trimEnd().split("\r\n")).toHaveLength(1);
  });
});
