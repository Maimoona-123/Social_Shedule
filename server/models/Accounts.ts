import mongoose from 'mongoose'; 

const accountSchema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    
    platform: {type: String, enum: ["Twitter", "LinkedIn", "facebook", "instagram", "facebook_page",
        "linkedin_page", "instagram_buisness"], required: true},
    handle: {type: String, required: true},
    zernioAccountId: {type: String},
    accessToken: {type: String},
    refreshToken: {type: String},
    tokenExpiresAt: {type: Date},
    status: {type: String, enum: ["connected", "disconnect"], default: "connected"},
    avatatUrl: {type: String}

}, {timestamps: true});

export const Account = mongoose.model("Account", accountSchema)