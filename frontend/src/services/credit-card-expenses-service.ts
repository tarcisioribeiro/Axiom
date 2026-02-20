import { API_CONFIG } from '@/config/constants';
import type { CreditCardExpense, CreditCardExpenseFormData } from '@/types';

import { BaseService } from './base-service';

class CreditCardExpensesService extends BaseService<CreditCardExpense, CreditCardExpenseFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.CREDIT_CARD_EXPENSES);
  }

  async getByCard(cardId: number): Promise<CreditCardExpense[]> {
    return this.getAll({ card: cardId });
  }

  async getByBill(billId: number): Promise<CreditCardExpense[]> {
    return this.getAll({ bill: billId });
  }

  async getByCategory(category: string): Promise<CreditCardExpense[]> {
    return this.getAll({ category });
  }

  async getUnpaid(): Promise<CreditCardExpense[]> {
    return this.getAll({ payed: false });
  }

  async getPaid(): Promise<CreditCardExpense[]> {
    return this.getAll({ payed: true });
  }
}

export const creditCardExpensesService = new CreditCardExpensesService();
