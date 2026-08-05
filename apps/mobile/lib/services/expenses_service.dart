import '../models/expense.dart';
import 'base_service.dart';

class ExpensesService extends BaseService<Expense> {
  ExpensesService(super.client)
      : super(
          resourcePath: '/api/v1/expenses/',
          fromJson: Expense.fromJson,
          toJson: (expense) => expense.toJson(),
        );
}
