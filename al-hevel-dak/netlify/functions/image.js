export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { prompt, seed } = await req.json();

        // 1. ניסיון ראשון: שימוש ב-GEMINI_API_KEY שכבר קיים אצלך ב-Netlify!
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
            const geminiImageModels = [
                "gemini-2.0-flash-exp-image-generation",
                "gemini-3.1-flash-lite-image",
                "gemini-3.1-flash-image"
            ];

            for (const modelName of geminiImageModels) {
                try {
                    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
                    const gRes = await fetch(gUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: `${prompt} (seed ${seed})` }] }],
                            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
                        })
                    });

                    if (gRes.ok) {
                        const gData = await gRes.json();
                        const imgPart = gData?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                        if (imgPart?.inlineData?.data) {
                            const mime = imgPart.inlineData.mimeType || 'image/png';
                            return new Response(
                                JSON.stringify({ dataUrl: `data:${mime};base64,${imgPart.inlineData.data}` }),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }
                            );
                        }
                    }
                } catch (e) {
                    // ממשיך למודל הבא
                }
            }
        }

        // 2. ניסיון שני: Hugging Face FLUX.1-schnell (כ-1.5 שניות לתמונה אם הוגדר HF_API_KEYS)
        const rawHfKeys = process.env.HF_API_KEYS || process.env.HF_API_KEY || "";
        const hfKeys = rawHfKeys.split(',').map(k => k.trim()).filter(Boolean);

        if (hfKeys.length > 0) {
            const selectedKey = hfKeys[Math.floor(Math.random() * hfKeys.length)];
            try {
                const hfRes = await fetch(
                    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${selectedKey}`,
                            "Content-Type": "application/json",
                            "x-use-cache": "false"
                        },
                        body: JSON.stringify({ inputs: `${prompt} (seed: ${seed})` })
                    }
                );

                if (hfRes.ok) {
                    const arrayBuffer = await hfRes.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    const mimeType = hfRes.headers.get('content-type') || 'image/jpeg';
                    return new Response(
                        JSON.stringify({ dataUrl: `data:${mimeType};base64,${base64}` }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            } catch (e) {}
        }

        // 3. ניסיון שלישי: שליפה מהירה מצד השרת במודל Turbo (עוקף חסימת IP של המשתמש)
        const encoded = encodeURIComponent(prompt);
        const fastServerUrl = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&seed=${seed}&nologo=true&enhance=false&model=turbo`;
        const fastRes = await fetch(fastServerUrl);

        if (fastRes.ok) {
            const arrayBuffer = await fastRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = fastRes.headers.get('content-type') || 'image/jpeg';
            return new Response(
                JSON.stringify({ dataUrl: `data:${mimeType};base64,${base64}` }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(JSON.stringify({ error: 'All server engines busy' }), { status: 502 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
