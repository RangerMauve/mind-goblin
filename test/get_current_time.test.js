import { test } from "node:test";
import { strict as assert } from "node:assert";
import getCurrentTime from "../src/tools/get_current_time.js";

test("get_current_time returns a time string", () => {
  const result = getCurrentTime();
  assert.ok(result.timeAndDate);
  assert.ok(typeof result.timeAndDate === "string");
});

test("get_current_time returns time in HH:MM:SS format", () => {
  const result = getCurrentTime();
  const timePattern = /^\d{2}:\d{2}:\d{2}/;
  assert.ok(
    timePattern.test(result.timeAndDate),
    "Time should match HH:MM:SS format",
  );
});

test("get_current_time returns date in YYYY/MM/DD format", () => {
  const result = getCurrentTime();
  const datePattern = /\d{4}\/\d{2}\/\d{2}$/;
  assert.ok(
    datePattern.test(result.timeAndDate),
    "Date should match YYYY/MM/DD format",
  );
});

test("get_current_time returns time and date in correct order", () => {
  const result = getCurrentTime();
  const timeAndDatePattern = /^\d{2}:\d{2}:\d{2} \d{4}\/\d{2}\/\d{2}$/;
  assert.ok(
    timeAndDatePattern.test(result.timeAndDate),
    "Format should be HH:MM:SS YYYY/MM/DD",
  );
});

test("get_current_time returns valid time values (0-23 for hours)", () => {
  const result = getCurrentTime();
  const timePart = result.timeAndDate.split(" ")[0];
  const hours = parseInt(timePart.split(":")[0], 10);
  assert.ok(hours >= 0 && hours <= 23, "Hours should be between 0 and 23");
});

test("get_current_time returns valid minute values (0-59)", () => {
  const result = getCurrentTime();
  const timePart = result.timeAndDate.split(" ")[0];
  const minutes = parseInt(timePart.split(":")[1], 10);
  assert.ok(
    minutes >= 0 && minutes <= 59,
    "Minutes should be between 0 and 59",
  );
});

test("get_current_time returns valid second values (0-59)", () => {
  const result = getCurrentTime();
  const timePart = result.timeAndDate.split(" ")[0];
  const seconds = parseInt(timePart.split(":")[2], 10);
  assert.ok(
    seconds >= 0 && seconds <= 59,
    "Seconds should be between 0 and 59",
  );
});

test("get_current_time returns valid month values (1-12)", () => {
  const result = getCurrentTime();
  const datePart = result.timeAndDate.split(" ")[1];
  const month = parseInt(datePart.split("/")[1], 10);
  assert.ok(month >= 1 && month <= 12, "Month should be between 1 and 12");
});

test("get_current_time returns valid day values (1-31)", () => {
  const result = getCurrentTime();
  const datePart = result.timeAndDate.split(" ")[1];
  const day = parseInt(datePart.split("/")[2], 10);
  assert.ok(day >= 1 && day <= 31, "Day should be between 1 and 31");
});
