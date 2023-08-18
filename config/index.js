const firstClass = "肖像";
const DELIMITER = "|--|";
const timeoutMs = 60000 * 6; // 单个任务超时时间
const inputPromptsFilename = "prompts_female.txt";
const outputFilename = "output.txt";
const maxMJJobs = 4;
const logsFilename = "logs.txt";

module.exports = {
  firstClass,
  DELIMITER,
  timeoutMs,
  inputPromptsFilename,
  outputFilename,
  maxMJJobs,
  logsFilename,
};
