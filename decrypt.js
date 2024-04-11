const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readlineSync = require('readline-sync');

// 暗号化設定
const algorithm = 'aes-256-cbc';

// 復号化関数
function decrypt(encryptedText, key, iv) {
    try {
        const textParts = encryptedText.split(':');
        const ivFromText = Buffer.from(textParts.shift(), 'hex');
        const encryptedPart = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, ivFromText);
        let decrypted = decipher.update(encryptedPart);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        throw new Error('Decryption failed. The password may be incorrect.');
    }
}

// パスワード入力を受け取る（readline-syncを使用）
function getPassword(prompt) {
    return readlineSync.question(prompt, { hideEchoBack: true });
}

// メイン処理
async function main() {
    const password = getPassword('Enter password: ');

    try {
        const keysPath = path.join(__dirname, 'keys.json');
        if (!fs.existsSync(keysPath)) {
            console.log('Error: keys.json file not found.');
            return;
        }
        const encryptedKeys = fs.readFileSync(keysPath, 'utf8');
        const passwordKey = crypto.scryptSync(password, 'salt', 32);
        const keysIv = Buffer.alloc(16, 0); // 例として0で初期化されたIVを使用
        const keys = JSON.parse(decrypt(encryptedKeys, passwordKey, keysIv));

        const secretKey = Buffer.from(keys.SECRET_KEY, 'hex');
        const iv = Buffer.from(keys.IV, 'hex');

        const encryptedEnvPath = path.join(__dirname, '.env.encrypted');
        if (!fs.existsSync(encryptedEnvPath)) {
            console.log('Error: .env.encrypted file not found.');
            return;
        }
        const encryptedEnv = fs.readFileSync(encryptedEnvPath, 'utf8');
        const decryptedEnv = decrypt(encryptedEnv, secretKey, iv);

        const envFilePath = path.join(__dirname, '.env');
        fs.writeFileSync(envFilePath, decryptedEnv);

        console.log('Decryption complete. .env file has been restored.');
    } catch (error) {
        console.error(error.message);
    }
}

main();
