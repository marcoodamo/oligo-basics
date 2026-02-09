
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';
import { UserRole } from '@prisma/client';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            role: UserRole;
            organizationId: string;
        } & DefaultSession['user'];
    }

    interface User extends DefaultUser {
        role: UserRole;
        organizationId: string;
    }
}

declare module 'next-auth/jwt' {
    interface JWT extends DefaultJWT {
        role: UserRole;
        organizationId: string;
    }
}
