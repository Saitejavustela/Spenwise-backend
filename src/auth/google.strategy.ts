import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor() {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (error: any, user?: any) => void,
    ): Promise<void> {
        const { id, name, emails, photos } = profile;

        const user = {
            googleId: id,
            email: emails?.[0]?.value,
            name: `${name?.givenName || ''} ${name?.familyName || ''}`.trim() || emails?.[0]?.value?.split('@')[0],
            avatar: photos?.[0]?.value,
        };

        done(null, user);
    }
}
