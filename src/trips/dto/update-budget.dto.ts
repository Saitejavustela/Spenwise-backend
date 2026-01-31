import { IsNumber, IsPositive } from 'class-validator';

export class UpdateBudgetDto {
    @IsNumber()
    @IsPositive()
    additionalAmount: number;
}
