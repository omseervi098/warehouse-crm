import Transaction from '../models/transaction.js';
import Unit from '../models/unit.js';

const IST_OFFSET_MIN = 0; // +05:30
const IST_OFFSET_MS = IST_OFFSET_MIN * 60 * 1000;

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function addMonthsSnapIST(anchor: Date, months: number): Date {
  const t = new Date(anchor.getTime() + IST_OFFSET_MS);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const day = t.getUTCDate();
  const target = new Date(Date.UTC(y, m + months + 1, 0));
  const lastDay = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  const chosenDay = Math.min(day, lastDay);
  const snapped = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), chosenDay, 23, 59, 59, 999));
  return new Date(snapped.getTime() - IST_OFFSET_MS);
}

function baseLotFields(lot: any) {
  return {
    _id: lot._id,
    lotNumber: lot.lotNumber,
    party: lot.party,
    item: lot.item,
    unit: lot.unit,
    inwardDates: lot.inwardDates,
    chargeable: lot.chargeable,
    warehouses: lot.warehouses,
    quantity: lot.quantity,
    earliestEntryAt: lot.earliestEntryAt,
    latestEntryAt: lot.latestEntryAt,
    isNil: lot.isNil,
  };
}

function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
function applyTxn(balance: number, t: any): number {
  if (t.type === 'INWARD' || t.type === 'RETURN') return balance + (t.quantity || 0);
  if (t.type === 'OUTWARD') return balance - (t.quantity || 0);
  return balance;
}
function txnsToRows(txns: any[]) {
  let bal = 0;
  return txns.map((t) => {
    bal = applyTxn(bal, t);
    return { kind: 'transaction', _id: t._id, date: t.enteredAt, type: t.type, quantity: t.quantity, balance: bal };
  });
}
function buildPrefix(transactions: any[]) {
  let bal = 0;
  const prefix: Array<{ at: Date; bal: number }> = [];
  for (const t of transactions) { bal = applyTxn(bal, t); prefix.push({ at: t.enteredAt, bal }); }
  return prefix;
}
function balanceAt(prefix: Array<{ at: Date; bal: number }>, boundary: Date): number {
  let bal = 0; for (let i = 0; i < prefix.length; i++) { if (prefix[i].at <= boundary) bal = prefix[i].bal; else break; } return bal;
}
async function rateAt(stock: any, unitId: any, _when: Date): Promise<number> {
  if (typeof stock?.chargeRate === 'number') {
    return stock.chargeRate;
  }
  const unit = await Unit.findById(unitId).lean<{ rate?: number }>();
  return unit?.rate ?? 0;
}

export async function computeChargesForLot(stock: any, includeBreakdown: boolean = true): Promise<any> {
  const lotId = stock.lotNumber;
  const txns = (await Transaction.find({ lotNumber: lotId }).sort({ enteredAt: 1, _id: 1 }).lean()) as any;
  const inwardTxns = txns.filter((t: any) => t.type === 'INWARD');
  if (inwardTxns.length === 0) {
    return { ...baseLotFields(stock), charge: 0, totalCharge: 0, firstMonth: { combined: 0 }, breakdown: includeBreakdown ? txnsToRows(txns) : undefined };
  }
  const firstInwardAt = inwardTxns[0].enteredAt;
  const day1End = endOfDay(firstInwardAt);
  const day2End = endOfDay(new Date(firstInwardAt.getTime() + 24 * 3600 * 1000));
  const anchorInward = inwardTxns.filter((t: any) => t.enteredAt <= day2End).slice(-1)[0] || inwardTxns[0];
  const anchorDate = endOfDay(anchorInward.enteredAt);
  const anniversaryDay = new Date(anchorDate.getTime() + IST_OFFSET_MS).getUTCDate();

  const prefix = buildPrefix(txns);
  const balD1 = balanceAt(prefix, day1End);
  const balD2 = balanceAt(prefix, day2End);
  const rateD1 = await rateAt(stock, stock.unit._id || stock.unit, day1End);
  const rateD2 = await rateAt(stock, stock.unit._id || stock.unit, day2End);
  const amtD1 = round2(balD1 * rateD1);
  const amtD2 = round2(Math.max(0, balD2 - balD1) * rateD2);
  const firstMonth = { day1: balD1 > 0 ? { date: day1End, balance: balD1, amount: amtD1 } : undefined, day2: balD2 > balD1 ? { date: day2End, balance: balD2, amount: amtD2 } : undefined, combined: round2(amtD1 + amtD2) };

  const now = new Date();
  const afterDay2 = addMonthsSnapIST(anchorDate, 1);
  const chargeRows: Array<{ date: Date; label: string; balanceAtBoundary: number; rateApplied: number; amount: number }>[] = [] as any;
  const rows: Array<{ date: Date; label: string; balanceAtBoundary: number; rateApplied: number; amount: number }> = [];
  let idx = 1; let anniv = afterDay2;
  while (anniv <= now) {
    const bal = balanceAt(prefix, anniv);
    if (bal > 0) {
      const r = await rateAt(stock, stock.unit._id || stock.unit, anniv);
      const amt = round2(bal * r);
      rows.push({ date: anniv, label: `${anniv.toLocaleString('default', { month: 'short' })} ${anniv.getUTCFullYear().toString()} Charge`, balanceAtBoundary: bal, rateApplied: r, amount: amt });
    }
    idx += 1; anniv = addMonthsSnapIST(anchorDate, idx);
  }
  const laterTotal = round2(rows.reduce((s, c) => s + c.amount, 0));
  const totalCharge = round2(firstMonth.combined + laterTotal);

  let breakdown: any[] | undefined;
  if (includeBreakdown) {
    const merged: any[] = [];
    let bal = 0;
    for (const t of txns) {
      bal = applyTxn(bal, t);
      merged.push({ kind: 'transaction', _id: t._id, date: t.enteredAt, type: t.type, quantity: t.quantity, shortage: t.shortage, extra: t.extra, balance: bal, vehicleNumber: t.vehicleNumber, doNumber: t.doNumber, remark: t.remark });
    }
    const firstMonthCharge = amtD1 + amtD2;
    const dayEnd = amtD2 > 0 ? day2End : day1End;
    const rateApplied = amtD2 > 0 ? rateD2 : rateD1;
    const balanceAtBoundary = amtD2 > 0 ? balD2 : balD1;
    if (firstMonthCharge > 0) {
      merged.push({ kind: 'charge', date: dayEnd, label: `${dayEnd.toLocaleString('default', { month: 'short' })} ${dayEnd.getUTCFullYear().toString()} Charge`, balanceAtBoundary, rateApplied, amount: firstMonthCharge });
    }
    for (const c of rows) merged.push({ kind: 'charge', ...c });
    merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    breakdown = merged;
  }
  return { ...baseLotFields(stock), chargeRate: typeof stock?.chargeRate === 'number' ? stock.chargeRate : rateD1, anchorDate, anniversaryDay, firstMonth, charge: totalCharge, totalCharge, breakdown };
}
