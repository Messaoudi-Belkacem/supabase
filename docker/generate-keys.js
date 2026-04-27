const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function gen_hex(len) {
    return crypto.randomBytes(len).toString('hex');
}

function gen_base64(len) {
    return crypto.randomBytes(len).toString('base64');
}

function base64_url_encode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function gen_token(payload, secret) {
    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const header_base64 = base64_url_encode(header);
    const payload_base64 = base64_url_encode(JSON.stringify(payload));
    const signed_content = `${header_base64}.${payload_base64}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signed_content)
        .digest();
    const signature_base64 = signature
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    return `${signed_content}.${signature_base64}`;
}

const jwt_secret = gen_base64(32);
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 5 * 365 * 24 * 3600;

const anon_payload = { role: 'anon', iss: 'supabase', iat, exp };
const service_role_payload = { role: 'service_role', iss: 'supabase', iat, exp };

const anon_key = gen_token(anon_payload, jwt_secret);
const service_role_key = gen_token(service_role_payload, jwt_secret);

const secrets = {
    JWT_SECRET: jwt_secret,
    ANON_KEY: anon_key,
    SERVICE_ROLE_KEY: service_role_key,
    SECRET_KEY_BASE: gen_base64(48),
    VAULT_ENC_KEY: gen_hex(16),
    PG_META_CRYPTO_KEY: gen_base64(24),
    LOGFLARE_PUBLIC_ACCESS_TOKEN: gen_base64(24),
    LOGFLARE_PRIVATE_ACCESS_TOKEN: gen_base64(24),
    S3_PROTOCOL_ACCESS_KEY_ID: gen_hex(16),
    S3_PROTOCOL_ACCESS_KEY_SECRET: gen_hex(32),
    MINIO_ROOT_PASSWORD: gen_hex(16),
    POSTGRES_PASSWORD: gen_hex(16),
    DASHBOARD_PASSWORD: gen_hex(16)
};

console.log('Generated Secrets:');
for (const [key, value] of Object.entries(secrets)) {
    console.log(`${key}=${value}`);
}

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    for (const [key, value] of Object.entries(secrets)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        envContent = envContent.replace(regex, `${key}=${value}`);
    }
    fs.writeFileSync(envPath, envContent);
    console.log('\nUpdated .env file successfully.');
} else {
    console.error('\n.env file not found.');
}
