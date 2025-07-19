import express, { Request, Response } from 'express';
import enrollUser from '../utils/enrollUser';
import DatabaseManager from '../db/db';

const router = express.Router();

router.post('/', async (req: Request, res: Response) => {
    if (!req.user || req.user.getRole() !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!req.body || !req.body.username || !req.body.password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const organization = req.user.getOrganization().getName();
    const userName = req.body.username;
    const password = req.body.password;

    let msp_path: string;
    try {
        msp_path = await enrollUser(organization, userName);

        if (!msp_path) {
            return res.status(500).json({ error: 'Failed to enroll user' });
        }
    } catch (error) {
        console.error('Error enrolling user:', error);
        return res.status(500).json({ error: 'Failed to enroll user' });
    }

    const dbManager = await DatabaseManager.getInstance();
    try {
        const userId = await dbManager.saveUser(userName, organization, msp_path, password);
        return res.status(201).json({ message: 'User created successfully', userId });
    } catch (error) {
        console.error('Error saving user:', error);
        return res.status(500).json({ error: 'Failed to save user' });
    }
});

router.patch('/', async (req: Request, res: Response) => {
    if (!req.body || !req.body.password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    if (!req.user) {
        return res.status(403).json({ error: 'Not Permitted' });
    }

    const password = req.body.password;
    const userId = req.user.getUid(); // Corrected to use getUid to retrieve the uid

    const dbManager = await DatabaseManager.getInstance();
    try {
        await dbManager.updateUserPassword(userId, password);
        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        return res.status(500).json({ error: 'Failed to update password' });
    }
});

export default router;