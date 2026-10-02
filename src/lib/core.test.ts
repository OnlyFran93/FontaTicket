import { describe, expect, it } from "vitest";
import { addProductLine, matchesSearch, normalizeSearchText, parsePrice, parseQuantity, sortProductsWithFavorites, ticketTotal } from "./core";
import type { Product } from "../types";

const product: Product = {
  id: "p1",
  reference: "REF-1",
  nombre: "Válvula",
  precio: 12.5,
  foto: null,
};

describe("ticket helpers", () => {
  it("normalizes search text without changing accents in stored product data", () => {
    expect(normalizeSearchText("Unión")).toBe("union");
    expect(normalizeSearchText("SIFÓN")).toBe("sifon");
    expect(normalizeSearchText("manguito")).toBe("manguito");
    expect(product.nombre).toBe("Válvula");
  });

  it("matches product names and references regardless of accents or letter case", () => {
    expect(matchesSearch("codo", "Codo PVC")).toBe(true);
    expect(matchesSearch("union", "Unión tubo metálico")).toBe(true);
    expect(matchesSearch("SIFÓN", "Sifón botella")).toBe(true);
    expect(matchesSearch("manguito", "MANGUITO unión")).toBe(true);
    expect(matchesSearch("ref-ab", null, "REF-ÁB-12")).toBe(true);
    expect(matchesSearch("codo", "Válvula")).toBe(false);
    expect(matchesSearch("  ", "Codo")).toBe(false);
  });

  it("sorts manually favorited products before other products", () => {
    const products = [
      { ...product, id: "z", nombre: "Zócalo" },
      { ...product, id: "b", nombre: "Codo" },
      { ...product, id: "a", nombre: "Unión" },
    ];

    expect(sortProductsWithFavorites(products, ["z", "a"]).map(({ id }) => id)).toEqual(["a", "z", "b"]);
    expect(products.map(({ id }) => id)).toEqual(["z", "b", "a"]);
  });

  it("parses Spanish decimal commas and rejects invalid or negative prices", () => {
    expect(parsePrice("12,50")).toBe(12.5);
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice("-1")).toBeNull();
    expect(parsePrice("no es un precio")).toBeNull();
    expect(parsePrice("")).toBeNull();
  });

  it("parses positive whole quantities and rejects invalid values", () => {
    expect(parseQuantity("150")).toBe(150);
    expect(parseQuantity("1")).toBe(1);
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("1.5")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
  });

  it("adds matching products by increasing their quantity and calculates rounded totals", () => {
    const once = addProductLine([], product);
    const twice = addProductLine(once, product);
    expect(twice).toHaveLength(1);
    expect(twice[0].quantity).toBe(2);
    expect(ticketTotal(twice)).toBe(25);
    expect(ticketTotal([{ unitPrice: 0.1, quantity: 1 }, { unitPrice: 0.2, quantity: 1 }])).toBe(0.3);
  });

  it("does not allow incomplete imported products into a ticket", () => {
    expect(() => addProductLine([], { ...product, nombre: "", precio: null })).toThrow("Completa el nombre y el precio");
    expect(() => addProductLine([], { ...product, nombre: null, precio: 12 })).toThrow("Completa el nombre y el precio");
  });
});
