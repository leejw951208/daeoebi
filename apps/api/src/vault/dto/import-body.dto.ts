// import 엔드포인트 body DTO. master 길이와 base64 컨테이너 필수성을 ValidationPipe 가 통일 처리한다.
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ImportBodyDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  master!: string;

  @IsString()
  @MinLength(1)
  container!: string;
}
