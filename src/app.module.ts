import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CategoriesModule } from './categories/categories.module';
import { GroupsModule } from './groups/groups.module';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ExpensesModule,
    DashboardModule,
    CategoriesModule,
    GroupsModule,
    TripsModule,
  ],
})
export class AppModule { }

