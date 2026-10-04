export interface CallTarget {
  name: string;
  subtitle: string;
  role: "manager" | "buyer";
  phone?: string;
  accessPointCode?: string;
}

export interface CallState {
  isActive: boolean;
  status: "dialing" | "connected" | "ended";
  target: CallTarget | null;
  durationSeconds: number;
}
