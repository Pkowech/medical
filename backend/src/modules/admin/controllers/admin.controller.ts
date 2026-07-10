import {
  Controller,
  Get,
  UseGuards,
  Post,
  Body,
  Put,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { AdminService } from '../services/admin.service';
import { UpdateUserDto, CreateUserDto, PaginationDto, CreateRoleDto, UpdateRoleDto } from '#common/dto';
import { Resource } from '#common/decorators/resource.decorator';
import { Action } from '#common/decorators/action.decorator';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.admin)
@Resource('admin')
@ApiBearerAuth()
export class AdminController {
  constructor(
   private readonly adminService: AdminService,
   private readonly prisma: PrismaService) {}

  @Get('system-overview/data')
  @ApiOperation({ summary: 'Get system-wide metrics' })
  @ApiResponse({
    status: 200,
    description: 'Returns system-wide analytics metrics',
  })
  async getSystemMetrics() {
    return this.adminService.getSystemMetrics();
  }

  // User Management
  @Get('users')
  @Action('read')
  @ApiOperation({ summary: 'Get all users (paginated)' })
  async getUsers(@Query() pagination: PaginationDto) {
    const page = pagination.page && !isNaN(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = pagination.limit && !isNaN(Number(pagination.limit)) ? Number(pagination.limit) : 10;
    return this.adminService.getUsers(page, limit);
  }

  @Get('users/:id')
  @Action('read')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Post('users')
  @Action('create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'Returns the created user',
  })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(createUserDto);
  }

  @Put('users/:id')
  @Action('update')
  @ApiOperation({ summary: 'Update an existing user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the updated user',
  })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  @Action('delete')
  @ApiOperation({ summary: 'Delete a user' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // Role Management
  @Get('roles')
  @Action('read')
  @ApiOperation({ summary: 'Get all roles (paginated)' })
  async getRoles(@Query() pagination: PaginationDto) {
    const page = pagination.page && !isNaN(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = pagination.limit && !isNaN(Number(pagination.limit)) ? Number(pagination.limit) : 10;
    return this.adminService.getRoles(page, limit);
  }

  @Get('roles/:id')
  @Action('read')
  @ApiOperation({ summary: 'Get role by ID' })
  async getRoleById(@Param('id') id: string) {
    return this.adminService.getRoleById(id);
  }

  @Post('roles')
  @Action('create')
  @ApiOperation({ summary: 'Create a new role' })
  async createRole(@Body() roleData: CreateRoleDto) {
    return this.adminService.createRole(roleData);
  }

  @Put('roles/:id')
  @Action('update')
  @ApiOperation({ summary: 'Update an existing role' })
  async updateRole(@Param('id') id: string, @Body() roleData: UpdateRoleDto) {
    return this.adminService.updateRole(id, roleData);
  }

  @Delete('roles/:id')
  @Action('delete')
  @ApiOperation({ summary: 'Delete a role' })
  async deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }



  @Get('xapi/statements')
  @ApiOperation({ summary: 'Get recent xAPI statements' })
  async getStatements(@Query('limit') limit = '50') {
    const take = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    return this.prisma.xapiStatement.findMany({
      orderBy: { occurredAt: 'desc' },
      take,
    });
  }

  @Get('material-events')
  @ApiOperation({ summary: 'Get recent material events' })
  async getMaterialEvents(@Query('limit') limit = '50') {
    const take = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    return this.prisma.materialEvent.findMany({
      orderBy: { lastOccurredAt: 'desc' },
      take,
    });
  }
}
