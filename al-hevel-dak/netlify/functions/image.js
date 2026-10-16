export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { prompt, seed } = await req.json();

        // ניתן להגדיר ב-Netlify משתנה סביבה HF_API_KEYS שמכיל מספר מפתחות מופרדים בפסיק
        // למשל: hf_key1,hf_key2,hf_key3 לחלוקת עומסים של מספר בקשות בשנייה
        const rawKeys = process.env.HF_API_KEYS || process.env.HF_API_KEY || "";
        const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

        if (keys.length === 0) {
            return new Response(JSON.stringify({ error: 'No HF keys configured' }), { status: 500 });
        }

        // בחירת מפתח אקראי מתוך המאגר (Load Balancing)
        const selectedKey = keys[Math.floor(Math.random() * keys.length)];

        const response = await fetch(
            "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${selectedKey}`,
                    "Content-Type": "application/json",
                    "x-use-cache": "false"
                },
                body: JSON.stringify({
                    inputs: `${prompt} (seed: ${seed})`
                })
            }
        );

        if (!response.ok) {
            throw new Error(`HF status ${response.status}`);
        }

        // החזרת התמונה כ-Base64 ישירות לדפדפן (מונע בעיות CORS ב-Canvas)
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        return new Response(JSON.stringify({ dataUrl: `data:${mimeType};base64,${base64}` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};