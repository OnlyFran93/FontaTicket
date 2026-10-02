export interface Product {
  id: string;
  reference: string | null;
  nombre: string | null;
  precio: number | null;
  foto: string | null;
}

export interface TicketLine {
  id: string;
  description: string;
  reference?: string;
  unitPrice: number;
  quantity: number;
}

export interface Ticket {
  id: string;
  createdAt: string;
  customer?: string;
  lines: TicketLine[];
  total: number;
  pendingPayment?: boolean;
}

export interface AppointmentMaterial {
  id: string;
  name: string;
  acquired: boolean;
}

export interface Appointment {
  id: string;
  client: string;
  date: string;
  time: string;
  address: string;
  work: string;
  materials: AppointmentMaterial[];
}

export interface CartLine extends TicketLine {}
