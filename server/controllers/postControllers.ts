import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware.js";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { cloudinary } from "../config/cloudinary.js";
import { Generation } from "../models/Generation.js";
import { Post } from "../models/post.js";


// Helper to poll leonardo.ai
const pollLeonardo = async (generationId: string, apiKey: string): Promise<string> => {
    const maxRetries = 20;
    const delay = 5000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await axios.get(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
                {
                    headers: {
                        accept: "application/json", authorization: `Bearer ${apiKey}`
                    }
                })

            const generation = response.data.generations_by_pk;
            if (generation.status === "COMPLETE") {
                if (generation.generated_images && generation.generated_images.length > 0) {
                    return generation.generated_image[0].url;
                }

                throw new Error("Generation complete but no image found..");
            }

        } catch (err: any) {
            console.error("polling error..:", err?.response?.data || err.message)
        }

        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error("Leonardo.ai generation timed out..")
}

// Generate Post
// Post /api/posts/generate
export const generatePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        console.log("In post..");
        
        const { prompt, tone, generateImage } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(400).json({ message: "Gemini API key is missing.. please add it to ur server /.env file." });
            return;
        }

        // Generate text
        const ai = new GoogleGenAI({ apiKey });
        const textResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: `Generate a social media post based on this prompt: "${prompt}".
            Tone: ${tone}.
            Include relevant hashtags.
            Format the response as json with "content" and "imagePrompt" fields.
            The "imagePrompt" should be a highly descriptive prompt for an image generator that complements the post.`,
        });

        let content = "";
        let imagePrompt = prompt;

        try {
            const rawText = textResponse.text || "";
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: rawText, imagePrompt: prompt };

            content = data.content;
            imagePrompt = data.imagePrompt;
        } catch (e) {
            content = textResponse.text || "";
        }

        let mediaUrl = "";
        if (generateImage) {
            try {
                const leonardyKey = process.env.LEONARDO_API_KEY;
                if (leonardyKey) {

                    // Use Leornady.ai for image generation

                    const leoResponse = await axios.post(
                        "https://cloud.leonardo.ai/api/rest/v2/generations",
                        {
                            "public": false,
                            "model": "gpt-image-2",
                            "parameters": {
                                "quality": "MEDIUM",
                                "prompt": imagePrompt,
                                "quantity": 1,
                                "width": 1024,
                                "height": 1024,
                                "promptEnhance": "OFF"
                            }
                        }, {
                        headers: {
                            accpet: "application/json",
                            authorization: `Bearer ${leonardyKey}`,
                            "content-type": "application/json"
                        }
                    }
                    )
                    const generationId = leoResponse.data.get.generationId;
                    const tempUrl = await pollLeonardo(generationId, leonardyKey)

                    // upload to Cloudinary for persistence
                    const uploadResult = await cloudinary.uploader.upload(tempUrl, {
                        folder: "ai-generations"
                    });
                    mediaUrl = uploadResult.secure_url;

                }
            } catch (err: any) {
                console.error("Image generation failed:", err)
            }
        }

        // Save generation to DB
        const generation = await Generation.create({
            user: req.user._id,
            prompt,
            content,
            mediaUrl,
            mediaType: mediaUrl ? "image" : undefined,
            tone
        })
        res.json(generation)

    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server Error" })
    }
}


// Get Generation
// get /api/posts/generation

export const getGenerations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {

        const generations = await Generation.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(generations);

    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server Error" })
    }
}



// Get posts
// Get /api/posts

export const getPosts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {

        const posts = await Post.find({ user: req.user._id });
        res.json(posts);

    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server Error" })

    }
}



// Schedule Post
// post /api/posts

export const schedulePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, platforms, scheduledFor, status } = req.body;
        console.log("in schedule post")

        // parse platforms if it comes as a stringified array from data
        let parsedPlatforms = platforms;
        console.log(typeof platforms,'type')
        if (typeof platforms === "string") {
            try {
                parsedPlatforms = JSON.parse(platforms);
                console.log(parsedPlatforms,'my plaftorms')
            } catch (e) {
                console.log(e,'my error')
                parsedPlatforms = platforms.split(",");
            }
        }

        let mediaUrl: string | undefined = req.body.mediaUrl;
        let mediaType: "image" | "video" | undefined = req.body.mediaType;

        if (req.file) {
            const result = await new Promise<any>((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ resource_type: "auto", folder: "social-scheduler" }, (error, result) => {
                    console.log(error,'my error')
                    if (error) reject(error);
                    else resolve(result);
                });

                stream.end(req.file!.buffer);
            });
            console.log(result,'my rsult')
            mediaUrl = result.secure_url;
            mediaType = result.resource_type === "video" ? "video" : "image";
        }
        const post = await Post.create({
            user: req.user._id,
            content,
            platform: parsedPlatforms,
            mediaUrl,
            mediaType,
            scheduledFor,
            status
        });

        res.status(201).json(post);

    } catch (error: any) {
        console.error("SCHEDULE POST ERROR:");
        console.error(error);

        res.status(500).json({
            message: error?.message || "Server Error"
        });
    }
}