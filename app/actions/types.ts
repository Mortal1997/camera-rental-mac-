export type Equipment = {
  id: string;
  name: string;
  category?: string;
  serial_number?: string;
  daily_fee: number;
  deposit: number;
  status: 'available' | 'maintenance' | 'rented' | 'pending';
  warranty_expire_date?: string;
};

export type Order = {
  id: string;
  user_id?: string;
  equipment_id?: string;
  external_order_id?: string;
  created_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_price?: number | null;
  deposit_paid?: number | null;
  status: 'unprocessed' | 'pending_payment' | 'confirmed' | 'using' | 'returned' | 'cancelled';
  tracking_number?: string;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: string;
  deposit_exemption?: string;
  platform_source?: string;
  shipping_method?: string;
  expected_equipment_model?: string;
  notes?: string;
  equipment?: Equipment;
};

export type OrderWithEquipment = Order & {
  equipment: Equipment;
};

export type EquipmentWithOrders = Equipment & {
  orders: Order[];
};
