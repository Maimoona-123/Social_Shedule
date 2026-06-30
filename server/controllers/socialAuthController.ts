import { Request, Response } from 'express'
import zernio from '../config/zernio.js';
import { User } from '../models/User.js';
import { Account } from '../models/Accounts.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';

// Helper to ensure user has a zernio profile

const getOrCreateZernioProfile = async (user: any): Promise<string> => {
    try {
        const result = await zernio.profiles.listProfiles()
        const data = result.data as any;
        const profiles: any[] = Array.isArray(data) ? data : data?.profiles || data?.data || [];

        if (profiles.length > 0) {
            const pid = profiles[0]._id || profiles[0].id
            await User.findByIdAndUpdate(user._id, { zernioProfileId: pid });
            return pid;
        }

        const createResult = await zernio.profiles.createProfile({
            body: { name: `${user.name || user.email}'s workspace` } as any,
        })

        const created = (createResult.data as any)?.profile || createResult.data;
        const pid = created?._id || created?.id;

        if (!pid) {
            throw new Error("Failed to create Zernio profile _ no ID returned")
        }

        await User.findByIdAndUpdate(user._id, { zernioProfileId: pid });
        return pid;

    } catch (error: any) {
        console.error("getOrCreateZernioProfile Error:", error?.message || error);
        throw error;
    }
}

// Generate Auth authorization URL
// Get API/auth/:platform

export const generateAuthUrl = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { platform } = req.params;
        const profileId = await getOrCreateZernioProfile(req.user);

        const origin = req.headers.origin;
        const redirectUrl = `${origin}/accounts`;

        const result = await zernio.connect.getConnectUrl({
            path: { platform: platform as any },
            query: {
                profileId,
                redirect_url: redirectUrl
            }
        })

        const data = result.data as any
        console.log("getConnectUrl response:", JSON.stringify(data, null, 2));
        const authUrl = data.authUrl;
        if (!authUrl) {
            throw new Error(`Zernio returned no authUrl. Full response: ${JSON.stringify(data)}`)
        }

        res.json({url: authUrl})

    } catch (error: any) {
        res.status(500).json({message: error?.message || "Server Error"})
    }
}


// Sync connected accounts from Zernio into MongoDB
// Get /api/auth/sync

export const syncAccounts = async(req: AuthRequest, res: Response) : Promise<void>=> {
    try {
        const profileId = await getOrCreateZernioProfile(req.user);
        const result = await zernio.accounts.listAccounts({
            query:{profileId} as any
        })

        const data = result.data as any;
        const zernioAccounts: any[] = data?.account || (Array.isArray(data) ? data:[]);
        const supportedPlatforms = ["twitter", "linkedIn", "facebook", "instagram"]
        const syncedAccounts = [];

        for (const zAccounts of zernioAccounts){
            const zid = zAccounts._id || zAccounts.id;
            if(!zid){
                console.warn("Skipping account with no ID:", zAccounts);
                continue;
            }

            const rawPlatform = (zAccounts.platform || zAccounts.type || "").toLowerCase();
            const normalizedPlatform = supportedPlatforms.find((p) => rawPlatform.includes(p));

            if(normalizedPlatform){
                console.log(`Skipping unsupported platform: "${rawPlatform}"`)
                continue;
            }

            const account = await Account.findOneAndUpdate(
                {zernioAccountId: zid},
                {
                    user: req.user._id,
                    platform: normalizedPlatform,
                    handle: zAccounts.username || zAccounts.name || zAccounts.handle || "Unknown",
                    zernioAccountId: zid,
                    status: "connected",
                    avatarUrl: zAccounts.avatarUrl || zAccounts.picture || zAccounts.profile_image_url,
                },

                {upsert: true, returnDocument: 'after'}
            )

            syncedAccounts.push(account)
        }

        res.json(syncedAccounts)

    } catch (error: any) {
        res.status(500).json({message: error?.message || "Server error"})
    }
}