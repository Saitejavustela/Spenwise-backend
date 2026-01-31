import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class SettlementDto {
  @IsString()
  groupId: string;

  @IsString()
  fromMemberId: string;

  @IsString()
  toMemberId: string;

  @IsNumber()
  @IsPositive({ message: 'Settlement amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
