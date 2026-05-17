// rekey 입력 DTO. 현재 마스터로 vault 를 확인한 뒤 newMaster 와 newKdfVersion 으로 모든 entry 를 재암호화한다.
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class RekeyDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  currentMaster!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  newMaster?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  newKdfVersion?: number;
}
