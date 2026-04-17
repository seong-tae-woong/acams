import type { Bill, Expense, Receipt } from '@/lib/types/finance';
import { BillStatus } from '@/lib/types/finance';

// 2026년 4월 청구서
export const mockBills: Bill[] = [
  // 초등수학 기초반 (280,000원)
  { id: 'b1', studentId: 's1', studentName: '김도윤', classId: 'c1', className: '초등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 280000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-07', method: '카드', memo: '' },
  { id: 'b2', studentId: 's11', studentName: '임도현', classId: 'c1', className: '초등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 280000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-08', method: '계좌이체', memo: '' },
  { id: 'b3', studentId: 's14', studentName: '유하준', classId: 'c1', className: '초등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 0, status: BillStatus.UNPAID, dueDate: '2026-04-10', paidDate: null, method: null, memo: '연락 중' },
  { id: 'b4', studentId: 's4', studentName: '최하은', classId: 'c1', className: '초등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 280000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-10', method: '현금', memo: '' },
  { id: 'b5', studentId: 's5', studentName: '정민재', classId: 'c1', className: '초등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 150000, status: BillStatus.PARTIAL, dueDate: '2026-04-10', paidDate: '2026-04-09', method: '카드', memo: '잔여 130,000원 5월 합산' },
  { id: 'b6', studentId: 's10', studentName: '송지우', classId: 'c1', className: '초등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 280000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-06', method: '계좌이체', memo: '' },
  // 초등수학 심화반
  { id: 'b7', studentId: 's6', studentName: '강서윤', classId: 'c2', className: '초등수학 심화반', month: '2026-04', amount: 280000, paidAmount: 280000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-05', method: '카드', memo: '' },
  { id: 'b8', studentId: 's9', studentName: '오승현', classId: 'c2', className: '초등수학 심화반', month: '2026-04', amount: 280000, paidAmount: 280000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-08', method: '현금', memo: '' },
  { id: 'b9', studentId: 's12', studentName: '배서연', classId: 'c2', className: '초등수학 심화반', month: '2026-04', amount: 280000, paidAmount: 0, status: BillStatus.UNPAID, dueDate: '2026-04-10', paidDate: null, method: null, memo: '' },
  // 영어 파닉스반 (150,000원)
  { id: 'b10', studentId: 's2', studentName: '이수아', classId: 'c3', className: '영어 파닉스반', month: '2026-04', amount: 150000, paidAmount: 150000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-07', method: '카드', memo: '' },
  { id: 'b11', studentId: 's4', studentName: '최하은', classId: 'c3', className: '영어 파닉스반', month: '2026-04', amount: 150000, paidAmount: 150000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-10', method: '현금', memo: '' },
  { id: 'b12', studentId: 's8', studentName: '한예린', classId: 'c3', className: '영어 파닉스반', month: '2026-04', amount: 150000, paidAmount: 0, status: BillStatus.UNPAID, dueDate: '2026-04-10', paidDate: null, method: null, memo: '3월도 미납 중' },
  { id: 'b13', studentId: 's13', studentName: '권민서', classId: 'c3', className: '영어 파닉스반', month: '2026-04', amount: 150000, paidAmount: 150000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-09', method: '계좌이체', memo: '' },
  // 영어 중급반
  { id: 'b14', studentId: 's5', studentName: '정민재', classId: 'c4', className: '영어 중급반', month: '2026-04', amount: 150000, paidAmount: 150000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-07', method: '카드', memo: '' },
  { id: 'b15', studentId: 's20', studentName: '양하윤', classId: 'c4', className: '영어 중급반', month: '2026-04', amount: 150000, paidAmount: 150000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-08', method: '계좌이체', memo: '' },
  // 중등수학 기초반
  { id: 'b16', studentId: 's17', studentName: '조현우', classId: 'c5', className: '중등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 280000, status: BillStatus.PAID, dueDate: '2026-04-10', paidDate: '2026-04-06', method: '카드', memo: '' },
  { id: 'b17', studentId: 's18', studentName: '황지민', classId: 'c5', className: '중등수학 기초반', month: '2026-04', amount: 280000, paidAmount: 0, status: BillStatus.UNPAID, dueDate: '2026-04-10', paidDate: null, method: null, memo: '' },
];

export const mockExpenses: Expense[] = [
  { id: 'ex1', category: '임대료', description: '4월 임대료', amount: 2000000, date: '2026-04-01', memo: '' },
  { id: 'ex2', category: '강사비', description: '김선생 4월 강사비', amount: 3500000, date: '2026-04-25', memo: '' },
  { id: 'ex3', category: '강사비', description: '박선생 4월 강사비', amount: 3500000, date: '2026-04-25', memo: '' },
  { id: 'ex4', category: '강사비', description: '이선생 4월 강사비', amount: 3500000, date: '2026-04-25', memo: '' },
  { id: 'ex5', category: '교재비', description: '4월 교재 구입', amount: 500000, date: '2026-04-03', memo: '' },
  { id: 'ex6', category: '공과금', description: '수도/전기 4월', amount: 300000, date: '2026-04-15', memo: '' },
  { id: 'ex7', category: '소모품', description: '복사지 및 사무용품', amount: 80000, date: '2026-04-08', memo: '' },
];

export const mockReceipts: Receipt[] = [
  { id: 'rc1', billId: 'b1', studentId: 's1', studentName: '김도윤', amount: 280000, issuedDate: '2026-04-07', method: '카드', memo: '' },
  { id: 'rc2', billId: 'b2', studentId: 's11', studentName: '임도현', amount: 280000, issuedDate: '2026-04-08', method: '계좌이체', memo: '' },
  { id: 'rc3', billId: 'b4', studentId: 's4', studentName: '최하은', amount: 280000, issuedDate: '2026-04-10', method: '현금', memo: '' },
  { id: 'rc4', billId: 'b10', studentId: 's2', studentName: '이수아', amount: 150000, issuedDate: '2026-04-07', method: '카드', memo: '' },
];
