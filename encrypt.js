const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readlineSync = require('readline-sync');

// 暗号化の設定
const algorithm = 'aes-256-cbc';
const secretKey = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

// 暗号化関数
function encrypt(text, key, iv) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// パスワード入力を受け取る（readline-syncを使用）
function getPassword(prompt) {
    return readlineSync.question(prompt, { hideEchoBack: true });
}

// メイン処理
async function main() {
    let password = getPassword('Enter password: ');
    if (password.length === 0) {
        console.log('Password cannot be empty.');
        return;
    }

    const confirmPassword = getPassword('Confirm password: ');
    if (confirmPassword.length === 0) {
        console.log('Password confirmation cannot be empty.');
        return;
    }

    // パスワードの確認
    if (password !== confirmPassword) {
        console.log('Passwords do not match.');
        return;
    }

    // .env ファイルの暗号化
    const envFilePath = path.join(__dirname, '.env');
    if (!fs.existsSync(envFilePath)) {
        console.log('Error: .env file not found.');
        return;
    }
    const content = fs.readFileSync(envFilePath, 'utf8');
    const encrypted = encrypt(content, secretKey, iv);
    const encryptedFilePath = path.join(__dirname, '.env.encrypted');
    fs.writeFileSync(encryptedFilePath, encrypted);

    // keys.jsonの暗号化
    const keys = {
        SECRET_KEY: secretKey.toString('hex'),
        IV: iv.toString('hex')
    };
    const keysFilePath = path.join(__dirname, 'keys.json');
    const passwordKey = crypto.scryptSync(password, 'salt', 32);
    const keysIv = crypto.randomBytes(16);
    const encryptedKeys = encrypt(JSON.stringify(keys), passwordKey, keysIv);
    fs.writeFileSync(keysFilePath, encryptedKeys);

    fs.unlinkSync(envFilePath);
    console.log('Encryption complete. Encrypted keys are stored in keys.json');
}

main();
