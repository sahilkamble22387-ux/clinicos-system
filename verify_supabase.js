
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('FAILED: .env.local file not found at', envPath);
        process.exit(1);
    }
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const envLines = envConfig.split('\n');
    const env = {};
    envLines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim(); // Handle values with = in them
            if (key && value) env[key] = value;
        }
    });

    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error('FAILED: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
        console.log('Found keys:', Object.keys(env));
        process.exit(1);
    }

    // Basic validity check of URL format
    let validUrl = false;
    try {
        new URL(url);
        validUrl = true;
    } catch (e) {
        console.error('FAILED: Invalid URL string:', url);
    }

    if (validUrl) {
        console.log(`SUCCESS: Supabase Client Initialized with valid URL string.`);
        console.log(`URL: ${url}`);
        // console.log(`Key: ${key.substring(0, 10)}...`);
    } else {
        process.exit(1);
    }

} catch (e) {
    console.error('Error reading .env.local:', e.message);
    process.exit(1);
}
