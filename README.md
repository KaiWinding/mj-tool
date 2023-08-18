# mj-tool

## Begin

1. npm install -g pm2
2. npm install
3. 在 config 目录下创建一个 account.json 的文件写上用户信息
4. 在 input 的 txt 文件里编辑 prompts
5. npm run start 启动项目

## 项目控制

该脚本用 PM2 管理，`npm run start` 可以启动项目。使用 `pm2 list` 或 `npm run show` 查看项目运行情况。要停止脚本可以执行 `pm2 kill` 或 `npm run kill`。程序执行的部分日志代码可在，`output\logs.txt` 上查看
