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

// メイン処理関数
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

        const xdc3 = new XDC3(new XDC3.providers.HttpProvider('https://rpc.ankr.com/xdc'));

        const wallets = Object.keys(process.env)
            .filter(key => key.startsWith('PRIVATE_KEY_'))
            .map(key => {
                return {
                    name: process.env[`WALLET_NAME_${key.match(/\d+/)[0]}`],
                    privateKey: process.env[key]
                };
            });

        const tokenABI = require('./source/PliToken.json');
        const tokenAddress = process.env.PLI_TOKEN_ADDRESS;
        const tokenContract = new xdc3.eth.Contract(tokenABI, tokenAddress);

        const recipientAddress = process.env.RECIPIENT_ADDRESS;

        async function sendToken(privateKey, recipient, amount) {
            const account = xdc3.eth.accounts.privateKeyToAccount(privateKey);
            xdc3.eth.accounts.wallet.add(account);
            const fromAddress = account.address;

            console.log(`Preparing to send tokens from ${fromAddress}...`);

            const txData = tokenContract.methods.transfer(recipient, amount).encodeABI();
            const gas = await xdc3.eth.estimateGas({ from: fromAddress, to: tokenAddress, data: txData });
            const gasPrice = await xdc3.eth.getGasPrice();
            const nonce = await xdc3.eth.getTransactionCount(fromAddress, 'latest');

            const tx = {
                from: fromAddress,
                to: tokenAddress,
                data: txData,
                gas,
                gasPrice,
                nonce,
                chainId: 50
            };

            console.log(`Signing transaction for ${fromAddress}...`);

            const signedTx = await account.signTransaction(tx);

            console.log(`Sending transaction from ${fromAddress}...`);

            return xdc3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on('transactionHash', hash => console.log(`Transaction hash: ${hash}`))
                .on('receipt', receipt => console.log(`Transaction receipt: ${receipt.transactionHash}`))
                .catch(console.error);
        }

        async function checkAndSendTokens() {
            for (const wallet of wallets) {
                const address = xdc3.eth.accounts.privateKeyToAccount(wallet.privateKey).address;
                try {
                    const balance = await tokenContract.methods.balanceOf(address).call();
                    if (parseInt(balance, 10) > 0) {
                        console.log(`${wallet.name} ${address} has a balance of ${balance}. Initiating transfer...`);
                        await sendToken(wallet.privateKey, recipientAddress, balance);
                    } else {
                        console.log(`${wallet.name} ${address} has zero balance. Skipping...`);
                    }
                } catch (error) {
                    console.error(`Error processing wallet ${wallet.name} ${address}: ${error.message}`);
                }
            }
        }

        await checkAndSendTokens();
        console.log('Done sending tokens.');
    } catch (error) {
        console.error(error.message);
    }
}

main().catch(console.error);
