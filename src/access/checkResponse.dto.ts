export interface CheckResponse {
  apto: boolean;
  reason: string;
  coiId?: string;
  status?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  vendorId?: string;
  buildingId?: string;
}