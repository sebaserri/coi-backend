export type OcrFields =
  | "insuredName"
  | "producer"
  | "effectiveDate"
  | "expirationDate"
  | "generalLiabLimit"
  | "autoLiabLimit"
  | "umbrellaLimit"
  | "certificateHolder";

export type OcrResult = {
  fields: Partial<Record<OcrFields, string | number | boolean>>;
  confidence?: number;
  raw?: any;
};

export interface OcrAdapter {
  extractFromS3(bucket: string, key: string): Promise<OcrResult>;
}
