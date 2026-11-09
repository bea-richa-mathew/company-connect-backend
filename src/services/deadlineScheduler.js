
import {
  checkTaskDeadlines
} from "./deadlineService.js";

const CHECK_INTERVAL =
  60 * 60 * 1000;

let running = false;

export function startDeadlineScheduler() {
  async function run() {
    if (running) return;

    running = true;

    try {
      const result = await checkTaskDeadlines();

      console.log(
        "Deadline reminder check:",
        result
      );
    } catch (error) {
      console.error(
        "Deadline scheduler error:",
        error.message
      );
    } finally {
      running = false;
    }
  }

  // Initial check after server startup.
  run();

  // Repeat every hour.
  return setInterval(run, CHECK_INTERVAL);
}
