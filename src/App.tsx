import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import html2canvas from "html2canvas";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Copy,
  ClipboardList,
  FilePlus2,
  History,
  ImagePlus,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import {
  addProductLine,
  formatPrice,
  matchesSearch,
  parsePrice,
  parseQuantity,
  sortProductsWithFavorites,
  ticketTotal,
} from "./lib/core";
import {
  clearProducts,
  clearTickets,
  deleteProduct,
  deleteTicket,
  deleteAppointment,
  getSetting,
  getProducts,
  getTickets,
  getAppointments,
  replaceProducts,
  saveSetting,
  saveProduct,
  saveTicket,
  saveAppointment,
} from "./lib/database";
import { sortAppointmentsByDate } from "./lib/agenda";
import { exportCatalogArchive, importCatalogArchive } from "./lib/catalog-archive";
import { calendarDays, dateFromKey, dateKey, formatDateKey, formatMonthKey } from "./lib/calendar";
import { summarizeTickets, ticketsInDateRange, ticketsMatchingCustomer } from "./lib/history-period";
import { exportHistoryCsv } from "./lib/history-export";
import { newId } from "./lib/id";
import { ticketAsText } from "./lib/ticket-text";
import type { Appointment, CartLine, Product, Ticket } from "./types";

type Section = "ticket" | "catalog" | "history" | "agenda";
type ProductDraft = Pick<Product, "reference" | "nombre" | "foto"> & { id?: string };
type AppointmentDraft = Omit<Appointment, "id"> & { id?: string };

const emptyDraft = (): ProductDraft => ({ reference: "", nombre: "", foto: null });

function makeId(): string {
  return newId();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function localDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function imageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });
}

function EmptyImage({ large = false }: { large?: boolean }) {
  return (
    <div className={`image-placeholder${large ? " image-placeholder-large" : ""}`} aria-label="Sin foto">
      <Package size={large ? 28 : 20} strokeWidth={1.6} />
    </div>
  );
}

function ProductImage({ product, large = false }: { product: Pick<Product, "nombre" | "foto">; large?: boolean }) {
  return product.foto
    ? <img className={`product-image${large ? " product-image-large" : ""}`} src={product.foto} alt={product.nombre || "Producto sin nombre"} loading="lazy" decoding="async" />
    : <EmptyImage large={large} />;
}

