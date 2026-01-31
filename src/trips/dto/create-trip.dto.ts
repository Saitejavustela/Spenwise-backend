import { IsString, IsDateString } from 'class-validator';

export class CreateTripDto {
  @IsString()
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
