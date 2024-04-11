#!/bin/bash

# .envファイルが存在するかどうかを確認し、デフォルトの秘密鍵が含まれている場合は警告を表示
if [ -f ".env" ]; then
    echo 
    echo -e "\e[31m警告: .envファイルが存在します。\e[0m"
    echo -e "\e[31m秘密鍵などの機密情報を含む場合は、メニュー1を選択してファイルを暗号化することを強く推奨します。\e[0m"
    echo 
fi

echo "実行したいスクリプトを選択してください:"
echo "1. 環境ファイル .env を暗号化する (encrypt.js)"
echo "2. PLI残高を取得する (getBalances_Pli.js)"
echo "3. SRX残高を取得する (getBalances_Srx.js)"
echo "4. PLIを1つのアドレスに送信する (sendPliToOneAddress.js)"
echo "5. SRXを1つのアドレスに送信する (sendSrxToOneAddress.js)"
echo "6. 環境ファイル .env.encrypted を復号化する (decrypt.js)"
read -p "選択 (1-6): " choice

# 実行するファイル名を選択に応じて設定
case $choice in
    1)
        file="encrypt.js"
        ;;
    2)
        file="getBalances_Pli.js"
        ;;
    3)
        file="getBalances_Srx.js"
        ;;
    4)
        file="sendPliToOneAddress.js"
        ;;
    5)
        file="sendSrxToOneAddress.js"
        ;;
    6)
        file="decrypt.js"
        ;;
    *)
        echo "無効な選択です。1-6の間で選んでください。"
        exit 1
        ;;
esac

# 選択されたオプションに基づいて処理を実行
if [[ $choice -eq 1 ]]; then
    if [ ! -f ".env" ]; then
        echo ".env ファイルが見つかりません。暗号化する前に、このファイルが存在していることを確認してください。"
    else
        echo "環境ファイルを暗号化しています..."
        node $file
        echo ".envを暗号化しました。複合化したい場合は、メニューで6を選択してください。"
    fi
elif [[ $choice -ge 2 && $choice -le 5 ]]; then
    if [ -f ".env.encrypted" ]; then
        echo "処理中..."
        node $file
    else
        echo "暗号化された環境ファイル (.env.encrypted) が見つかりません。先に暗号化スクリプト (encrypt.js) を実行してください。"
    fi
elif [ $choice -eq 6 ]; then
    if [ -f ".env.encrypted" ] && [ -f "keys.json" ]; then
        echo "環境ファイルを復号化しています..."
        node $file
        echo "復号が完了しました。.envファイルが復元されました。"
    else
        echo "必要な暗号化ファイルが見つかりません。復号化する前に、これらのファイルが存在していることを確認してください。"
    fi
fi

