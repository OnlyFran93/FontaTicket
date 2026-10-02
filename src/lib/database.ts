import { openDB, type IDBPDatabase } from "idb";
import type { Appointment, Product, Ticket } from "../types";

interface FontaTicketDb {
  products: {
    key: string;
    value: Product;
  };
  tickets: {
    key: string;
    value: Ticket;
  };
  appointments: {
    key: string;
    value: Appointment;
  };
  settings: {
    key: string;
    value: string;
  };
}

let databasePromise: Promise<IDBPDatabase<FontaTicketDb>> | undefined;

function database(): Promise<IDBPDatabase<FontaTicketDb>> {
  if (!databasePromise) {
    databasePromise = openDB<FontaTicketDb>("fontaticket", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("products")) db.createObjectStore("products", { keyPath: "id" });
        if (!db.objectStoreNames.contains("tickets")) db.createObjectStore("tickets", { keyPath: "id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
        if (!db.objectStoreNames.contains("appointments")) db.createObjectStore("appointments", { keyPath: "id" });
      },
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

export async function getProducts(): Promise<Product[]> {
  const db = await database();
  const products = await db.getAll("products");
  return products.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await database();
  await db.put("products", product);
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await database();
  await db.delete("products", id);
}

export async function replaceProducts(products: Product[]): Promise<void> {
  const db = await database();
  const tx = db.transaction("products", "readwrite");
  await tx.store.clear();
  for (const product of products) await tx.store.put(product);
  await tx.done;
}

export async function clearProducts(): Promise<void> {
  const db = await database();
  await db.clear("products");
}

export async function getTickets(): Promise<Ticket[]> {
  const db = await database();
  const tickets = await db.getAll("tickets");
  return tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveTicket(ticket: Ticket): Promise<void> {
  const db = await database();
  await db.put("tickets", ticket);
}

export async function deleteTicket(id: string): Promise<void> {
  const db = await database();
  await db.delete("tickets", id);
}

export async function clearTickets(): Promise<void> {
  const db = await database();
  await db.clear("tickets");
}

export async function getAppointments(): Promise<Appointment[]> {
  const db = await database();
  return db.getAll("appointments");
}

export async function saveAppointment(appointment: Appointment): Promise<void> {
  const db = await database();
  await db.put("appointments", appointment);
}

export async function deleteAppointment(id: string): Promise<void> {
  const db = await database();
  await db.delete("appointments", id);
}

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await database();
  const setting = await db.get("settings", key);
  return setting?.value;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await database();
  await db.put("settings", { key, value });
}
