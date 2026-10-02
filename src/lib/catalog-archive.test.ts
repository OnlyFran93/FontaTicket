import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { exportCatalogArchive, importCatalogArchive } from "./catalog-archive";
import type { Product } from "../types";

const products: Product[] = [
  { id: "one", reference: "REF-1", nombre: "Grifo", precio: 18.5, foto: "data:image/png;base64,aGVsbG8=" },
  { id: "two", reference: "REF-2", nombre: "Tubo", precio: 3, foto: null },
];

describe("catalog ZIP", () => {
  it("exports product fields and real image bytes, then restores image associations", async () => {
    const archive = await exportCatalogArchive(products);
    const zip = await JSZip.loadAsync(archive);
    const json = JSON.parse(await zip.file("productos.json")!.async("string")) as Array<Record<string, unknown>>;

    expect(zip.files["imagenes/"]?.dir).toBe(true);
    expect(json.map((item) => item.reference)).toEqual(["REF-1", "REF-2"]);
    expect(json[0].foto).toMatch(/^imagenes\/.+\.png$/);
    expect(json[1].foto).toBeNull();
    expect(await zip.file(String(json[0].foto))!.async("string")).toBe("hello");

    const restored = await importCatalogArchive(archive);
    expect(restored.map(({ reference, nombre, precio }) => ({ reference, nombre, precio }))).toEqual([
      { reference: "REF-1", nombre: "Grifo", precio: 18.5 },
      { reference: "REF-2", nombre: "Tubo", precio: 3 },
    ]);
    expect(restored[0].foto).toBe("data:image/png;base64,aGVsbG8=");
    expect(restored[1].foto).toBeNull();
  });

  it("rejects ZIPs with missing referenced image files", async () => {
    const zip = new JSZip();
    zip.file("productos.json", JSON.stringify([
      { reference: "REF", nombre: "Grifo", precio: 10, foto: "imagenes/falta.png" },
    ]));
    await expect(importCatalogArchive(await zip.generateAsync({ type: "blob" }))).rejects.toThrow("Falta la imagen");
  });

  it("omits products missing both name and price, while preserving other incomplete records", async () => {
    const zip = new JSZip();
    zip.file("productos.json", JSON.stringify([
      { referencia: "REF-3", nombre: "", precio: null, foto: "" },
      { reference: "NO-NAME", precio: 5 },
      { reference: "NO-PRICE", nombre: "Tubo" },
      { reference: "NULL-NAME-PRICE", nombre: null, precio: null, foto: null },
      { reference: null, nombre: "Sin referencia", precio: null, foto: null },
    ]));
    const imported = await importCatalogArchive(await zip.generateAsync({ type: "blob" }));
    expect(imported).toMatchObject([
      { reference: "NO-NAME", nombre: null, precio: 5, foto: null },
      { reference: "NO-PRICE", nombre: "Tubo", precio: null, foto: null },
      { reference: null, nombre: "Sin referencia", precio: null, foto: null },
    ]);
    expect(imported).toHaveLength(3);
  });

  it("omits photo-only products but keeps referenced photos on named or priced products", async () => {
    const zip = new JSZip();
    zip.file("productos.json", JSON.stringify([
      { reference: "VALIDO", nombre: "Grifo", precio: 10 },
      { reference: "CON-NOMBRE", nombre: "Tubo", precio: null, foto: "imagenes/nombre.webp" },
      { reference: "CON-PRECIO", nombre: "", precio: 5, foto: "imagenes/precio.webp" },
      { reference: "SOLO-FOTO", nombre: "", precio: null, foto: "imagenes/solo-foto.webp" },
    ]));
    zip.file("imagenes/nombre.webp", "foto del artículo con nombre");
    zip.file("imagenes/precio.webp", "foto del artículo con precio");
    zip.file("imagenes/solo-foto.webp", "foto del artículo que se descarta");
    zip.file("imagenes/otra-imagen-suelta.webp", "archivo suelto");

    const imported = await importCatalogArchive(await zip.generateAsync({ type: "blob" }));
    expect(imported.map((product) => product.reference)).toEqual(["VALIDO", "CON-NOMBRE", "CON-PRECIO"]);
    expect(imported[1].foto).toMatch(/^data:image\/webp;base64,/);
    expect(imported[2].foto).toMatch(/^data:image\/webp;base64,/);
  });

  it("uses the attached catalog's referencia field", async () => {
    const zip = new JSZip();
    zip.file("productos.json", JSON.stringify([
      { referencia: "T-281NS+", nombre: "Mecanismo", precio: 19.47, foto: "" },
    ]));
    const [imported] = await importCatalogArchive(await zip.generateAsync({ type: "blob" }));
    expect(imported).toMatchObject({ reference: "T-281NS+", nombre: "Mecanismo", precio: 19.47, foto: "" });
  });

  it("accepts complete products without an optional reference", async () => {
    const zip = new JSZip();
    zip.file("productos.json", JSON.stringify([{ nombre: "Válvula", precio: 2.5 }]));
    const [imported] = await importCatalogArchive(await zip.generateAsync({ type: "blob" }));
    expect(imported).toMatchObject({ reference: null, nombre: "Válvula", precio: 2.5, foto: null });
  });

  it("rejects non-ZIP files instead of accepting another archive format", async () => {
    await expect(importCatalogArchive(new Blob(["esto no es un ZIP"]))).rejects.toThrow("no es un ZIP válido");
  });

  it("imports and exports all attached catalog records, null fields and image associations", async () => {
    const contents = await readFile(new URL("../../public/catalogo-inicial.zip", import.meta.url));
    const imported = await importCatalogArchive(new Blob([Uint8Array.from(contents)]));
    expect(imported).toHaveLength(358);
    expect(imported.filter((product) => product.foto)).toHaveLength(357);
    expect(imported.filter((product) => !product.foto)).toHaveLength(1);
    expect(imported.every((product) => Boolean(product.nombre?.trim()) || product.precio !== null)).toBe(true);
    expect(imported.find((product) => product.reference === "T-281NS+"))
      .toMatchObject({ nombre: "MECANISMO SIMPLE DESCARGA PULSADOR INTERRUMPIBLE", precio: 19.47 });
    expect(imported.find((product) => product.reference === "T-281NS+")?.foto)
      .toMatch(/^data:image\/webp;base64,/);

    const roundTrip = await importCatalogArchive(await exportCatalogArchive(imported));
    expect(roundTrip.map(({ reference, nombre, precio, foto }) => ({ reference, nombre, precio, foto })))
      .toEqual(imported.map(({ reference, nombre, precio, foto }) => ({ reference, nombre, precio, foto })));
  });

  it("excludes products without both name and price from ZIP export", async () => {
    const exportable: Product[] = [
      ...products,
      { id: "photo-only", reference: "PHOTO", nombre: "", precio: null, foto: "data:image/png;base64,aGVsbG8=" },
      { id: "name-only", reference: "NAME", nombre: "Solo nombre", precio: null, foto: null },
      { id: "price-only", reference: "PRICE", nombre: null, precio: 4, foto: null },
    ];
    const zip = await JSZip.loadAsync(await exportCatalogArchive(exportable));
    const json = JSON.parse(await zip.file("productos.json")!.async("string")) as Array<Record<string, unknown>>;
    expect(json.map((item) => item.reference)).toEqual(["REF-1", "REF-2", "NAME", "PRICE"]);
    expect(Object.keys(zip.files).some((path) => path.includes("photo-only"))).toBe(false);
  });

  it("does not require an image for a product omitted because both name and price are missing", async () => {
    const zip = new JSZip();
    zip.file("productos.json", JSON.stringify([
      { reference: "INCOMPLETO", nombre: "", precio: null, foto: "imagenes/falta.webp" },
    ]));
    await expect(importCatalogArchive(await zip.generateAsync({ type: "blob" }))).resolves.toHaveLength(0);
  });
});
