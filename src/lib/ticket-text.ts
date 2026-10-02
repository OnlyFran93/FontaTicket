import type { Ticket } from "../types";
import { formatPrice } from "./core";

export function ticketAsText(ticket: Ticket): string {
  return [
    "TICKET DE TRABAJO",
    `Fecha: ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.createdAt))}`,
    ...(ticket.customer ? [`Cliente: ${ticket.customer}`] : []),
    ...(ticket.pendingPayment ? ["PENDIENTE"] : []),
    "",
    ...ticket.lines.map((line) => [
      line.description,
      ...(line.reference ? [`Ref. ${line.reference}`] : []),
      `${line.quantity} × ${formatPrice(line.unitPrice)} = ${formatPrice(line.quantity * line.unitPrice)}`,
    ].join("\n")),
    "",
    `TOTAL: ${formatPrice(ticket.total)}`,
  ].join("\n");
}
