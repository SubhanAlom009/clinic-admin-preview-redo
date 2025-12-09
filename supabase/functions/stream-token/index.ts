// Supabase Edge Function: Generate Stream Video Token
// This function generates a token for Stream.io video calls

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Stream SDK doesn't have a native Deno import, so we use the REST API directly
// to generate tokens using HMAC signature

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { userId, userName } = await req.json();

        if (!userId) {
            return new Response(
                JSON.stringify({ error: "userId is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const apiKey = Deno.env.get("STREAM_API_KEY");
        const apiSecret = Deno.env.get("STREAM_API_SECRET");

        if (!apiKey || !apiSecret) {
            console.error("Missing Stream API credentials");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Generate JWT token for Stream Video
        const header = { alg: "HS256", typ: "JWT" };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            user_id: userId,
            iat: now,
            exp: now + 3600, // Token expires in 1 hour
        };

        // Base64url encode
        const base64url = (str: string) =>
            btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        const encodedHeader = base64url(JSON.stringify(header));
        const encodedPayload = base64url(JSON.stringify(payload));

        // Sign the token using Web Crypto API
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(apiSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signature = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(`${encodedHeader}.${encodedPayload}`)
        );

        const base64Signature = base64url(
            String.fromCharCode(...new Uint8Array(signature))
        );

        const token = `${encodedHeader}.${encodedPayload}.${base64Signature}`;

        return new Response(
            JSON.stringify({
                token,
                userId,
                apiKey,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Token generation error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to generate token" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
