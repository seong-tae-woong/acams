'use client';
import { create } from 'zustand';
import type { Bill, Expense, Receipt } from '@/lib/types/finance';
import { BillStatus } from '@/lib/types/finance';
import { toast } from '@/lib/stores/toastStore';

interface FinanceStore {
  bills: Bill[];
  paidBillsView: Bill[];
  expenses: Expense[];
  receipts: Receipt[];
  selectedMonth: string;
  availableMonths: string[];
  availablePaidMonths: string[];
  availableReceiptMonths: string[];
  loading: boolean;
  getBillsByStudent: (studentId: string) => Bill[];
  getUnpaidBills: () => Bill[];
  setSelectedMonth: (month: string) => void;
  // Async API actions
  fetchAvailableMonths: () => Promise<void>;
  fetchAvailablePaidMonths: () => Promise<void>;
  fetchAvailableReceiptMonths: () => Promise<void>;
  fetchBills: (months?: string[], opts?: { status?: string; q?: string }) => Promise<void>;
  fetchPaidBills: (paidMonths?: string[], q?: string) => Promise<void>;
  fetchExpenses: (month?: string) => Promise<void>;
  fetchReceipts: (months?: string[], q?: string) => Promise<void>;
  payBill: (billId: string, amount: number, method: Bill['method'], paidDate: string) => Promise<void>;
  createBill: (input: { studentId: string; classId: string; month: string; dueDate: string; memo?: string; amount?: number }) => Promise<void>;
  generateBills: (month: string, dueDate?: string) => Promise<{ created: number; refreshed: number }>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  // adjustBill 은 DB 스키마에 adjustAmount/adjustMemo 없어 로컬만
  adjustBill: (billId: string, adjustAmount: number, adjustMemo: string) => void;
  cancelBill: (billId: string, cancelReason?: string) => Promise<{ cancelledBillIds: string[] }>;
  previewRebill: (billIds: string[]) => Promise<{ billId: string; studentName: string; className: string; month: string; calculatedAmount: number; feeType: string }[]>;
  rebill: (items: { billId: string; amount: number; dueDate: string }[], sendNotification?: boolean) => Promise<{ created: number }>;
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  bills: [],
  paidBillsView: [],
  expenses: [],
  receipts: [],
  selectedMonth: new Date().toISOString().slice(0, 7), // 'YYYY-MM'
  availableMonths: [],
  availablePaidMonths: [],
  availableReceiptMonths: [],
  loading: false,

  getBillsByStudent: (studentId) => get().bills.filter((b) => b.studentId === studentId),
  getUnpaidBills: () => get().bills.filter((b) => b.status !== BillStatus.PAID),

  setSelectedMonth: (month) => set({ selectedMonth: month }),

  fetchAvailableMonths: async () => {
    try {
      const res = await fetch('/api/finance/bills/months');
      if (!res.ok) throw new Error('월 목록 조회 실패');
      const data: string[] = await res.json();
      set({ availableMonths: data });
    } catch (err) {
      console.error('[financeStore.fetchAvailableMonths]', err);
    }
  },

  fetchAvailablePaidMonths: async () => {
    try {
      const res = await fetch('/api/finance/bills/paid-months');
      if (!res.ok) throw new Error('수납 월 목록 조회 실패');
      const data: string[] = await res.json();
      set({ availablePaidMonths: data });
    } catch (err) {
      console.error('[financeStore.fetchAvailablePaidMonths]', err);
    }
  },

  fetchAvailableReceiptMonths: async () => {
    try {
      const res = await fetch('/api/finance/receipts/months');
      if (!res.ok) throw new Error('영수증 월 목록 조회 실패');
      const data: string[] = await res.json();
      set({ availableReceiptMonths: data });
    } catch (err) {
      console.error('[financeStore.fetchAvailableReceiptMonths]', err);
    }
  },

