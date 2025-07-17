import express, { Request, Response } from 'express';
import enrollUser from '../utils/enrollUser';
import DatabaseManager from '../db/db';

const router = express.Router();

router.post('/', async (req: Request, res: Response) => {
    if (!req.user || req.user.getRole() !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const organization = req.user.getOrganization().getName();
    const userName = req.body.username;

    if (!userName) {
        return res.status(400).json({ error: 'Username is required' });
    }

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
        const userId = await dbManager.saveUser(userName, organization, msp_path);
        return res.status(201).json({ message: 'User created successfully', userId });
    } catch (error) {
        console.error('Error saving user:', error);
        return res.status(500).json({ error: 'Failed to save user' });
    }
});

export default router;