'use client';
import { create } from 'zustand';
import type { Bill, Expense, Receipt } from '@/lib/types/finance';
import { BillStatus } from '@/lib/types/finance';
import { mockBills, mockExpenses, mockReceipts } from '@/lib/mock/finance';

interface FinanceStore {
  bills: Bill[];
  expenses: Expense[];
  receipts: Receipt[];
  selectedMonth: string;
  getBillsByStudent: (studentId: string) => Bill[];
  getUnpaidBills: () => Bill[];
  setSelectedMonth: (month: string) => void;
  payBill: (billId: string, amount: number, method: Bill['method'], paidDate: string) => void;
  adjustBill: (billId: string, adjustAmount: number, adjustMemo: string) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  bills: mockBills,
  expenses: mockExpenses,
  receipts: mockReceipts,
  selectedMonth: '2026-04',

  getBillsByStudent: (studentId) => get().bills.filter((b) => b.studentId === studentId),
  getUnpaidBills: () => get().bills.filter((b) => b.status !== BillStatus.PAID),

  setSelectedMonth: (month) => set({ selectedMonth: month }),

  payBill: (billId, amount, method, paidDate) => {
    set((state) => ({
      bills: state.bills.map((b) => {
        if (b.id !== billId) return b;
        const effectiveAmount = b.amount - (b.adjustAmount ?? 0);
        const newPaid = b.paidAmount + amount;
        const status = newPaid >= effectiveAmount ? BillStatus.PAID : BillStatus.PARTIAL;
        return { ...b, paidAmount: newPaid, status, method, paidDate };
      }),
    }));
  },

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

  addExpense: (input) => {
    const expense: Expense = { ...input, id: `ex${Date.now()}` };
    set((state) => ({ expenses: [...state.expenses, expense] }));
  },
}));