  fetchBills: async (months, opts) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (months && months.length > 0) params.set('months', months.join(','));
      if (opts?.status) params.set('status', opts.status);
      if (opts?.q) params.set('q', opts.q);
      const qs = params.toString();
      const res = await fetch(qs ? `/api/finance/bills?${qs}` : '/api/finance/bills');
      if (!res.ok) throw new Error('청구서 조회 실패');
      const data: Bill[] = await res.json();
      set({ bills: data });
    } catch (err) {
      console.error('[financeStore.fetchBills]', err);
      toast('청구서를 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  fetchPaidBills: async (paidMonths, q) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (paidMonths && paidMonths.length > 0) params.set('paidMonths', paidMonths.join(','));
      if (q) params.set('q', q);
      const qs = params.toString();
      const res = await fetch(qs ? `/api/finance/bills?${qs}` : '/api/finance/bills');
      if (!res.ok) throw new Error('수납 내역 조회 실패');
      const data: Bill[] = await res.json();
      set({ paidBillsView: data });
    } catch (err) {
      console.error('[financeStore.fetchPaidBills]', err);
      toast('수납 내역을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  fetchExpenses: async (month) => {
    set({ loading: true });
    try {
      const m = month ?? get().selectedMonth;
      const res = await fetch(`/api/finance/expenses?month=${m}`);
      if (!res.ok) throw new Error('지출 조회 실패');
      const data: Expense[] = await res.json();
      set({ expenses: data });
    } catch (err) {
      console.error('[financeStore.fetchExpenses]', err);
      toast('지출 내역을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  fetchReceipts: async (months, q) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (months && months.length > 0) params.set('months', months.join(','));
      if (q) params.set('q', q);
      const qs = params.toString();
      const res = await fetch(qs ? `/api/finance/receipts?${qs}` : '/api/finance/receipts');
      if (!res.ok) throw new Error('영수증 조회 실패');
      const data: Receipt[] = await res.json();
      set({ receipts: data });
    } catch (err) {
      console.error('[financeStore.fetchReceipts]', err);
      toast('영수증을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  payBill: async (billId, amount, method, paidDate) => {
    try {
      const res = await fetch(`/api/finance/bills/${billId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, paidDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '납부 처리 실패');
      }
      const updated: Bill = await res.json();
      set((state) => ({
        bills: state.bills.map((b) => (b.id === billId ? updated : b)),
      }));
      toast('납부 처리되었습니다.', 'success');
      // 영수증 목록 갱신
      await get().fetchReceipts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '납부 처리에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  createBill: async (input) => {
    try {
      const res = await fetch('/api/finance/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '청구서 등록 실패');
      }
      const bill: Bill = await res.json();
      set((state) => ({ bills: [...state.bills, bill] }));
      toast('청구서가 등록되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '청구서 등록에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  generateBills: async (month, dueDate) => {
    try {
      const res = await fetch('/api/finance/bills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, ...(dueDate ? { dueDate } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '청구서 생성 실패');
      }
      return await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '청구서 생성에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  addExpense: async (input) => {
    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '지출 등록 실패');
      }
      const expense: Expense = await res.json();
      set((state) => ({ expenses: [...state.expenses, expense] }));
      toast('지출이 등록되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '지출 등록에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  cancelBill: async (billId, cancelReason = '원장 취소') => {
    try {
      const res = await fetch(`/api/finance/bills/${billId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '취소 처리 실패');
      }
      const data: { cancelledBillIds: string[] } = await res.json();
      // 취소된 청구서들을 스토어에서 갱신 (다음 fetch 시 반영됨)
      toast('청구서가 취소되었습니다.', 'success');
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '청구서 취소에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  previewRebill: async (billIds) => {
    const items = billIds.map((billId) => ({ billId, amount: 0, dueDate: '' }));
    const res = await fetch('/api/finance/bills/rebill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, preview: true }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? '금액 계산 실패');
    }
    return res.json();
  },

  rebill: async (items, sendNotification = false) => {
    try {
      const res = await fetch('/api/finance/bills/rebill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, sendNotification }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '재청구 실패');
      }
      const data: { created: number } = await res.json();
      toast(`재청구 ${data.created}건이 생성되었습니다.`, 'success');
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '재청구에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  // DB에 adjustAmount/adjustMemo 컬럼 없어 로컬만 (추후 스키마 추가 필요)
  adjustBill: (billId, adjustAmount, adjustMemo) => {
    set((state) => ({
      bills: state.bills.map((b) => {
        if (b.id !== billId) return b;
        const effectiveAmount = b.amount - adjustAmount;
        let status: BillStatus;
        if (b.paidAmount >= effectiveAmount && effectiveAmount > 0) status = BillStatus.PAID;
        else if (b.paidAmount > 0) status = BillStatus.PARTIAL;
        else status = BillStatus.UNPAID;
        return { ...b, adjustAmount, adjustMemo, status };
      }),
    }));
  },
}));
