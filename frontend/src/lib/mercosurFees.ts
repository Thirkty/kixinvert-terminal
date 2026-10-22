import { MercosurFeeDetails } from '@/types';

/**
 * Calculador de Liquidación y Comisiones de Mercosur Casa de Bolsa (BVC)
 *
 * Estructura estándar del comprobante de liquidación:
 * 1. Monto Bruto: Acciones * Precio Unitario
 * 2. Comisión Casa de Bolsa: Suele ser 1.00% (regulada máx 2.00%)
 * 3. IVA sobre la Comisión: 16% (Aplica EXCLUSIVAMENTE a la comisión del corredor)
 * 4. Aranceles de Mercado: 0.20% (BVC 0.10% + CVV 0.05% + SUNAVAL 0.05%)
 *
 * Total de Gastos: Comisión + IVA + Aranceles
 * Total Liquidación Compra: Monto Bruto + Total Gastos
 * Total Liquidación Venta: Monto Bruto - Total Gastos
 */

export const MERCOSU_DEFAULTS = {
  commissionPct: 1.0, // 1%
  ivaPct: 16.0,       // 16% sobre comisión
  marketFeesPct: 0.2, // 0.20% (BVC + CVV + SUNAVAL)
};

export interface FeeCalculationParams {
  shares: number;
  price: number;
  commissionPct?: number;
  manualCommission?: number | null;
  manualIva?: number | null;
  manualMarketFees?: number | null;
  manualNetAmount?: number | null;
}

export function calculateMercosurFees({
  shares,
  price,
  commissionPct = MERCOSU_DEFAULTS.commissionPct,
  manualCommission = null,
  manualIva = null,
  manualMarketFees = null,
  manualNetAmount = null,
}: FeeCalculationParams): MercosurFeeDetails {
  const grossAmount = Math.max(0, shares * price);

  // Comisión Mercosur
  const commissionAmount =
    manualCommission !== null && manualCommission !== undefined
      ? Math.max(0, manualCommission)
      : (grossAmount * (commissionPct / 100));

  // IVA (16% sobre comisión)
  const ivaAmount =
    manualIva !== null && manualIva !== undefined
      ? Math.max(0, manualIva)
      : (commissionAmount * (MERCOSU_DEFAULTS.ivaPct / 100));

  // Aranceles BVC + CVV + SUNAVAL
  const marketFeesAmount =
    manualMarketFees !== null && manualMarketFees !== undefined
      ? Math.max(0, manualMarketFees)
      : (grossAmount * (MERCOSU_DEFAULTS.marketFeesPct / 100));

  const totalFees = commissionAmount + ivaAmount + marketFeesAmount;

  // Montos netos
  const calculatedNetBuy = grossAmount + totalFees;
  const calculatedNetSell = Math.max(0, grossAmount - totalFees);

  const netAmountBuy =
    manualNetAmount !== null && manualNetAmount !== undefined && manualNetAmount > 0
      ? manualNetAmount
      : calculatedNetBuy;

  const netAmountSell =
    manualNetAmount !== null && manualNetAmount !== undefined && manualNetAmount > 0
      ? manualNetAmount
      : calculatedNetSell;

  return {
    grossAmount,
    commissionPct,
    commissionAmount,
    ivaAmount,
    marketFeesPct: MERCOSU_DEFAULTS.marketFeesPct,
    marketFeesAmount,
    totalFees,
    netAmountBuy,
    netAmountSell,
  };
}
