import { Request, Response, NextFunction } from 'express';
import User from '../models/user';

/**
 * Express middleware that checks for X-USER-ID header and attaches User object to request
 * If the header exists and a valid user is found, the User object is attached to req.user
 * If the header doesn't exist or user is not found, the middleware continues without attaching user
 */
export default async function authenticate(req: Request, res: Response, next: NextFunction) {
    const userIdHeader = req.headers['x-user-id'];
    
    if (!userIdHeader) {
        return next(); // No user ID header, continue without authentication
    }

    // Handle both string and string[] cases for headers
    const userIdString = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
    const userId = parseInt(userIdString, 10);

    if (isNaN(userId)) {
        // Invalid user ID format
        res.status(401).json({ error: 'NOT AUTHORIZED' });
        return;
    }

    const userPasswordHeader = req.headers['x-user-password'];

    if (!userPasswordHeader) {
        res.status(401).json({ error: 'NOT AUTHORIZED' });
        return;
    }

    // Handle both string and string[] cases for headers
    const userPassword = Array.isArray(userPasswordHeader) ? userPasswordHeader[0] : userPasswordHeader;

    if (!userPassword.trim()) {
        res.status(401).json({ error: 'NOT AUTHORIZED' });
        return;
    }

    try {
        const user = await User.create(userId);
        if (!await user.checkAuthentication(userPassword)) {
            throw new Error('Invalid password');
        }

        req.user = user;
        next();
    } catch (error) {
        // If user creation fails (user not found), return NOT AUTHORIZED
        console.warn(`Failed to authenticate user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(401).json({ error: 'NOT AUTHORIZED' });
    }
};