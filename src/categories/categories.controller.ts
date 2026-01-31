import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubCategoryDto } from './dto/create-subcategory.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) { }

  @Get()
  getAll(@Req() req) {
    return this.categoriesService.getAll(req.user.userId);
  }

  @Post()
  create(@Req() req, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(req.user.userId, dto);
  }

  @Post('sub')
  createSub(@Body() dto: CreateSubCategoryDto) {
    return this.categoriesService.createSubCategory(dto);
  }

  // More specific route must come BEFORE generic :id routes
  @Delete('sub/:subId')
  deleteSub(@Param('subId') subId: string) {
    return this.categoriesService.deleteSubCategory(subId);
  }

  @Get(':id/detail')
  getDetail(@Req() req, @Param('id') id: string) {
    return this.categoriesService.getCategoryDetail(req.user.userId, id);
  }

  @Delete(':id')
  delete(@Req() req, @Param('id') id: string) {
    return this.categoriesService.deleteCategory(req.user.userId, id);
  }
}

