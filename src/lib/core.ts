import type { CartLine, Product, TicketLine } from "../types";
import { newId } from "./id";

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
}

export function matchesSearch(query: string, ...values: Array<string | null | undefined>): boolean {
  const normalizedQuery = normalizeSearchText(query.trim());
  return Boolean(normalizedQuery) && values.some((value) =>
    normalizeSearchText(value ?? "").includes(normalizedQuery),
  );
}

export function sortProductsWithFavorites(products: readonly Product[], favoriteIds: readonly string[]): Product[] {
  const favorites = new Set(favoriteIds);
  return [...products].sort((a, b) =>
    Number(favorites.has(b.id)) - Number(favorites.has(a.id))
    || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
  );
}

export function parsePrice(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function parseQuantity(value: string): number | null {
  const quantity = Number(value.trim());
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export function ticketTotal(lines: readonly Pick<TicketLine, "unitPrice" | "quantity">[]): number {
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function productToCartLine(product: Product): CartLine {
  if (!product.nombre?.trim() || product.precio === null) {
    throw new Error("Completa el nombre y el precio del producto antes de añadirlo a un ticket.");
  }
  return {
    id: newId(),
    description: product.nombre,
    ...(product.reference ? { reference: product.reference } : {}),
    unitPrice: product.precio,
    quantity: 1,
  };
}

export function addProductLine(lines: CartLine[], product: Product): CartLine[] {
  if (!product.nombre?.trim() || product.precio === null) {
    throw new Error("Completa el nombre y el precio del producto antes de añadirlo a un ticket.");
  }
  const existing = lines.find(
    (line) => (line.reference ?? "") === (product.reference ?? "") && line.description === product.nombre && line.unitPrice === product.precio,
  );
  if (existing) {
    return lines.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line);
  }
  return [...lines, productToCartLine(product)];
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
}
