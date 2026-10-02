import JSZip from "jszip";
import type { Product } from "../types";
import { newId } from "./id";

interface ArchiveProduct {
  reference: string | null;
  nombre: string | null;
  precio: number | null;
  foto: string | null;
}

function hasNameOrPrice(product: Pick<Product, "nombre" | "precio">): boolean {
  return Boolean(product.nombre?.trim()) || product.precio !== null;
}

function imageExtension(dataUrl: string): string {
  const mimeType = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/)?.[1]?.toLowerCase();
  if (!mimeType) throw new Error("Una foto del catálogo no tiene un formato de imagen válido.");
  return mimeType === "jpeg" ? "jpg" : mimeType === "svg+xml" ? "svg" : mimeType;
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("No se pudo leer una foto del catálogo.");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "producto";
}

export async function exportCatalogArchive(products: Product[]): Promise<Blob> {
  const zip = new JSZip();
  zip.folder("imagenes");
  const archivedProducts: ArchiveProduct[] = products.filter(hasNameOrPrice).map((product) => {
    let foto = product.foto;
    if (product.foto) {
      const filename = `${safeFilename(product.reference ?? "")}-${safeFilename(product.id)}.${imageExtension(product.foto)}`;
      foto = `imagenes/${filename}`;
      zip.file(foto, decodeDataUrl(product.foto));
    }
    return {
      reference: product.reference,
      nombre: product.nombre,
      precio: product.precio,
      foto,
    };
  });
  zip.file("productos.json", JSON.stringify(archivedProducts, null, 2));
  return zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}

function validateArchivedProduct(value: unknown, index: number): ArchiveProduct {
  if (typeof value !== "object" || value === null) {
    throw new Error(`El producto ${index + 1} de productos.json no es válido.`);
  }
  const item = value as Record<string, unknown>;
  const archivedReference = item.reference === undefined ? item.referencia : item.reference;
  if (archivedReference !== null && archivedReference !== undefined && typeof archivedReference !== "string") {
    throw new Error(`La referencia del producto ${index + 1} no es válida.`);
  }
  const reference = typeof archivedReference === "string" ? archivedReference : null;
  if (item.nombre !== null && item.nombre !== undefined && typeof item.nombre !== "string") {
    throw new Error(`El nombre del producto ${index + 1} no es válido.`);
  }
  if (item.precio !== null && item.precio !== undefined
    && (typeof item.precio !== "number" || !Number.isFinite(item.precio))) {
    throw new Error(`El precio del producto ${index + 1} no es válido.`);
  }
  if (item.foto !== null && item.foto !== undefined && typeof item.foto !== "string") {
    throw new Error(`La foto del producto ${index + 1} no es válida.`);
  }
  return {
    reference,
    nombre: typeof item.nombre === "string" ? item.nombre : null,
    precio: typeof item.precio === "number" ? item.precio : null,
    foto: typeof item.foto === "string" ? item.foto : null,
  };
}

export async function importCatalogArchive(file: Blob): Promise<Product[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("El archivo seleccionado no es un ZIP válido.");
  }

  const jsonFile = zip.file("productos.json");
  if (!jsonFile) throw new Error("El ZIP no contiene productos.json.");
  let contents: unknown;
  try {
    contents = JSON.parse(await jsonFile.async("string")) as unknown;
  } catch {
    throw new Error("No se pudo leer productos.json. Comprueba que el JSON sea válido.");
  }
  if (!Array.isArray(contents)) throw new Error("productos.json debe contener una lista de productos.");

  const archivedProducts = contents.map(validateArchivedProduct).filter(hasNameOrPrice);
  const products: Product[] = [];
  for (const archived of archivedProducts) {
    let foto = archived.foto;
    if (archived.foto) {
      const [directory, filename, extraPath] = archived.foto.split("/");
      if (directory !== "imagenes" || !filename || filename === "." || filename === ".." || extraPath !== undefined || filename.includes("\\")) {
        throw new Error(`La ruta de imagen del producto ${archived.reference} no es válida.`);
      }
      const image = zip.file(archived.foto);
      if (!image) throw new Error(`Falta la imagen ${archived.foto} del producto ${archived.reference}.`);
      const bytes = await image.async("uint8array");
      const extension = archived.foto.split(".").pop()?.toLowerCase();
      const mimeType = extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : extension === "svg"
          ? "image/svg+xml"
          : `image/${extension || "png"}`;
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      foto = `data:${mimeType};base64,${btoa(binary)}`;
    }
    products.push({
      id: newId(),
      reference: archived.reference,
      nombre: archived.nombre,
      precio: archived.precio,
      foto,
    });
  }
  return products;
}
