import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { GetUser } from '#common/decorators/get-user.decorator';
import { RoleGuard } from '#common/guards/roles.guard';
import { Roles } from '#common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { User } from '@prisma/client';
import { UnitsService } from '../services/units.service';
import { CreateUnitDto, UpdateUnitDto } from '../../../../common/dto/unit.dto';

@ApiTags('units')
@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all units' })
  @ApiResponse({ status: 200, description: 'Units retrieved successfully' })
  async findAll() {
    return await this.unitsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit by ID' })
  @ApiResponse({ status: 200, description: 'Unit found' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  async findOne(@Param('id') id: string) {
    return await this.unitsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new unit' })
  @ApiResponse({ status: 201, description: 'Unit created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid unit data' })
  async create(
    @Body() createUnitDto: CreateUnitDto,
    @GetUser() user: User,
  ) {
    return await this.unitsService.create(createUnitDto, user.id);
  }

  @Put(':id')
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a unit' })
  @ApiResponse({ status: 200, description: 'Unit updated successfully' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUnitDto: UpdateUnitDto,
    @GetUser() user: User,
  ) {
    return await this.unitsService.update(id, updateUnitDto, user.id);
  }

  @Delete(':id')
  @UseGuards(RoleGuard)
  @Roles(Role.instructor, Role.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a unit' })
  @ApiResponse({ status: 204, description: 'Unit deleted successfully' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @GetUser() user: User) {
    return await this.unitsService.remove(id, user.id);
  }
}
