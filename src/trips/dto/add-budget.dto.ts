import { IsString, IsNumber, IsPositive } from 'class-validator';

export class AddBudgetDto {
  @IsString()
  tripId: string;

  @IsString()
  category: string;

  @IsNumber()
  @IsPositive({ message: 'Budget amount must be greater than 0' })
  allocatedBudget: number;
}
