const fs = require("fs");
const { Midjourney } = require("midjourney");
const path = require("path");
const accountList = require("../config/account.json");
let globalPromptPool = [];

const firstClass = "肖像";
const DELIMITER = "|--|";

async function asyncPool({ client, arr, success, limit, accountDesc }) {
  success = success || successCallback;
  arr = arr || globalPromptPool;
  limit = limit || 10;
  let args = [...arr]; //不修改原参数数组
  let runningCount = 0; //正在运行的数量
  let resultCount = 0; //结果的数量

  return new Promise((resolve) => {
    async function run() {
      while (runningCount < limit && args.length > 0) {
        runningCount++;
        let v = args.shift();
        if (args.length == 0) args = [...arr];
        console.log("正在运行" + runningCount + "已完结" + resultCount);
        console.log("v = ", v);

        sleep();
        client
          .Imagine(v.prompt, (uri) => {
            console.log("loading123---", uri);
          })
          .then(
            (val) => {
              success(val, accountDesc, v);
            },
            (err) => {
              console.log(`An error occurred: ${v.prompt}`);
              args.push(v);
              const filePath = path.join(__dirname, "../output/error_log.txt");
              fs.appendFileSync(
                filePath,
                resultCount + "=============" + v + "=============" + err + "\n"
              );
            }
          )
          .finally(() => {
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
    run();
  });
}

const successCallback = (msg, accountDesc, v) => {
  const filePath = path.join(__dirname, "../output/output.txt");
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

function sleep(delay = 2000) {
  const beginTime = new Date().getTime();

  while (new Date().getTime() - beginTime < delay) {}
}

// function sleep(delay = 4000) {
//   return new Promise((resolve) => {
//     console.log("wait delay", delay);
//     setTimeout(() => {
//       resolve("");
//     }, delay);
//   });
// }

async function main() {
  const filePath = path.join(__dirname, "../input/prompts_female.txt");
  const input = fs.readFileSync(filePath, "utf8");
  globalPromptPool = input
    .split("\n")
    .filter((el) => el.length > 10)
    .map((el) => {
      const index = el.indexOf("|--|");
      const tagList = el.slice(index).split("|--|");
      return {
        prompt: el.slice(0, index),
        second: tagList[1],
        third: tagList[2],
        chineseTag: tagList[3],
        desc: tagList[4],
      };
    });

  for (let i = 0; i < accountList.length; i++) {
    const client = new Midjourney({
      ServerId: accountList[i].SERVER_ID,
      ChannelId: accountList[i].CHANNEL_ID,
      SalaiToken: accountList[i].Discord_TOKEN,
      Debug: true,
    });
    await client.Connect();
    console.log("accountList[i] = ", accountList[i]);
    asyncPool({
      client,
      limit: accountList[i].maxNum,
      accountDesc: accountList[i].desc,
    });
  }

  // await client.Connect();

  // const fn = client;

  // for (let i = 0; i < 2; i++) {
  //   client
  //     .Imagine("asian princess in wes anderson style, dressed in local uniform in Azure Lagoon, epic shot , --ar 16:9 --no glasses --stylize 400 --q .5 --v 5.2", (uri) => {
  //       console.log("loading123---", uri);
  //     })
  //     .then(function (msg) {
  //       console.log("msg123", msg);
  //     });
  // }
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
  // asyncPool(client, prompt, cb);
}
main()
  .then(() => {
    console.log("finished");
    // process.exit(0);
  })
  .catch((err) => {
    console.log("error finished");
    console.error(err);
    process.exit(1);
  });
