import { IsString } from 'class-validator';

export class AddMemberDto {
  @IsString()
  displayName: string;

  @IsString()
  groupId: string;
}
