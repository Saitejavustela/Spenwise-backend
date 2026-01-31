import { IsString, IsOptional, IsEnum, IsNumber, IsPositive, IsDateString } from 'class-validator';
import { PaymentMode, UpiProvider } from '@prisma/client';

export class CreateExpenseDto {
  @IsString()
  categoryId: string;

  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @IsString()
  description: string;

  @IsDateString()
  date: string; // ISO string

  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @IsOptional()
  @IsEnum(UpiProvider)
  upiProvider?: UpiProvider;

  @IsNumber()
  @IsPositive({ message: 'Amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  tripId?: string;
}
