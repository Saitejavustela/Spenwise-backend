import { IsString, IsNumber, IsPositive, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class AddTripExpenseDto {
    @IsString()
    tripId: string;

    @IsString()
    category: string;

    @IsString()
    description: string;

    @IsNumber()
    @IsPositive()
    amount: number;

    @IsDateString()
    date: string;

    @IsString()
    paymentMode: string;

    @IsOptional()
    @IsString()
    subCategory?: string;
}
