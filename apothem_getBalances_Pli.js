const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readlineSync = require('readline-sync');
const XDC3 = require('xdc3');

// パスワード入力を受け取る関数
function promptForPassword(prompt) {
    return readlineSync.question(prompt, { hideEchoBack: true });
}

// 復号化関数
function decrypt(encryptedText, key, iv) {
    try {
        const textParts = encryptedText.split(':');
        const ivFromText = Buffer.from(textParts.shift(), 'hex');
        const encryptedPart = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivFromText);
        let decrypted = decipher.update(encryptedPart);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        throw new Error('Decryption failed. The password may be incorrect.');
    }
}

// 現在の日時を取得する関数
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function main() {
    const password = promptForPassword('Enter password: ');
    if (!password) {
        console.log('No password entered.');
        return;
    }

    try {
        const keysPath = path.join(__dirname, 'keys.json');
        if (!fs.existsSync(keysPath)) {
            console.log('Error: keys.json file not found.');
            return;
        }
        const encryptedKeys = fs.readFileSync(keysPath, 'utf8');
        const passwordKey = crypto.scryptSync(password, 'salt', 32);
        const keys = JSON.parse(decrypt(encryptedKeys, passwordKey, Buffer.alloc(16, 0)));

        const secretKey = Buffer.from(keys.SECRET_KEY, 'hex');
        const iv = Buffer.from(keys.IV, 'hex');

        const encryptedEnvPath = path.join(__dirname, '.env.encrypted');
        if (!fs.existsSync(encryptedEnvPath)) {
            console.log('Error: .env.encrypted file not found.');
            return;
        }
        const encryptedContent = fs.readFileSync(encryptedEnvPath, 'utf8');
        const decryptedContent = decrypt(encryptedContent, secretKey, iv);

        decryptedContent.split('\n').forEach(line => {
            if (line) {
                const [key, value] = line.split('=');
                process.env[key] = value;
            }
        });

        const xdc3 = new XDC3(new XDC3.providers.HttpProvider('https://rpc.ankr.com/xdc_testnet')); // ApothemテストネットRPC

        const wallets = Object.keys(process.env)
            .filter(key => key.startsWith('PRIVATE_KEY_'))
            .map(key => {
                return {
                    name: process.env[`WALLET_NAME_${key.match(/\d+/)[0]}`],
                    privateKey: process.env[key]
                };
            });

        const tokenABI = require('./source/PliToken.json');
        const tokenAddress = '0x33f4212b027E22aF7e6BA21Fc572843C0D701CD1'; // ApothemテストネットのPLIトークンアドレス
        const tokenContract = new xdc3.eth.Contract(tokenABI, tokenAddress);

        async function getBalancesAndSave() {
            const dateTime = getCurrentDateTime();
            let csvHeader = "Wallet Name,Address,XDC Balance (testXDC),PLI Balance (testPLI)";
            let csvContent = `${csvHeader}\n`;

            console.log(csvHeader);

            for (const wallet of wallets) {
                const address = xdc3.eth.accounts.privateKeyToAccount(wallet.privateKey).address;

                const xdcBalanceWei = await xdc3.eth.getBalance(address);
                const xdcBalance = xdc3.utils.fromWei(xdcBalanceWei, 'ether');
                const pliBalance = await tokenContract.methods.balanceOf(address).call();
                const pliBalanceFormatted = xdc3.utils.fromWei(pliBalance, 'ether');

                const csvLine = `${wallet.name},${address},${xdcBalance},${pliBalanceFormatted}`;
                csvContent += `${csvLine}\n`;

                console.log(csvLine);
            }

            const fileName = `balances_${dateTime}.csv`;
            fs.writeFile(fileName, csvContent, 'utf8', (err) => {
                if (err) {
                    console.error('An error occurred while writing CSV to file.', err);
                    return;
                }

                console.log(`${fileName} has been saved.`);
            });
        }

        await getBalancesAndSave();
    } catch (error) {
        console.error(error.message);
    }
}

main().catch(console.error);
