const fs = require("fs");
const { Midjourney } = require("midjourney");
const path = require("path");
const accountList = require("../config/account.json");
const cluster = require("cluster");
const {
  firstClass,
  DELIMITER,
  timeoutMs,
  inputPromptsFilename,
  outputFilename,
  maxMJJobs,
  logsFilename,
} = require("../config");

let globalPromptPool = [];
let childIndex = "";

async function asyncPool({ client, arr, success, limit, accountDesc }) {
  success = success || successCallback;
  arr = arr || globalPromptPool;
  limit = limit || 4;
  let args = [...arr]; //不修改原参数数组
  let runningCount = 0; //正在运行的数量
  let resultCount = 0; //结果的数量
  let processIndex = 0;

  return new Promise((resolve) => {
    async function run(isInit, delay) {
      log(
        `let's go ! runningCount = ${runningCount}, resultCount = ${resultCount}， processIndex = ${processIndex}`
      );
      while (runningCount < limit && args.length > 0) {
        runningCount++;
        let v = args.shift();
        if (args.length == 0) args = [...arr];
        log(
          childIndex +
            "正在运行" +
            runningCount +
            "已完结" +
            resultCount +
            "当前任务序列" +
            processIndex++
        );
        if (isInit) {
          await sleep();
        } else {
          realSleep();
        }
        const newPromise = client
          .Imagine(v.prompt, (uri) => {
            log(childIndex + "loading123---", uri);
          })
          .then(
            (val) => {
              success(val, accountDesc, v);
            },
            (err) => {
              args.push(v);
              const filePath = path.join(__dirname, "../output/error_log.txt");
              fs.appendFileSync(
                filePath,
                childIndex +
                  "正在运行" +
                  runningCount +
                  "已完结" +
                  resultCount +
                  "当前任务序列" +
                  processIndex +
                  "=============" +
                  v.prompt +
                  "=============" +
                  err +
                  "\n"
              );
            }
          );

        withTimeout(newPromise, timeoutMs).finally(() => {
          runningCount--;
          resultCount++;
          run();
          // if (resultCount === arr.length) {  //这里之所以用resultCount做判断，而不用results的长度和args的长度，是因为这两个都不准确
          //   resolve(results)
          // } else {
          //   run()
          // }
        });
      }
    }
    run(true);
  });
}

function log(message) {
  const LOG_FILE_PATH = path.join(__dirname, `../output/${logsFilename}`);
  const timestamp = new Date().toISOString();
  const formattedMessage = `${timestamp}: ${message}\n`;

  // Ensure the directory exists
  if (!fs.existsSync(path.dirname(LOG_FILE_PATH))) {
    fs.mkdirSync(path.dirname(LOG_FILE_PATH), { recursive: true });
  }

  // Append the message to the log file
  fs.appendFileSync(LOG_FILE_PATH, formattedMessage);

  // Check the number of lines and remove the first 500 lines if it exceeds 1000
  const logContent = fs.readFileSync(LOG_FILE_PATH, "utf-8");
  const lines = logContent.split("\n");

  if (lines.length > 1000) {
    const newContent = lines.slice(500).join("\n");
    fs.writeFileSync(LOG_FILE_PATH, newContent);
  }
}

function withTimeout(promise, timeoutMs = 60000 * 6) {
  let timeout;

  // 创建一个超时的 Promise
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, timeoutMs);
  });

  // 使用 Promise.race 竞争两个 Promise：原始的 Promise 和超时的 Promise
  return Promise.race([promise, timeoutPromise])
    .then((result) => {
      clearTimeout(timeout); // 清除超时
      return result;
    })
    .catch((error) => {
      clearTimeout(timeout); // 清除超时
      throw error;
    });
}

// 请求成功的回调
const successCallback = (msg, accountDesc, v) => {
  const filePath = path.join(__dirname, `../output/${outputFilename}`);
  fs.appendFileSync(
    filePath,
    msg.uri +
      "  " +
      DELIMITER +
      firstClass +
      DELIMITER +
      v.third +
      DELIMITER +
      `libraries/${v.second}/${v.third}/` +
      DELIMITER +
      v.second +
      v.chineseTag +
      DELIMITER +
      v.prompt +
      "\n"
  );
};

function realSleep(delay = 1000) {
  const beginTime = new Date().getTime();

  while (new Date().getTime() - beginTime < delay) {}
}

function sleep(delay = 3000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("");
    }, delay);
  });
}

async function main() {
  const filePath = path.join(__dirname, `../input/${inputPromptsFilename}`);
  const input = fs.readFileSync(filePath, "utf8");
  globalPromptPool = input
    .split("\n")
    .filter((el) => el.length > 10)
    .map((el) => {
      const index = el.indexOf(DELIMITER);
      const tagList = el.slice(index).split(DELIMITER);
      return {
        prompt: el.slice(0, index),
        second: tagList[1],
        third: tagList[2],
        chineseTag: tagList[3],
        desc: tagList[4],
      };
    });

  if (cluster.isMaster) {
    const childProcessPool = {};
    const createWorker = (index) => {
      const worker = cluster.fork({ accountIndex: index });

      // 存储子进程的配置
      childProcessPool[worker.id] = index;
    };

    for (let i = 0; i < accountList.length; i++) {
      createWorker(i);
    }

    cluster.on("exit", (worker, code, signal) => {
      log(`Worker ${worker.process.pid} died`);

      createWorker(childProcessPool[worker.id]);
      delete childProcessPool[worker.id];
    });
  } else {
    const i = process.env.accountIndex;
    childIndex = `This child index is ${i} ||`;
    log("childProcessPool = ", accountList[i]);
    const client = new Midjourney({
      ServerId: accountList[i].SERVER_ID,
      ChannelId: accountList[i].CHANNEL_ID,
      SalaiToken: accountList[i].Discord_TOKEN,
      Debug: true,
    });
    await client.Connect();
    asyncPool({
      client,
      limit:
        accountList[i].maxNum > maxMJJobs ? maxMJJobs : accountList[i].maxNum,
      accountDesc: accountList[i].desc,
    });
  }

  // await client.Connect();

  // client
  //   .Imagine(
  //     "asian princess in wes anderson style, dressed in local uniform in Azure Lagoon, epic shot , --ar 16:9 --no glasses --stylize 400 --q .5 --v 5.2",
  //     (uri) => {
  //       console.log("loading123---", uri);
  //     }
  //   )
  //   .then(function (msg) {
  //     console.log("msg123", msg);
  //   });
}
main()
  .then(() => {
    log("finished");
    // process.exit(0);
  })
  .catch((err) => {
    log("error finished");
    console.error(err);
    process.exit(1);
  });
