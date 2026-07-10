// Fixed auth.controller.ts with correct response structure

import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  Req,
  Query,
  UnauthorizedException,
  Get,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { SessionTrackingService } from '../services/session-tracking.service';
import { AuditLogService } from '../services/audit-log.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  AuthUserDto,
  UserRolesDto,
} from '#common/dto/user.dto';

import { ApiResponseDto } from '#common/dto/base-response.dto';
import { Request as ExpressRequest } from 'express';
import { Public } from '#common/constants/auth.constants';

@ApiTags('Auth')
@ApiExtraModels(ApiResponseDto, AuthUserDto, UserRolesDto, AuthResponse)
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly sessionTrackingService: SessionTrackingService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(AuthResponse) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: ExpressRequest,
  ): Promise<ApiResponseDto<AuthResponse>> {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const authResponse = await this.authService.login(
      loginDto,
      ipAddress,
      userAgent,
    );
    return ApiResponseDto.success(authResponse, 'User logged in successfully');
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(AuthResponse) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or username already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing required fields',
  })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<ApiResponseDto<AuthResponse>> {
    const authResponse = await this.authService.register(registerDto);
    return ApiResponseDto.created(authResponse, 'User registered successfully');
  }

  @Public()
  @Get('validate-token')
  @ApiOperation({ summary: 'Validate access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(AuthUserDto) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid token',
  })
  async validateToken(
    @Query('token') token: string,
  ): Promise<ApiResponseDto<AuthResponse['user']>> {
    const user = await this.authService.validateToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }
    return ApiResponseDto.success(user, 'Token is valid');
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(AuthResponse) },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
  ): Promise<ApiResponseDto<AuthResponse>> {
    const authResponse = await this.authService.refreshToken(refreshToken);
    return ApiResponseDto.success(
      authResponse,
      'Access token refreshed successfully',
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User logged out successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async logout(
    @Req() req: ExpressRequest & { user: any },
    @Body('refreshToken') refreshToken?: string,
  ): Promise<ApiResponseDto<null>> {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const userId = req.user.sub;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    return this.authService.logout(
      userId,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
    );
  }
}
