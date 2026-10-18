import { IsString, IsUrl, MaxLength } from 'class-validator';

export class PushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;

  @IsString()
  @MaxLength(256)
  p256dh!: string;

  @IsString()
  @MaxLength(256)
  auth!: string;
}