function ConfirmDialog({
  prompt,
  confirmLabel = "ELIMINAR",
  onCancel,
  onConfirm,
}: {
  prompt: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="dialog-icon"><Trash2 size={21} /></div>
        <h2 id="confirm-title">{prompt}</h2>
        <div className="dialog-actions">
          <button className="button button-secondary" onClick={onCancel}>CANCELAR</button>
          <button className="button button-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function TicketReceipt({
  ticket,
  receiptRef,
  onCopy,
  copied,
  onPendingPaymentChange,
}: {
  ticket: Ticket;
  receiptRef?: React.RefObject<HTMLElement>;
  onCopy?: () => void;
  copied?: boolean;
  onPendingPaymentChange?: (pending: boolean) => void;
}) {
  return (
    <article className="ticket-receipt" ref={receiptRef}>
      {onCopy && (
        <button className="receipt-copy-button" type="button" data-html2canvas-ignore="true" aria-label={copied ? "Ticket copiado" : "Copiar ticket"} title={copied ? "Copiado" : "Copiar ticket"} onClick={onCopy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      )}
      <div className="receipt-heading">
        <div className="brand-mark receipt-mark"><Wrench size={18} /></div>
        <div>
          <span className="eyebrow">TICKET DE TRABAJO</span>
          <h3>FontaTicket</h3>
        </div>
      </div>
      <div className="receipt-meta">
        <span>{formatDate(ticket.createdAt)}</span>
        {ticket.customer && <span><UserRound size={14} /> {ticket.customer}</span>}
      </div>
      {ticket.pendingPayment && <div className="pending-payment-badge">PENDIENTE</div>}
      <div className="receipt-lines">
        {ticket.lines.map((line) => (
          <div className="receipt-line" key={line.id}>
            <div>
              <strong>{line.description}</strong>
              {line.reference && <span className="muted block">Ref. {line.reference}</span>}
              <span className="muted">{line.quantity} × {formatPrice(line.unitPrice)}</span>
            </div>
            <strong>{formatPrice(line.quantity * line.unitPrice)}</strong>
          </div>
        ))}
      </div>
      <div className="receipt-total"><span>TOTAL</span><strong>{formatPrice(ticket.total)}</strong></div>
      {onPendingPaymentChange && (
        <label className="pending-payment-toggle" data-html2canvas-ignore="true">
          <input
            type="checkbox"
            checked={ticket.pendingPayment === true}
            onChange={(event) => onPendingPaymentChange(event.target.checked)}
          />
          <span>PENDIENTE DE PAGO</span>
        </label>
      )}
    </article>
  );
}

type HistoryPicker = "month" | "from" | "to";

function HistoryDateControls({
  month,
  from,
  to,
  onMonthChange,
  onFromChange,
  onToChange,
  onClear,
}: {
  month: string;
  from: string;
  to: string;
  onMonthChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
}) {
  const [openPicker, setOpenPicker] = useState<HistoryPicker | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const controlsRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<HistoryPicker, HTMLButtonElement | null>>({
    month: null,
    from: null,
    to: null,
  });

  useEffect(() => {
    if (!openPicker) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !controlsRef.current?.contains(event.target)) {
        setOpenPicker(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPicker(null);
        triggerRefs.current[openPicker]?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openPicker]);

  const open = (picker: HistoryPicker) => {
    const initial = picker === "month" ? `${month}-01` : picker === "from" ? from : to;
    setCursor(dateFromKey(initial) ?? new Date());
    setOpenPicker((current) => current === picker ? null : picker);
  };

  const moveCursor = (amount: number) => {
    setCursor((current) => new Date(
      current.getFullYear(),
      current.getMonth() + (openPicker === "month" ? 12 * amount : amount),
      1,
    ));
  };

  const chooseDate = (day: number) => {
    const key = dateKey(cursor.getFullYear(), cursor.getMonth(), day);
    if (openPicker === "from") onFromChange(key);
    if (openPicker === "to") onToChange(key);
    setOpenPicker(null);
  };

  const chooseMonth = (monthIndex: number) => {
    onMonthChange(`${cursor.getFullYear()}-${String(monthIndex + 1).padStart(2, "0")}`);
    setOpenPicker(null);
  };

  const days = calendarDays(cursor.getFullYear(), cursor.getMonth());
  const monthNames = Array.from({ length: 12 }, (_, monthIndex) =>
    new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(cursor.getFullYear(), monthIndex, 1)),
  );

  return (
    <div className="history-date-controls" ref={controlsRef}>
      <div className="history-month-field">
        <span>MES</span>
        <div className="history-picker-anchor">
          <button
            ref={(element) => { triggerRefs.current.month = element; }}
            className="history-picker-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={openPicker === "month"}
            onClick={() => open("month")}
          >
            <CalendarDays size={16} /><span>{formatMonthKey(month) || "Seleccionar mes"}</span><ChevronRight size={16} />
          </button>
          {openPicker === "month" && (
            <section className="history-calendar month-calendar" role="dialog" aria-label="Seleccionar mes">
              <div className="calendar-heading">
                <button type="button" className="calendar-nav-button" aria-label="Año anterior" onClick={() => moveCursor(-1)}><ChevronLeft size={17} /></button>
                <strong>{cursor.getFullYear()}</strong>
                <button type="button" className="calendar-nav-button" aria-label="Año siguiente" onClick={() => moveCursor(1)}><ChevronRight size={17} /></button>
              </div>
              <div className="month-grid">
                {monthNames.map((name, monthIndex) => {
                  const key = `${cursor.getFullYear()}-${String(monthIndex + 1).padStart(2, "0")}`;
                  return <button key={key} type="button" className={`calendar-month${month === key ? " selected" : ""}`} aria-pressed={month === key} onClick={() => chooseMonth(monthIndex)}>{name}</button>;
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      <div className="history-date-fields">
        {([
          { id: "from", label: "DESDE", value: from },
          { id: "to", label: "HASTA", value: to },
        ] as const).map(({ id, label, value }) => (
          <div className="history-date-field" key={id}>
            <span>{label}</span>
            <div className="history-picker-anchor">
              <button
                ref={(element) => { triggerRefs.current[id] = element; }}
                className="history-picker-trigger"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={openPicker === id}
                onClick={() => open(id)}
              >
                <CalendarDays size={16} /><span>{formatDateKey(value) || "Seleccionar fecha"}</span><ChevronRight size={16} />
              </button>
              {openPicker === id && (
                <section className="history-calendar date-calendar" role="dialog" aria-label={`Seleccionar fecha ${label.toLocaleLowerCase("es")}`}>
                  <div className="calendar-heading">
                    <button type="button" className="calendar-nav-button" aria-label="Mes anterior" onClick={() => moveCursor(-1)}><ChevronLeft size={17} /></button>
                    <strong>{formatMonthKey(dateKey(cursor.getFullYear(), cursor.getMonth(), 1).slice(0, 7))}</strong>
                    <button type="button" className="calendar-nav-button" aria-label="Mes siguiente" onClick={() => moveCursor(1)}><ChevronRight size={17} /></button>
                  </div>
                  <div className="calendar-grid" role="grid" aria-label={formatMonthKey(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)}>
                    {["L", "M", "X", "J", "V", "S", "D"].map((weekday) => <span className="calendar-weekday" key={weekday} aria-hidden="true">{weekday}</span>)}
                    {days.map((day, index) => {
                      const key = day === null ? `blank-${index}` : dateKey(cursor.getFullYear(), cursor.getMonth(), day);
                      return day === null
                        ? <span className="calendar-day-empty" key={key} />
                        : <button key={key} type="button" className={`calendar-day${value === key ? " selected" : ""}`} aria-label={formatDateKey(key)} aria-pressed={value === key} onClick={() => chooseDate(day)}>{day}</button>;
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        ))}
        <button className="button button-secondary history-clear-filter" type="button" onClick={() => { setOpenPicker(null); onClear(); }}>LIMPIAR FECHAS</button>
      </div>
    </div>
  );
}

function App() {
  const [section, setSection] = useState<Section>("ticket");
  const [products, setProducts] = useState<Product[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState("");
  const [search, setSearch] = useState("");
  const [ticketSearchOpen, setTicketSearchOpen] = useState(false);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyMonth, setHistoryMonth] = useState("");
  const [historyCustomerSearch, setHistoryCustomerSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualError, setManualError] = useState("");
  const [generated, setGenerated] = useState<Ticket | null>(null);
  const [generatedImage, setGeneratedImage] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [addedNotice, setAddedNotice] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [historyDetail, setHistoryDetail] = useState<Ticket | null>(null);
  const [appointmentDraft, setAppointmentDraft] = useState<AppointmentDraft | null>(null);
  const [appointmentDetail, setAppointmentDetail] = useState<Appointment | null>(null);
  const [materialName, setMaterialName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: "ticket"; id: string }
    | { kind: "product"; id: string }
    | { kind: "appointment"; id: string }
    | { kind: "catalog" }
    | { kind: "history" }
    | null
  >(null);
  const importInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const ticketSearchAreaRef = useRef<HTMLDivElement>(null);
  const favoriteProductIdsRef = useRef<string[]>([]);
  const receiptRef = useRef<HTMLElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const noticeTimer = useRef<number | undefined>(undefined);
  const addedTimer = useRef<number | undefined>(undefined);
  const favoriteSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const cartTotal = useMemo(() => ticketTotal(cart), [cart]);

  useEffect(() => {
    Promise.all([
      getProducts(),
      getTickets(),
      getAppointments(),
      getSetting("initial-catalog-imported"),
      getSetting("labor-product-initialized"),
      getSetting("favorite-product-ids"),
    ])
      .then(async ([savedProducts, savedTickets, savedAppointments, seedImported, laborInitialized, favoriteIdsSetting]) => {
        let savedFavoriteIds: string[] = [];
        if (favoriteIdsSetting) {
          const parsed: unknown = JSON.parse(favoriteIdsSetting);
          if (Array.isArray(parsed) && parsed.every((id): id is string => typeof id === "string")) {
            savedFavoriteIds = parsed;
          }
        }
        let catalog = savedProducts;
        if (seedImported !== "true") {
          if (!catalog.length) {
            const response = await fetch(`${import.meta.env.BASE_URL}catalogo-inicial.zip`);
            if (!response.ok) throw new Error("No se pudo cargar el catálogo inicial adjunto.");
            catalog = await importCatalogArchive(await response.blob());
            await replaceProducts(catalog);
          }
          await saveSetting("initial-catalog-imported", "true");
        }
        if (await getSetting("catalog-incomplete-products-removed") !== "true") {
          catalog = catalog.filter((product) => Boolean(product.nombre?.trim()) || product.precio !== null);
          await replaceProducts(catalog);
          await saveSetting("catalog-incomplete-products-removed", "true");
        }
        if (laborInitialized !== "true") {
          const existingLabor = catalog.find((product) =>
            product.nombre?.trim().toLocaleLowerCase("es") === "mano de obra",
          );
          const laborProduct: Product = existingLabor
            ? { ...existingLabor, precio: 1 }
            : { id: makeId(), reference: "", nombre: "Mano de obra", precio: 1, foto: null };
          await saveProduct(laborProduct);
          catalog = [...catalog.filter((product) => product.id !== laborProduct.id), laborProduct]
            .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
          await saveSetting("labor-product-initialized", "true");
        }
        setProducts(catalog);
        const existingFavoriteIds = savedFavoriteIds.filter((id) => catalog.some((product) => product.id === id));
        favoriteProductIdsRef.current = existingFavoriteIds;
        setFavoriteProductIds(existingFavoriteIds);
        setTickets(savedTickets);
        setAppointments(sortAppointmentsByDate(savedAppointments));
      })
      .catch((caught: unknown) => setError(caught instanceof Error
        ? caught.message
        : "No se pudieron cargar los datos guardados. Comprueba el almacenamiento de este navegador."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!generated) {
      setGeneratedImage(null);
      return;
    }
    const receipt = receiptRef.current;
    if (!receipt) return;
    let active = true;
    setGeneratedImage(null);
    void html2canvas(receipt, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false })
      .then((canvas) => new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo preparar la imagen del ticket.")), "image/png");
      }))
      .then((image) => {
        if (active) setGeneratedImage(image);
      })
      .catch(() => {
        if (active) setError("No se pudo preparar la imagen del ticket para WhatsApp.");
      });
    return () => { active = false; };
  }, [generated]);

  useEffect(() => () => {
    window.clearTimeout(copyTimer.current);
    window.clearTimeout(noticeTimer.current);
    window.clearTimeout(addedTimer.current);
  }, []);

  useEffect(() => {
    if (!generated && !manualOpen && !appointmentDetail) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (manualOpen) setManualOpen(false);
      else if (generated) setGenerated(null);
      else setAppointmentDetail(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [appointmentDetail, generated, manualOpen]);

  useEffect(() => {
    const closeSearchesOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!ticketSearchAreaRef.current?.contains(event.target)) setTicketSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeSearchesOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeSearchesOnOutsidePointer);
  }, []);

  const clearError = () => setError("");

  const showAddedNotice = (label: string) => {
    setAddedNotice(`Añadido al ticket · ${label}`);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAddedNotice(""), 1600);
  };

  const addToTicket = (product: Product) => {
    setTicketSearchOpen(false);
    clearError();
    setCart((current) => addProductLine(current, product));
    showAddedNotice(product.nombre?.trim() || "Producto");
  };

  const addCatalogProductToTicket = (product: Product) => {
    addToTicket(product);
  };

  const toggleProductFavorite = (productId: string) => {
    const next = favoriteProductIdsRef.current.includes(productId)
      ? favoriteProductIdsRef.current.filter((id) => id !== productId)
      : [...favoriteProductIdsRef.current, productId];
    favoriteProductIdsRef.current = next;
    setFavoriteProductIds(next);
    favoriteSaveQueue.current = favoriteSaveQueue.current
      .then(() => saveSetting("favorite-product-ids", JSON.stringify(next)))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "No se pudo guardar el favorito.");
      });
  };

  const copyGeneratedTicket = async () => {
    if (!generated) return;
    const text = ticketAsText(generated);
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand("copy");
          textarea.remove();
          if (!success) throw new Error("El navegador no pudo copiar el ticket.");
        }
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        textarea.remove();
        if (!success) throw new Error("El navegador no pudo copiar el ticket.");
      }
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
      clearError();
    } catch {
      setError("No se pudo copiar el ticket. Comprueba los permisos del navegador.");
    }
  };

  const shareTicketOnWhatsApp = async () => {
    if (!generated || !generatedImage) return;
    const imageFile = new File([generatedImage], `fontaticket-${generated.id}.png`, { type: "image/png" });
    const nativeShare = Reflect.get(navigator, "share") as Navigator["share"] | undefined;
    const nativeCanShare = Reflect.get(navigator, "canShare") as Navigator["canShare"] | undefined;
    let nativeFileShareAvailable = false;
    try {
      nativeFileShareAvailable = typeof nativeShare === "function"
        && (typeof nativeCanShare !== "function" || nativeCanShare.call(navigator, { files: [imageFile] }));
    } catch {
      nativeFileShareAvailable = false;
    }
    if (nativeFileShareAvailable) {
      if (typeof nativeShare !== "function") return;
      try {
        await nativeShare.call(navigator, { files: [imageFile], title: "Ticket FontaTicket" });
        clearError();
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError("No se pudo compartir la imagen del ticket.");
      }
      return;
    }

    const isDesktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!window.isSecureContext) {
      setError("El navegador bloquea compartir imágenes desde esta dirección HTTP. Abre FontaTicket mediante HTTPS para usar el menú de compartir.");
      return;
    }
    if (!isDesktop || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      setError("Este navegador no permite compartir archivos de imagen. Prueba desde un navegador compatible con compartir archivos.");
      return;
    }

    const whatsappWindow = window.open("https://web.whatsapp.com/", "_blank");
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [imageFile.type]: generatedImage }),
      ]);
      if (whatsappWindow) {
        whatsappWindow.opener = null;
        setShareNotice("Imagen copiada y WhatsApp Web abierto.");
      } else {
        setShareNotice("Imagen copiada al portapapeles.");
      }
      clearError();
    } catch {
      whatsappWindow?.close();
      setError("No se pudo compartir la imagen. El navegador puede bloquear el portapapeles en una conexión no segura.");
    }
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setShareNotice(""), 3500);
  };

  const addManualConcept = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = parsePrice(manualPrice);
    if (!manualName.trim() || price === null) {
      setManualError("Escribe el nombre del concepto y un precio válido.");
      return;
    }
    setCart((current) => [...current, {
      id: makeId(),
      description: manualName.trim(),
      unitPrice: price,
      quantity: 1,
    }]);
    setManualName("");
    setManualPrice("");
    setManualError("");
    clearError();
    setManualOpen(false);
    showAddedNotice("Concepto");
  };

  const changeQuantity = (lineId: string, amount: number) => {
    setCart((current) => current.flatMap((line) => {
      if (line.id !== lineId) return [line];
      const quantity = line.quantity + amount;
      return quantity > 0 ? [{ ...line, quantity }] : [];
    }));
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[lineId];
      return next;
    });
  };

  const setLineQuantityDraft = (lineId: string, value: string) => {
    setQuantityDrafts((current) => ({ ...current, [lineId]: value }));
  };

  const commitLineQuantity = (lineId: string) => {
    const value = quantityDrafts[lineId];
    if (value === undefined) return;
    const quantity = parseQuantity(value);
    if (quantity !== null) {
      setCart((current) => current.map((line) => line.id === lineId ? { ...line, quantity } : line));
    }
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[lineId];
      return next;
    });
  };

  const generateTicket = async () => {
    if (!cart.length) return;
    const ticket: Ticket = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      ...(customer.trim() ? { customer: customer.trim() } : {}),
      lines: cart.map((line) => ({ ...line })),
      total: cartTotal,
    };
    try {
      await saveTicket(ticket);
      setTickets((current) => [ticket, ...current]);
      setGenerated(ticket);
      setCart([]);
      setCustomer("");
      clearError();
    } catch {
      setError("No se pudo guardar el ticket. No se ha generado.");
    }
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const reference = String(data.get("reference") ?? "").trim();
    const nombre = String(data.get("nombre") ?? "").trim();
    const precio = parsePrice(String(data.get("precio") ?? ""));
    if (!nombre || precio === null) {
      setError("Completa el nombre y un precio válido para guardar el producto.");
      return;
    }
    const product: Product = {
      id: draft.id ?? makeId(),
      reference,
      nombre,
      precio,
      foto: draft.foto,
    };
    try {
      await saveProduct(product);
      setProducts((current) => {
        const next = current.filter((item) => item.id !== product.id);
        next.push(product);
        return next.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
      });
      setDraft(null);
      setPhotoName("");
      clearError();
    } catch {
      setError("No se pudo guardar el producto. Vuelve a intentarlo.");
    }
  };

  const choosePhoto = async (file?: File) => {
    if (!file || !draft) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen.");
      return;
    }
    try {
      const foto = await imageData(file);
      setDraft((current) => current ? { ...current, foto } : current);
      setPhotoName(file.name);
      clearError();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo leer la imagen.");
    }
  };

  const exportCatalog = async () => {
    try {
      const archive = await exportCatalogArchive(products);
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = "fontaticket-catalogo.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      clearError();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo exportar el catálogo.");
    }
  };

  const importCatalog = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await importCatalogArchive(file);
      if (!window.confirm("¿Reemplazar el catálogo actual con los productos del ZIP?")) return;
      await replaceProducts(imported);
      setProducts([...imported].sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es")));
      const importedIds = new Set(imported.map((product) => product.id));
      const retainedFavorites = favoriteProductIdsRef.current.filter((id) => importedIds.has(id));
      favoriteProductIdsRef.current = retainedFavorites;
      setFavoriteProductIds(retainedFavorites);
      await saveSetting("favorite-product-ids", JSON.stringify(retainedFavorites));
      clearError();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo importar el catálogo.");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const removeCatalog = async () => {
    try {
      await clearProducts();
      setProducts([]);
      favoriteProductIdsRef.current = [];
      setFavoriteProductIds([]);
      await saveSetting("favorite-product-ids", "[]");
      setConfirmDelete(null);
      clearError();
    } catch {
      setError("No se pudo eliminar el catálogo.");
    }
  };

  const setTicketPendingPayment = async (ticketId: string, pendingPayment: boolean) => {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    const updatedTicket: Ticket = { ...ticket };
    if (pendingPayment) updatedTicket.pendingPayment = true;
    else delete updatedTicket.pendingPayment;
    try {
      await saveTicket(updatedTicket);
      setTickets((current) => current.map((item) => item.id === ticketId ? updatedTicket : item));
      setGenerated((current) => current?.id === ticketId ? updatedTicket : current);
      setHistoryDetail((current) => current?.id === ticketId ? updatedTicket : current);
      clearError();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el estado de pago del ticket.");
    }
  };

  const saveAppointmentDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!appointmentDraft) return;
    const appointment: Appointment = {
      ...appointmentDraft,
      id: appointmentDraft.id ?? makeId(),
      client: appointmentDraft.client.trim(),
      address: appointmentDraft.address.trim(),
      work: appointmentDraft.work.trim(),
      materials: appointmentDraft.materials.map((material) => ({ ...material, name: material.name.trim() })),
    };
    try {
      await saveAppointment(appointment);
      setAppointments((current) => sortAppointmentsByDate([
        ...current.filter((item) => item.id !== appointment.id),
        appointment,
      ]));
      setAppointmentDraft(null);
      setMaterialName("");
      clearError();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la cita.");
    }
  };

  const removeAppointment = async (id: string) => {
    try {
      await deleteAppointment(id);
      setAppointments((current) => current.filter((appointment) => appointment.id !== id));
      setAppointmentDetail(null);
      setConfirmDelete(null);
      clearError();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar la cita.");
    }
  };

  const updateAppointmentMaterial = async (appointmentId: string, materialId: string, acquired: boolean) => {
    const current = appointments.find((appointment) => appointment.id === appointmentId);
    if (!current) return;
    const updated: Appointment = {
      ...current,
      materials: current.materials.map((material) => material.id === materialId ? { ...material, acquired } : material),
    };
    try {
      await saveAppointment(updated);
      setAppointments((items) => sortAppointmentsByDate(items.map((item) => item.id === appointmentId ? updated : item)));
      setAppointmentDetail(updated);
      clearError();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el material de la cita.");
    }
  };

  const editAppointment = (appointment: Appointment) => {
    setAppointmentDraft({ ...appointment, materials: appointment.materials.map((material) => ({ ...material })) });
    setAppointmentDetail(null);
    setMaterialName("");
    clearError();
  };

  const removeTicket = async (id: string) => {
    try {
      await deleteTicket(id);
      setTickets((current) => current.filter((ticket) => ticket.id !== id));
      setHistoryDetail((current) => current?.id === id ? null : current);
      setConfirmDelete(null);
      clearError();
    } catch {
      setError("No se pudo eliminar el ticket.");
    }
  };

  const removeProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      setProducts((current) => current.filter((product) => product.id !== id));
      const retainedFavorites = favoriteProductIdsRef.current.filter((favoriteId) => favoriteId !== id);
      favoriteProductIdsRef.current = retainedFavorites;
      setFavoriteProductIds(retainedFavorites);
      await saveSetting("favorite-product-ids", JSON.stringify(retainedFavorites));
      setConfirmDelete(null);
      clearError();
    } catch {
      setError("No se pudo eliminar el producto.");
    }
  };

  const removeAllTickets = async () => {
    try {
      await clearTickets();
      setTickets([]);
      setHistoryDetail(null);
      setConfirmDelete(null);
      clearError();
    } catch {
      setError("No se pudo eliminar el historial.");
    }
  };

  const matchingProducts = useMemo(() => {
    if (!search.trim()) return [];
    return sortProductsWithFavorites(products.filter((product) =>
      matchesSearch(search, product.nombre, product.reference),
    ), favoriteProductIds);
  }, [favoriteProductIds, products, search]);

  const catalogProducts = useMemo(() => {
    const filtered = catalogSearch.trim()
      ? products.filter((product) => matchesSearch(catalogSearch, product.nombre, product.reference))
      : products;
    return sortProductsWithFavorites(filtered, favoriteProductIds);
  }, [catalogSearch, favoriteProductIds, products]);

  const favoriteProducts = useMemo(
    () => [...products]
      .filter((product) => favoriteProductIds.includes(product.id))
      .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es")),
    [favoriteProductIds, products],
  );

  const historyTickets = useMemo(
    () => ticketsMatchingCustomer(
      ticketsInDateRange(tickets, historyFrom, historyTo),
      historyCustomerSearch,
    ),
    [tickets, historyFrom, historyTo, historyCustomerSearch],
  );
  const historySummary = useMemo(() => summarizeTickets(historyTickets), [historyTickets]);

  const downloadHistoryCsv = () => {
    const csv = exportHistoryCsv(historyTickets);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `historial-fontaticket-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const selectHistoryMonth = (month: string) => {
    setHistoryMonth(month);
    if (!month) {
      setHistoryFrom("");
      setHistoryTo("");
      return;
    }
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    setHistoryFrom(`${month}-01`);
    setHistoryTo(`${month}-${String(lastDay).padStart(2, "0")}`);
  };

  const navItems = [
    { id: "ticket" as const, label: "GENERAR TICKET", icon: ClipboardList },
    { id: "catalog" as const, label: "CATÁLOGO", icon: Package },
    { id: "history" as const, label: "HISTORIAL", icon: History },
    { id: "agenda" as const, label: "AGENDA", icon: CalendarDays },
  ];

  return (
    <div className={`app-shell${section === "ticket" ? " app-shell-ticket" : ""}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Wrench size={19} strokeWidth={2.3} /></div>
          <div><span className="brand-name">FontaTicket</span><span className="brand-caption">GESTIÓN DE TRABAJOS</span></div>
        </div>
        <nav className="desktop-nav" aria-label="Secciones">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item${section === id ? " active" : ""}`} onClick={() => { setSection(id); setDraft(null); clearError(); }}>
              <Icon size={17} />{label}
            </button>
          ))}
        </nav>
        <span className="topbar-note"><span className="status-dot" /> Datos guardados en este dispositivo</span>
      </header>

      <nav className="mobile-nav" aria-label="Secciones">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`mobile-nav-item${section === id ? " active" : ""}`} onClick={() => { setSection(id); setDraft(null); clearError(); }}>
            <Icon size={20} strokeWidth={section === id ? 2.3 : 1.8} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <main className={`page-content${section === "ticket" ? " page-content-ticket" : ""}`}>
        {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Cerrar aviso" onClick={clearError}><X size={18} /></button></div>}
        {loading ? (
          <div className="loading-state">Cargando datos guardados…</div>
        ) : section === "ticket" ? (
          <section className="screen">
            <div className="page-heading ticket-page-heading">
              <div><span className="eyebrow">TRABAJO ACTUAL</span><h1>Generar ticket</h1><p>Prepara los conceptos y genera el ticket para tu cliente.</p></div>
              <div className="heading-icon"><ClipboardList size={23} /></div>
            </div>

            <div className="ticket-layout">
              <div className="ticket-entry">
                <label className="field-label" htmlFor="customer">CLIENTE <span className="optional">(OPCIONAL)</span></label>
                <div className="input-wrap"><UserRound size={18} /><input id="customer" value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Nombre del cliente" /></div>

                <div className="product-search-area">
                  <div className="product-search-control" ref={ticketSearchAreaRef}>
                    <label className="product-search-label" htmlFor="ticket-product-search"><Search size={17} /> BUSCAR PRODUCTO</label>
                    <div className="product-search-box">
                      <input id="ticket-product-search" aria-label="Buscar producto" autoComplete="off" value={search} onFocus={() => setTicketSearchOpen(true)} onClick={() => setTicketSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setTicketSearchOpen(true); }} placeholder="Nombre o referencia" />
                      {search && <button type="button" className="clear-product-search" aria-label="Limpiar búsqueda" onClick={() => { setSearch(""); setTicketSearchOpen(false); }}><X size={15} /></button>}
                    </div>

                    {ticketSearchOpen && !search.trim() && favoriteProducts.length ? (
                      <div className="product-results favorite-quick-list" aria-label="Productos favoritos">
                        {favoriteProducts.map((product) => (
                          <button
                            className="favorite-quick-item"
                            key={product.id}
                            type="button"
                            disabled={!product.nombre?.trim() || product.precio === null}
                            onClick={() => addToTicket(product)}
                          >
                            <span aria-hidden="true">★</span>
                            <strong>{product.nombre || "Nombre sin especificar"}</strong>
                            <b>{product.precio === null ? "Precio sin especificar" : formatPrice(product.precio)}</b>
                          </button>
                        ))}
                      </div>
                    ) : ticketSearchOpen && search.trim() && matchingProducts.length ? (
                      <div className="product-results">
                        {matchingProducts.map((product) => (
                          <article className="product-result product-result-card" key={product.id}>
                            <ProductImage product={product} large />
                            <div className="product-copy"><strong>{favoriteProductIds.includes(product.id) && <span className="favorite-result-star" aria-label="Favorito">★ </span>}{product.nombre || "Nombre sin especificar"}</strong>{product.reference && <span>Ref. {product.reference}</span>}<b>{product.precio === null ? "Precio sin especificar" : formatPrice(product.precio)}</b></div>
                            <button className="button button-add" disabled={!product.nombre?.trim() || product.precio === null} title={!product.nombre?.trim() || product.precio === null ? "Este producto tiene campos vacíos" : undefined} onClick={() => addToTicket(product)}><Plus size={16} /><span>AÑADIR</span></button>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

              </div>

              <aside className="cart-panel">
                <div className="cart-heading"><div><h2>TICKET ACTUAL</h2></div><span className="cart-badge"><ShoppingCart size={15} />{cart.length} {cart.length === 1 ? "artículo" : "artículos"}</span></div>
                <div className="cart-lines">
                  {cart.length ? cart.map((line) => (
                    <div className="cart-line" key={line.id}>
                      <div className="cart-line-main"><strong>{line.description}</strong>{line.reference && <span>Ref. {line.reference}</span>}<small>{formatPrice(line.unitPrice)} / ud.</small></div>
                      <div className="cart-line-side">
                        <div className="quantity-control">
                          <button aria-label={`Quitar una unidad de ${line.description}`} onClick={() => changeQuantity(line.id, -1)}><Minus size={13} /></button>
                          <input aria-label={`Cantidad de ${line.description}`} type="number" min="1" step="1" inputMode="numeric" value={quantityDrafts[line.id] ?? line.quantity} onChange={(event) => setLineQuantityDraft(line.id, event.target.value)} onBlur={() => commitLineQuantity(line.id)} />
                          <button aria-label={`Añadir una unidad de ${line.description}`} onClick={() => changeQuantity(line.id, 1)}><Plus size={13} /></button>
                        </div>
                        <strong>{formatPrice(line.unitPrice * line.quantity)}</strong>
                      </div>
                    </div>
                  )) : <div className="cart-empty"><ShoppingCart size={24} /><span>Tu ticket está vacío</span><small>Añade productos o conceptos manuales</small></div>}
                </div>
                <div className="cart-total"><span>TOTAL</span><strong>{formatPrice(cartTotal)}</strong></div>
                <button className="button button-manual-trigger manual-submit" type="button" onClick={() => { setManualError(""); setManualOpen(true); clearError(); }}><CirclePlus size={17} /> AÑADIR CONCEPTO</button>
                <button className="button button-primary generate-button" disabled={!cart.length} onClick={() => void generateTicket()}><Check size={17} /> GENERAR TICKET</button>
                <button className="button button-quiet clear-cart" disabled={!cart.length} onClick={() => { setCart([]); clearError(); }}>VACIAR TICKET</button>
              </aside>
            </div>

          </section>
        ) : section === "catalog" || section === "agenda" ? (
          <section className="screen">
            {draft ? (
              <form className="product-editor" onSubmit={(event) => void saveDraft(event)}>
                <div className="editor-heading"><div><span className="eyebrow">{draft.id ? "ACTUALIZAR PRODUCTO" : "NUEVO PRODUCTO"}</span><h2>{draft.id ? "Editar producto" : "Añadir producto"}</h2></div><button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={() => { setDraft(null); clearError(); }}><X size={20} /></button></div>
                <div className="editor-grid">
                  <label className="form-field"><span>REFERENCIA <span className="optional">(OPCIONAL)</span></span><input name="reference" value={draft.reference ?? ""} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder="Ej. GR-100" /></label>
                  <label className="form-field"><span>NOMBRE</span><input name="nombre" required value={draft.nombre ?? ""} onChange={(event) => setDraft({ ...draft, nombre: event.target.value })} placeholder="Nombre del producto" /></label>
                  <label className="form-field"><span>PRECIO (€)</span><input name="precio" required inputMode="decimal" value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} placeholder="0,00" /></label>
                  <div className="form-field photo-field">
                    <span>FOTO</span>
                    <div className="photo-picker-row">
                      <ProductImage product={{ nombre: draft.nombre || "Producto", foto: draft.foto }} large />
                      <div className="photo-controls">
                        <button type="button" className="button button-secondary" onClick={() => photoInput.current?.click()}><ImagePlus size={16} /> {draft.foto ? "CAMBIAR FOTO" : "AÑADIR FOTO"}</button>
                        {draft.foto && <button type="button" className="text-button" onClick={() => { setDraft({ ...draft, foto: null }); setPhotoName(""); }}>QUITAR FOTO</button>}
                        {photoName && <small>{photoName}</small>}
                        <input ref={photoInput} className="visually-hidden" type="file" accept="image/*" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="editor-actions"><button type="button" className="button button-quiet" onClick={() => { setDraft(null); clearError(); }}>CANCELAR</button><button type="submit" className="button button-primary"><Check size={16} /> GUARDAR PRODUCTO</button></div>
              </form>
            ) : section === "agenda" ? (
              <>
                {appointmentDraft ? (
                  <form className="appointment-editor" onSubmit={(event) => void saveAppointmentDraft(event)}>
                    <div className="editor-heading">
                      <div><span className="eyebrow">{appointmentDraft.id ? "ACTUALIZAR CITA" : "NUEVA CITA"}</span><h2>{appointmentDraft.id ? "Editar cita" : "Crear cita"}</h2></div>
                      <button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={() => { setAppointmentDraft(null); setMaterialName(""); clearError(); }}><X size={20} /></button>
                    </div>
                    <div className="appointment-form-grid">
                      <label className="form-field"><span>CLIENTE</span><input autoComplete="name" required value={appointmentDraft.client} onChange={(event) => setAppointmentDraft({ ...appointmentDraft, client: event.target.value })} /></label>
                      <div className="appointment-date-time">
                        <label className="form-field"><span>FECHA</span><input type="date" required value={appointmentDraft.date} onChange={(event) => setAppointmentDraft({ ...appointmentDraft, date: event.target.value })} /></label>
                        <label className="form-field"><span>HORA</span><input type="time" required value={appointmentDraft.time} onChange={(event) => setAppointmentDraft({ ...appointmentDraft, time: event.target.value })} /></label>
                      </div>
                      <label className="form-field"><span>DIRECCIÓN</span><input autoComplete="street-address" required value={appointmentDraft.address} onChange={(event) => setAppointmentDraft({ ...appointmentDraft, address: event.target.value })} /></label>
                      <label className="form-field"><span>TRABAJO A REALIZAR</span><textarea required rows={3} value={appointmentDraft.work} onChange={(event) => setAppointmentDraft({ ...appointmentDraft, work: event.target.value })} /></label>
                      <div className="form-field appointment-material-field">
                        <span>MATERIAL QUE TENGO QUE LLEVAR</span>
                        <div className="appointment-material-add">
                          <input
                            aria-label="Artículo de material"
                            value={materialName}
                            onChange={(event) => setMaterialName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              const name = materialName.trim();
                              if (!name) return;
                              setAppointmentDraft({ ...appointmentDraft, materials: [...appointmentDraft.materials, { id: makeId(), name, acquired: false }] });
                              setMaterialName("");
                            }}
                            placeholder="Añadir artículo"
                          />
                          <button className="button button-secondary" type="button" disabled={!materialName.trim()} onClick={() => {
                            const name = materialName.trim();
                            if (!name) return;
                            setAppointmentDraft({ ...appointmentDraft, materials: [...appointmentDraft.materials, { id: makeId(), name, acquired: false }] });
                            setMaterialName("");
                          }}><Plus size={16} /> AÑADIR</button>
                        </div>
                        {appointmentDraft.materials.length > 0 && (
                          <div className="appointment-material-list">
                            {appointmentDraft.materials.map((material) => (
                              <div className="appointment-material-row" key={material.id}>
                                <label><input type="checkbox" checked={material.acquired} onChange={(event) => setAppointmentDraft({ ...appointmentDraft, materials: appointmentDraft.materials.map((item) => item.id === material.id ? { ...item, acquired: event.target.checked } : item) })} /><span>{material.name}</span></label>
                                <button type="button" className="icon-button" aria-label={`Quitar ${material.name}`} onClick={() => setAppointmentDraft({ ...appointmentDraft, materials: appointmentDraft.materials.filter((item) => item.id !== material.id) })}><X size={16} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="editor-actions">
                      <button type="button" className="button button-quiet" onClick={() => { setAppointmentDraft(null); setMaterialName(""); clearError(); }}>CANCELAR</button>
                      <button type="submit" className="button button-primary"><Check size={16} /> GUARDAR CITA</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="page-heading agenda-heading">
                      <div><span className="eyebrow">TRABAJOS PROGRAMADOS</span><h1>Agenda</h1></div>
                      <button className="button button-primary" onClick={() => {
                        setAppointmentDraft({ client: "", date: localDateKey(), time: "", address: "", work: "", materials: [] });
                        setMaterialName("");
                        clearError();
                      }}><Plus size={17} /> AÑADIR CITA</button>
                    </div>
                    {appointments.length ? (
                      <div className="agenda-list">
                        {appointments.map((appointment) => (
                          <article className="agenda-card" key={appointment.id}>
                            <button className="agenda-main" type="button" onClick={() => setAppointmentDetail(appointment)}>
                              <span className="agenda-date">{formatDateKey(appointment.date)} · {appointment.time}</span>
                              <strong>{appointment.client}</strong>
                              <span>{appointment.address}</span>
                              <span className="agenda-work">{appointment.work}</span>
                            </button>
                            <div className="agenda-actions">
                              <button type="button" className="icon-button" aria-label={`Editar cita de ${appointment.client}`} onClick={() => editAppointment(appointment)}><FilePlus2 size={17} /></button>
                              <button type="button" className="icon-button agenda-delete" aria-label={`Eliminar cita de ${appointment.client}`} onClick={() => setConfirmDelete({ kind: "appointment", id: appointment.id })}><Trash2 size={17} /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-card"><CalendarDays size={27} /><h2>No hay citas</h2><p>Añade una cita para verla en la agenda.</p></div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="catalog-toolbar">
                  <button className="button button-primary add-product-button" onClick={() => { setDraft(emptyDraft()); setDraftPrice(""); setPhotoName(""); clearError(); }}><Plus size={18} /> AÑADIR PRODUCTO</button>
                  <div className="archive-actions">
                    <button className="button button-secondary" onClick={() => importInput.current?.click()}><ArrowDownToLine size={16} /> IMPORTAR CATÁLOGO</button>
                    <button className="button button-secondary" onClick={() => void exportCatalog()}><ArrowUpFromLine size={16} /> EXPORTAR CATÁLOGO</button>
                    <input ref={importInput} className="visually-hidden" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(event) => void importCatalog(event.target.files?.[0])} />
                  </div>
                </div>
                <div className="input-wrap search-wrap catalog-search-wrap"><Search size={18} /><input aria-label="Buscar productos en el catálogo" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Buscar por nombre o referencia" /></div>
                <section className="catalog-danger-zone">
                  <button className="button button-danger-outline" disabled={!products.length} onClick={() => setConfirmDelete({ kind: "catalog" })}><Trash2 size={16} /> BORRAR TODO EL CATÁLOGO</button>
                </section>
                {catalogProducts.length ? (
                  <div className="catalog-grid catalog-product-grid">
                    {catalogProducts.map((product) => (
                      <article className="catalog-card" key={product.id}>
                        <ProductImage product={product} large />
                        <div className="catalog-card-copy">
                          {product.reference && <span className="product-reference">REF. {product.reference}</span>}
                          <div className="catalog-title-line">
                            <button
                              className={`favorite-toggle${favoriteProductIds.includes(product.id) ? " is-favorite" : ""}`}
                              type="button"
                              aria-label={favoriteProductIds.includes(product.id) ? "Quitar de favoritos" : "Añadir a favoritos"}
                              aria-pressed={favoriteProductIds.includes(product.id)}
                              onClick={() => toggleProductFavorite(product.id)}
                            >{favoriteProductIds.includes(product.id) ? "★" : "☆"}</button>
                            <h3>{product.nombre || "Nombre sin especificar"}</h3>
                          </div>
                          <strong>{product.precio === null ? "Precio sin especificar" : formatPrice(product.precio)}</strong>
                        </div>
                        <div className="catalog-card-actions">
                          <button className="button button-add" disabled={!product.nombre?.trim() || product.precio === null} title={!product.nombre?.trim() || product.precio === null ? "Este producto tiene campos vacíos" : undefined} onClick={() => addCatalogProductToTicket(product)}><Plus size={15} /> AÑADIR</button>
                          <button className="button button-secondary edit-product" onClick={() => { setDraft({ id: product.id, reference: product.reference, nombre: product.nombre ?? "", foto: product.foto }); setDraftPrice(product.precio === null ? "" : String(product.precio).replace(".", ",")); setPhotoName(""); clearError(); }}>EDITAR <ChevronRight size={15} /></button>
                          <button className="button button-delete-product" aria-label={`Eliminar ${product.nombre || product.reference || "producto"}`} title="Eliminar producto" onClick={() => setConfirmDelete({ kind: "product", id: product.id })}><Trash2 size={16} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : products.length ? (
                  <div className="inline-empty catalog-no-results">No se encontraron productos.</div>
                ) : (
                  <div className="empty-card"><Package size={27} /><h2>El catálogo está vacío</h2><p>Añade productos o importa un catálogo ZIP.</p></div>
                )}
              </>
            )}
          </section>
        ) : (
          <section className="screen">
            <section className="history-period-panel" aria-label="Filtrar historial por fechas">
              <div className="history-period-heading"><CalendarDays size={18} /><strong>Consultar periodo</strong></div>
              <HistoryDateControls
                month={historyMonth}
                from={historyFrom}
                to={historyTo}
                onMonthChange={selectHistoryMonth}
                onFromChange={(value) => { setHistoryFrom(value); setHistoryMonth(""); }}
                onToChange={(value) => { setHistoryTo(value); setHistoryMonth(""); }}
                onClear={() => selectHistoryMonth("")}
              />
              <div className="history-customer-search">
                <label className="field-label" htmlFor="history-customer-search">BUSCAR CLIENTE</label>
                <div className="input-wrap search-wrap">
                  <Search size={18} />
                  <input
                    id="history-customer-search"
                    type="search"
                    value={historyCustomerSearch}
                    onChange={(event) => setHistoryCustomerSearch(event.target.value)}
                    placeholder="Nombre completo o parcial"
                  />
                </div>
              </div>
            </section>
            {historyFrom && historyTo && historyFrom > historyTo && (
              <div className="inline-empty history-range-error" role="alert">La fecha inicial debe ser anterior o igual a la fecha final.</div>
            )}
            <section className="history-summary" aria-label="Resumen económico del periodo">
              <div><span>MANO DE OBRA</span><strong>{formatPrice(historySummary.labor)}</strong></div>
              <div><span>MATERIALES</span><strong>{formatPrice(historySummary.materials)}</strong></div>
              <div className="history-period-total"><span>TOTAL</span><strong>{formatPrice(historySummary.total)}</strong></div>
            </section>
            <section className="history-danger-zone history-actions">
              <button className="button button-secondary" disabled={!historyTickets.length} onClick={downloadHistoryCsv}><ArrowDownToLine size={16} /> EXPORTAR HISTORIAL</button>
              <button className="button button-danger-outline" disabled={!tickets.length} onClick={() => setConfirmDelete({ kind: "history" })}><Trash2 size={16} /> BORRAR TODO EL HISTORIAL</button>
            </section>
            {tickets.length ? historyTickets.length ? (
              <div className="history-list">
                {historyTickets.map((ticket) => (
                  <article className="history-card" key={ticket.id}>
                    <div className="history-date-icon"><ClipboardList size={18} /></div>
                    <button className="history-main" onClick={() => setHistoryDetail(ticket)}>
                      <span className="history-date">{formatDate(ticket.createdAt)}</span>
                      <strong>{ticket.customer || "Sin cliente"}</strong>
                      <span>{ticket.lines.length} {ticket.lines.length === 1 ? "concepto" : "conceptos"}</span>
                      {ticket.pendingPayment && <span className="history-pending-badge">PENDIENTE</span>}
                    </button>
                    <strong className="history-total">{formatPrice(ticket.total)}</strong>
                    <button className="icon-button delete-ticket" aria-label="Eliminar ticket" onClick={() => setConfirmDelete({ kind: "ticket", id: ticket.id })}><Trash2 size={18} /></button>
                  </article>
                ))}
              </div>
            ) : <div className="empty-card"><History size={27} /><h2>No hay tickets con estos filtros</h2><p>Ajusta el periodo o el nombre del cliente para consultar otros tickets.</p></div> : <div className="empty-card"><History size={27} /><h2>Aún no hay tickets</h2><p>Los tickets que generes aparecerán aquí.</p></div>}
          </section>
        )}
      </main>

      {addedNotice && <div className="added-toast" role="status"><Check size={15} /> {addedNotice}</div>}

      {manualOpen && (
        <div className="dialog-backdrop manual-concept-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setManualOpen(false);
        }}>
          <form className="manual-concept-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-concept-title" onSubmit={addManualConcept}>
            <header className="manual-concept-heading">
              <div className="manual-title"><FilePlus2 size={19} /><strong id="manual-concept-title">Concepto manual</strong></div>
              <button type="button" className="icon-button" aria-label="Cerrar concepto manual" onClick={() => setManualOpen(false)}><X size={20} /></button>
            </header>
            <div className="manual-fields">
              <input aria-label="Nombre del concepto" value={manualName} onChange={(event) => { setManualName(event.target.value); setManualError(""); }} placeholder="Descripción del concepto" />
              <div className="price-input"><span>€</span><input aria-label="Precio del concepto" inputMode="decimal" value={manualPrice} onChange={(event) => { setManualPrice(event.target.value); setManualError(""); }} placeholder="0,00" /></div>
            </div>
            {manualError && <div className="manual-concept-error" role="alert">{manualError}</div>}
            <div className="manual-concept-actions">
              <button className="button button-quiet" type="button" onClick={() => setManualOpen(false)}>CANCELAR</button>
              <button className="button button-primary" type="submit"><CirclePlus size={17} /> AÑADIR CONCEPTO</button>
            </div>
          </form>
        </div>
      )}

      {generated && (
        <div className="dialog-backdrop generated-ticket-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setGenerated(null);
        }}>
          <section className="generated-ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="generated-ticket-title">
            <header className="generated-ticket-heading">
              <h2 id="generated-ticket-title">¡Ticket generado!</h2>
              <button type="button" className="icon-button" aria-label="Cerrar ticket generado" onClick={() => setGenerated(null)}><X size={20} /></button>
            </header>
            <TicketReceipt ticket={generated} receiptRef={receiptRef} onCopy={() => void copyGeneratedTicket()} copied={copied} onPendingPaymentChange={(pending) => void setTicketPendingPayment(generated.id, pending)} />
            <div className="generated-ticket-actions">
              <button className="button button-whatsapp action-button" disabled={!generatedImage} onClick={() => void shareTicketOnWhatsApp()}><ArrowUpFromLine size={18} /> WHATSAPP</button>
              <button className="button button-print-ticket action-button" onClick={() => window.print()}><Printer size={18} /> IMPRIMIR</button>
            </div>
            {shareNotice && <div className="share-notice" role="status">{shareNotice}</div>}
          </section>
        </div>
      )}

      {historyDetail && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setHistoryDetail(null);
        }}>
          <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="detail-dialog-heading"><div><span className="eyebrow">HISTORIAL</span><h2 id="detail-title">Detalle del ticket</h2></div><button className="icon-button" aria-label="Cerrar detalle" onClick={() => setHistoryDetail(null)}><X size={20} /></button></div>
            <TicketReceipt ticket={historyDetail} onPendingPaymentChange={(pending) => void setTicketPendingPayment(historyDetail.id, pending)} />
            <button className="button button-quiet detail-close" onClick={() => setHistoryDetail(null)}>CERRAR</button>
          </section>
        </div>
      )}

      {appointmentDetail && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAppointmentDetail(null);
        }}>
          <section className="detail-dialog agenda-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
            <div className="detail-dialog-heading">
              <div><span className="eyebrow">{formatDateKey(appointmentDetail.date)} · {appointmentDetail.time}</span><h2 id="appointment-detail-title">{appointmentDetail.client}</h2></div>
              <button className="icon-button" aria-label="Cerrar cita" onClick={() => setAppointmentDetail(null)}><X size={20} /></button>
            </div>
            <div className="appointment-detail-fields">
              <div><span>DIRECCIÓN</span><p>{appointmentDetail.address}</p></div>
              <div><span>TRABAJO A REALIZAR</span><p>{appointmentDetail.work}</p></div>
              <div>
                <span>MATERIAL QUE TENGO QUE LLEVAR</span>
                {appointmentDetail.materials.length ? (
                  <div className="appointment-material-list appointment-detail-materials">
                    {appointmentDetail.materials.map((material) => (
                      <label className="appointment-material-row" key={material.id}>
                        <span className="appointment-material-check"><input type="checkbox" checked={material.acquired} onChange={(event) => void updateAppointmentMaterial(appointmentDetail.id, material.id, event.target.checked)} /></span>
                        <span className={material.acquired ? "is-acquired" : ""}>{material.name}</span>
                      </label>
                    ))}
                  </div>
                ) : <p className="agenda-no-materials">Sin artículos añadidos</p>}
              </div>
            </div>
            <div className="agenda-detail-actions">
              <button className="button button-danger-outline" onClick={() => setConfirmDelete({ kind: "appointment", id: appointmentDetail.id })}><Trash2 size={16} /> ELIMINAR</button>
              <button className="button button-primary" onClick={() => editAppointment(appointmentDetail)}>EDITAR CITA</button>
            </div>
          </section>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
        prompt={confirmDelete.kind === "ticket"
          ? "¿Seguro que quieres eliminar este ticket?"
          : confirmDelete.kind === "product"
            ? "¿Seguro que quieres eliminar este producto?"
            : confirmDelete.kind === "appointment"
              ? "¿Seguro que quieres eliminar esta cita?"
            : confirmDelete.kind === "history"
              ? "¿Seguro que quieres eliminar todo el historial?"
              : "¿Seguro que quieres eliminar todo el catálogo?"}
        confirmLabel={confirmDelete.kind === "history" ? "BORRAR TODO" : "ELIMINAR"}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void (
          confirmDelete.kind === "ticket" ? removeTicket(confirmDelete.id)
            : confirmDelete.kind === "product" ? removeProduct(confirmDelete.id)
              : confirmDelete.kind === "appointment" ? removeAppointment(confirmDelete.id)
              : confirmDelete.kind === "history" ? removeAllTickets()
                : removeCatalog()
        )}
        />
      )}
    </div>
  );
}

export default App;
