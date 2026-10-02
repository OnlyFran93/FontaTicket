import type { Ticket } from "../types";

const headers = [
  "Fecha",
  "Cliente",
  "Productos",
  "Cantidades",
  "Mano de obra",
  "Materiales",
  "Descuentos",
  "Total",
  "Estado de pago",
];

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function ticketLaborAndMaterials(ticket: Ticket): { labor: number; materials: number } {
  return ticket.lines.reduce((summary, line) => {
    const amount = line.quantity * line.unitPrice;
    if (line.description.trim().toLocaleLowerCase("es") === "mano de obra") {
      summary.labor += amount;
    } else {
      summary.materials += amount;
    }
    return summary;
  }, { labor: 0, materials: 0 });
}

export function exportHistoryCsv(tickets: readonly Ticket[]): string {
  const rows = tickets.map((ticket) => {
    const { labor, materials } = ticketLaborAndMaterials(ticket);
    const products = ticket.lines.map((line) => line.description).join(" | ");
    const quantities = ticket.lines.map((line) => line.quantity).join(" | ");
    return [
      new Date(ticket.createdAt).toLocaleString("es-ES"),
      ticket.customer ?? "",
      products,
      quantities,
      labor.toFixed(2).replace(".", ","),
      materials.toFixed(2).replace(".", ","),
      "",
      ticket.total.toFixed(2).replace(".", ","),
      ticket.pendingPayment ? "PENDIENTE" : "",
    ].map(csvCell).join(";");
  });

  return `\uFEFF${[headers.map(csvCell).join(";"), ...rows].join("\r\n")}\r\n`;
}
