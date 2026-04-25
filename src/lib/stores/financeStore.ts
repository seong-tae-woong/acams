'use client';
import { create } from 'zustand';
import type { Bill, Expense, Receipt } from '@/lib/types/finance';
import { BillStatus } from '@/lib/types/finance';
import { toast } from '@/lib/stores/toastStore';

interface FinanceStore {
  bills: Bill[];
  expenses: Expense[];
  receipts: Receipt[];
  selectedMonth: string;
  loading: boolean;
  getBillsByStudent: (studentId: string) => Bill[];
  getUnpaidBills: () => Bill[];
  setSelectedMonth: (month: string) => void;
  // Async API actions
  fetchBills: (month?: string) => Promise<void>;
  fetchExpenses: (month?: string) => Promise<void>;
  fetchReceipts: (month?: string) => Promise<void>;
  payBill: (billId: string, amount: number, method: Bill['method'], paidDate: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  // adjustBill 은 DB 스키마에 adjustAmount/adjustMemo 없어 로컬만
  adjustBill: (billId: string, adjustAmount: number, adjustMemo: string) => void;
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  bills: [],
  expenses: [],
  receipts: [],
  selectedMonth: new Date().toISOString().slice(0, 7), // 'YYYY-MM'
  loading: false,

  getBillsByStudent: (studentId) => get().bills.filter((b) => b.studentId === studentId),
  getUnpaidBills: () => get().bills.filter((b) => b.status !== BillStatus.PAID),

  setSelectedMonth: (month) => set({ selectedMonth: month }),

  fetchBills: async (month) => {
    set({ loading: true });
    try {
      const m = month ?? get().selectedMonth;
      const res = await fetch(`/api/finance/bills?month=${m}`);
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

  fetchReceipts: async (month) => {
    set({ loading: true });
    try {
      const m = month ?? get().selectedMonth;
      const res = await fetch(`/api/finance/receipts?month=${m}`);
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
