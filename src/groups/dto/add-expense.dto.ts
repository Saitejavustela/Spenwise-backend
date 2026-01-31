import { IsString, IsNumber, IsPositive, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class ShareDto {
  @IsString()
  memberId: string;

  @IsNumber()
  @IsPositive({ message: 'Share amount must be greater than 0' })
  amount: number;
}

export class AddExpenseDto {
  @IsString()
  groupId: string;

  @IsString()
  paidBy: string;

  @IsString()
  description: string;

  @IsNumber()
  @IsPositive({ message: 'Amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShareDto)
  shares: ShareDto[];
}

