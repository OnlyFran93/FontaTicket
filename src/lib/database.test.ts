import { beforeEach, describe, expect, it } from "vitest";
import { clearProducts, clearTickets, deleteAppointment, deleteProduct, deleteTicket, getAppointments, getProducts, getTickets, replaceProducts, saveAppointment, saveProduct, saveTicket } from "./database";
import type { Appointment, Product, Ticket } from "../types";

describe("local database", () => {
  beforeEach(async () => {
    await replaceProducts([]);
    for (const ticket of await getTickets()) await deleteTicket(ticket.id);
    for (const appointment of await getAppointments()) await deleteAppointment(appointment.id);
  });

  it("persists catalog and history independently", async () => {
    const product: Product = { id: "p1", reference: "REF", nombre: "Grifo", precio: 8, foto: null };
    const ticket: Ticket = {
      id: "t1",
      createdAt: "2026-01-01T10:00:00.000Z",
      lines: [{ id: "l1", description: "Grifo", reference: "REF", unitPrice: 8, quantity: 1 }],
      total: 8,
    };
    await replaceProducts([product]);
    await saveTicket(ticket);
    expect(await getProducts()).toEqual([product]);
    expect(await getTickets()).toEqual([ticket]);

    await clearProducts();
    expect(await getProducts()).toEqual([]);
    expect(await getTickets()).toEqual([ticket]);
  });

  it("updates the same product record, including its stored photo", async () => {
    const product: Product = { id: "p1", reference: "REF", nombre: "Grifo", precio: 8, foto: null };
    await saveProduct(product);
    await saveProduct({ ...product, nombre: "Grifo nuevo", precio: 9, foto: "data:image/png;base64,aGVsbG8=" });
    expect(await getProducts()).toEqual([
      { ...product, nombre: "Grifo nuevo", precio: 9, foto: "data:image/png;base64,aGVsbG8=" },
    ]);
  });

  it("deleting a catalog product does not modify ticket history", async () => {
    const product: Product = { id: "p1", reference: "REF", nombre: "Grifo", precio: 8, foto: null };
    const ticket: Ticket = {
      id: "t1",
      createdAt: "2026-01-01T10:00:00.000Z",
      lines: [{ id: "l1", description: "Grifo", reference: "REF", unitPrice: 8, quantity: 1 }],
      total: 8,
    };
    await replaceProducts([product]);
    await saveTicket(ticket);

    await deleteProduct(product.id);

    expect(await getProducts()).toEqual([]);
    expect(await getTickets()).toEqual([ticket]);
  });

  it("clearing all ticket history leaves the catalog unchanged", async () => {
    const product: Product = { id: "p1", reference: "REF", nombre: "Grifo", precio: 8, foto: null };
    const ticket: Ticket = {
      id: "t1",
      createdAt: "2026-01-01T10:00:00.000Z",
      lines: [{ id: "l1", description: "Grifo", reference: "REF", unitPrice: 8, quantity: 1 }],
      total: 8,
    };
    await replaceProducts([product]);
    await saveTicket(ticket);

    await clearTickets();

    expect(await getProducts()).toEqual([product]);
    expect(await getTickets()).toEqual([]);
  });

  it("persists and clears the pending payment flag with its ticket", async () => {
    const ticket: Ticket = {
      id: "t1",
      createdAt: "2026-01-01T10:00:00.000Z",
      lines: [{ id: "l1", description: "Grifo", unitPrice: 8, quantity: 1 }],
      total: 8,
    };
    await saveTicket(ticket);

    await saveTicket({ ...ticket, pendingPayment: true });
    expect(await getTickets()).toEqual([{ ...ticket, pendingPayment: true }]);

    const paidTicket = { ...ticket };
    await saveTicket(paidTicket);
    expect(await getTickets()).toEqual([ticket]);
  });

  it("persists agenda appointments and updates material checkboxes with the appointment", async () => {
    const appointment: Appointment = {
      id: "a1",
      client: "Ana",
      date: "2026-10-03",
      time: "09:30",
      address: "Calle Mayor",
      work: "Reparar grifo",
      materials: [{ id: "m1", name: "Junta", acquired: false }],
    };
    await saveAppointment(appointment);
    await saveAppointment({
      ...appointment,
      materials: [{ ...appointment.materials[0], acquired: true }],
    });

    expect(await getAppointments()).toEqual([{
      ...appointment,
      materials: [{ ...appointment.materials[0], acquired: true }],
    }]);

    await deleteAppointment(appointment.id);
    expect(await getAppointments()).toEqual([]);
  });
});
