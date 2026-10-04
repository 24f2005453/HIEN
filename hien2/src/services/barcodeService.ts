import { BARCODE_CATALOG } from "../data/mockData";
import { BarcodeProductMatch } from "../types";

export class BarcodeService {
  /**
   * Resolves a barcode string against trusted product master data.
   */
  public static resolveBarcode(input: string): BarcodeProductMatch | null {
    if (!input) return null;
    const clean = input.trim().toUpperCase();

    // Check exact barcode number or SKU
    const match = BARCODE_CATALOG.find(
      (item) => item.barcode === clean || item.sku.toUpperCase() === clean
    );

    if (match) return match;

    // Fuzzy check by substring (e.g. if entered 'NIKE' or 'SAMSUNG')
    const partialMatch = BARCODE_CATALOG.find(
      (item) =>
        item.sku.toUpperCase().includes(clean) ||
        item.expectedName.toUpperCase().includes(clean) ||
        item.barcode.includes(clean)
    );

    return partialMatch || null;
  }

  public static getSampleBarcodes(): BarcodeProductMatch[] {
    return BARCODE_CATALOG;
  }
}
