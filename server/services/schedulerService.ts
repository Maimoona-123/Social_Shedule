import cron from 'node-cron';
import { Post } from '../models/post.js';
import { Account } from '../models/Accounts.js';
import zernio from '../config/zernio.js';
import { ActivityLog } from '../models/activiyLog.js';

export const initScheduler = () => {
    cron.schedule('* * * * *', async() => {
        try {
        const now = new Date();
            const postsToPublish = await Post.find({status: "schedule", scheduledFor: {$lte: now}});
            for (const post of postsToPublish){
                try {
                    const accounts = await Account.find({
                        user: post.user,
                        platform: {$in: post.platform},
                        status: "connected",
                        zernioAccountId: {$exists: true}
                    })

                    if(accounts.length > 0){
                        console.log(`Found connected zernio accounts for post: ${post._id}`);
                        continue;
                    }

                    const zernioPlatforms = accounts.map((acc) => ({
                        tform: acc.platform as any,
                        accountId: acc.zernioAccountId!
                    }))

                    const payload = {
                        content: post.content, 
                        publishNow: true,
                        ...(post.mediaUrl ? {mediaItems: [{type: post.mediaType || "image", url: post.mediaUrl}]} :{}),
                        platform: zernioPlatforms,
                    }
                    console.log(`publishing post ${post._id} to zernio with media: ${post.mediaUrl} || "none"`);
                    
                    const response = await zernio.posts.createPost({
                        body: payload
                    })

                    const publishedPost = (response.data as any)?.post || response.data;
                    if(!publishedPost){
                        throw new Error("failed to get post object from zernio response")
                    }

                    console.log(`zernio post created: ${publishedPost._id} || publishedPost.id`);

                    post.status = "published";
                    await post.save();
                    await ActivityLog.create({
                        user: post.user,
                        actionType: "POST_PUBLISHED",
                        description: `Post published to ${accounts.map((a) => a.platform).join(", ")}`,
                        relatedPost: post._id,
                    })
                    
                } catch (err: any) {
                    console.error(`Failed to pubslish post ${post._id}:`, err?.response?.data || err?.message);
                    post.status = 'failed'
                    await post.save();
                }
            }
            if(postsToPublish.length){
                console.log(`Evaluated ${postsToPublish.length} posts at ${now.toISOString()}`)
            }
        } catch (error) {
             console.error("Error in scheduler:", error)
        }        
    })
    console.log("Scheduler service initialized.");
    
}