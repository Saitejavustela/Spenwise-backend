import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async googleLogin(profile: GoogleProfile) {
    // Find existing user by googleId or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.googleId },
          { email: profile.email },
        ],
      },
    });

    if (user) {
      // Update googleId and avatar if not set
      if (!user.googleId || !user.avatar) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
            avatar: profile.avatar || user.avatar,
            name: user.name || profile.name,
          },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      ...tokens
    };
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    // Extended token expiry to 7 days (was 15m - caused session termination)
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '30d',
    });

    return { accessToken, refreshToken };
  }
}
