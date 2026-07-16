import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ApiResponseWithData } from '#common/decorators/api-response-with-data.decorator';
import { UsersService, UserWithRelations } from '../services/users.service';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { CurrentUser } from '#common/decorators/current-user.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  UserProfileResponseDto,
  UserListResponseDto,
  AchievementDto,
  AchievementStatsDto,
} from '#common/dto/user.dto';
import {
  BaseUserResponseDto,
  ApiResponseDto,
} from '#common/dto/base-response.dto';
import { PaginationDto } from '#common/dto/pagination.dto';
import { ParseUUIDPipe } from '../pipes/parse-uuid.pipe';
import { Role } from '#modules/auth/constants/role.constants';
// Exceptions are already imported from @nestjs/common above
import type { AuthenticatedRequest } from '#common/dto/user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponseWithData(HttpStatus.CREATED, BaseUserResponseDto)
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<ApiResponseDto<BaseUserResponseDto>> {
    const user = await this.usersService.create(createUserDto);
    return ApiResponseDto.success(user, 'User created successfully');
  }

  @Get()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Get all users with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponseWithData(HttpStatus.OK, UserListResponseDto)
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<ApiResponseDto<UserListResponseDto>> {
    const users = await this.usersService.findAll(pagination);
    return ApiResponseDto.success(users, 'Users retrieved successfully');
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponseWithData(HttpStatus.OK, UserProfileResponseDto)
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async getProfile(
    @CurrentUser() user: AuthenticatedRequest['user'],
  ): Promise<ApiResponseDto<UserProfileResponseDto>> {
    const response = await this.usersService.getUserProfile(user.id);
    return ApiResponseDto.success(
      response,
      'User profile retrieved successfully',
    );
  }

  @Get('profile/:id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  @ApiResponseWithData(HttpStatus.OK, UserProfileResponseDto)
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async getUserProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<UserProfileResponseDto>> {
    console.log(`[UsersController] Fetching profile for user: ${id}`);
    try {
      const response = await this.usersService.getUserProfile(id);
      console.log(
        `[UsersController] Successfully fetched profile for user: ${id}`,
      );
      return ApiResponseDto.success(
        response,
        'User profile retrieved successfully',
      );
    } catch (error) {
      console.error(
        `[UsersController] Error fetching profile for user ${id}:`,
        error,
      );
      throw error;
    }
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Get current user achievements' })
  @ApiResponseWithData(HttpStatus.OK, AchievementDto)
  async getAchievements(): Promise<ApiResponseDto<AchievementDto[]>> {
    // Stubbed response until achievements module is fully developed
    return ApiResponseDto.success([], 'Achievements retrieved successfully');
  }

  @Get('achievement-summary')
  @ApiOperation({ summary: 'Get current user achievement statistics' })
  @ApiResponseWithData(HttpStatus.OK, AchievementStatsDto)
  async getAchievementStats(): Promise<ApiResponseDto<AchievementStatsDto>> {
    // Stubbed response for frontend dashboard/achievements page
    const stats: AchievementStatsDto = {
      totalEarned: 0,
      totalPossible: 10,
      points: 0,
      rank: 'Beginner',
      nextRankProgress: 0,
    };
    return ApiResponseDto.success(
      stats,
      'Achievement stats retrieved successfully',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponseWithData(HttpStatus.OK, BaseUserResponseDto)
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedRequest['user'],
  ): Promise<ApiResponseDto<BaseUserResponseDto>> {
    // Allow admin to fetch any user, otherwise restrict to own profile
    if (currentUser.role !== Role.admin && currentUser.id !== id) {
      throw new ForbiddenException('You can only access your own profile.');
    }
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return ApiResponseDto.success(
      await this.usersService.mapUserToDto(user),
      'User retrieved successfully',
    );
  }

  @Get('email/:email')
  @ApiOperation({ summary: 'Get user by email' })
  @ApiResponseWithData(HttpStatus.OK, BaseUserResponseDto)
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findByEmail(
    @Param('email') email: string,
  ): Promise<ApiResponseDto<BaseUserResponseDto>> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mappedUser = await this.usersService.mapUserToDto(user);
    return ApiResponseDto.success(mappedUser, 'User retrieved successfully');
  }

  @Get('username/:username')
  @ApiOperation({ summary: 'Get user by username' })
  @ApiResponseWithData(HttpStatus.OK, BaseUserResponseDto)
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findByUsername(
    @Param('username') username: string,
  ): Promise<ApiResponseDto<BaseUserResponseDto>> {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mappedUser = await this.usersService.mapUserToDto(user);
    return ApiResponseDto.success(mappedUser, 'User retrieved successfully');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user details' })
  @ApiResponseWithData(HttpStatus.OK, BaseUserResponseDto)
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ): Promise<ApiResponseDto<BaseUserResponseDto>> {
    console.log(`[UsersController] Updating profile for user: ${id}`, {
      body: updateUserDto,
    });
    if (user.id !== id && user.role !== Role.admin) {
      console.warn(
        `[UsersController] Forbidden: user ${user.id} tried to update ${id}`,
      );
      throw new ForbiddenException('Cannot update another user');
    }
    try {
      const updatedUser = await this.usersService.updateProfile(
        id,
        updateUserDto,
      );
      console.log(
        `[UsersController] Successfully updated profile for user: ${id}`,
      );
      return ApiResponseDto.success(updatedUser, 'User updated successfully');
    } catch (error) {
      console.error(
        `[UsersController] Error updating profile for user ${id}:`,
        error,
      );
      throw error;
    }
  }

  @Post(':id/profile/image')
  @ApiOperation({
    summary: 'Upload and optimise a profile image (stored in Cloudinary)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the public Cloudinary URL and storage key',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadProfileImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: AuthenticatedRequest['user'],
  ): Promise<ApiResponseDto<{ url: string; key: string }>> {
    if (currentUser.id !== id && currentUser.role !== Role.admin) {
      throw new ForbiddenException(
        'You can only update your own profile image.',
      );
    }
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    const result = await this.usersService.uploadProfileImage(id, file);
    return ApiResponseDto.success(
      result,
      'Profile image uploaded successfully',
    );
  }

  @Put(':id/role')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiResponseWithData(HttpStatus.OK, BaseUserResponseDto)
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: Role,
  ): Promise<ApiResponseDto<BaseUserResponseDto>> {
    const updatedUser = await this.usersService.updateRole(id, role);
    return ApiResponseDto.success(
      updatedUser,
      'User role updated successfully',
    );
  }

  @Put(':id/password')
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password updated successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { currentPassword: string; newPassword: string },
    @CurrentUser() user: AuthenticatedRequest['user'],
  ): Promise<ApiResponseDto<void>> {
    if (user.id !== id) {
      throw new ForbiddenException("Cannot update another user's password");
    }
    await this.usersService.updatePassword(
      id,
      body.currentPassword,
      body.newPassword,
    );
    return ApiResponseDto.success(undefined, 'Password updated successfully');
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async resetPassword(
    @Body() body: { email: string },
  ): Promise<ApiResponseDto<null>> {
    await this.usersService.resetPassword(body.email);
    return ApiResponseDto.success(null, 'Password reset email sent');
  }

  @Delete(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<null>> {
    await this.usersService.remove(id);
    return ApiResponseDto.success(null, 'User deleted successfully');
  }


  @Post('validate')
  @ApiOperation({ summary: 'Validate user credentials' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Credentials valid',
    type: () => BaseUserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  async validateUser(
    @Body() body: { username: string; password: string },
  ): Promise<ApiResponseDto<{ userId: string }>> {
    const user = await this.usersService.validateUser(
      body.username,
      body.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return ApiResponseDto.success({ userId: user.id }, 'Credentials valid');
  }
}
