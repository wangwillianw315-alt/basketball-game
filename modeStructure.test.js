const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");

const bundledNodeModules = "C:\\Users\\Siwaige\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
Module.globalPaths.push(path.join(bundledNodeModules, ".pnpm", "node_modules"));

const { chromium } = require("playwright");

const rootDir = __dirname;
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const filePath = path.join(rootDir, url.pathname === "/" ? "index.html" : url.pathname);

    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(fs.readFileSync(filePath));
  });
}

async function withPage(viewport, callback) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: edgePath });

  try {
    const page = await browser.newPage({ viewport, isMobile: true, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await callback(page);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function assertHomeHasThreeModes() {
  await withPage({ width: 430, height: 860 }, async (page) => {
    const modes = await page.$$eval(".mode-card strong", (nodes) => nodes.map((node) => node.textContent.trim()));

    assert.deepEqual(modes, ["投球练习", "定点投球", "移动上篮"]);
    assert.equal(await page.locator("#layupModeButton").count(), 1);
  });
}

async function assertPracticeHoopMoves() {
  await withPage({ width: 390, height: 844 }, async (page) => {
    await page.locator("#classicModeButton").click();
    await page.waitForTimeout(120);

    const first = await page.locator("#hoop").boundingBox();
    const movingClass = await page.locator("#court").evaluate((el) => el.classList.contains("moving-hoop"));
    await page.waitForTimeout(900);
    const second = await page.locator("#hoop").boundingBox();
    const introText = await page.locator("#classicLevelIntro").textContent();

    assert.equal(movingClass, true);
    assert.match(introText.replace(/\s+/g, ""), /第一章投球练习/);
    assert.ok(Math.abs(second.x - first.x) > 6, "practice hoop should move left and right");
  });
}

async function assertSetShotUsesDistanceTraining() {
  await withPage({ width: 740, height: 360 }, async (page) => {
    await page.locator("#setShotModeButton").click();
    await page.waitForTimeout(250);

    const state = await page.evaluate(() => ({
      mode: document.querySelector("#slingGame").dataset.mode,
      level: document.querySelector("#slingLevelBadge").textContent.trim(),
      movingHoop: document.querySelector("#slingCourt").classList.contains("moving-hoop"),
      layupClass: document.querySelector("#slingCourt").classList.contains("layup-mode"),
      layupControlsVisible: getComputedStyle(document.querySelector("#layupControls")).display !== "none",
      distance: document.querySelector("#slingCourt").dataset.distance,
      feedback: document.querySelector("#slingFeedback").textContent.trim()
    }));

    assert.equal(state.mode, "set-shot");
    assert.equal(state.level, "定点投球");
    assert.equal(state.movingHoop, false);
    assert.equal(state.layupClass, false);
    assert.equal(state.layupControlsVisible, false);
    assert.equal(state.distance, "中距离");
    assert.match(state.feedback, /中距离|拉住篮球/);
  });
}

async function assertLayupModeUsesJoystickAndCenteredHoop() {
  await withPage({ width: 740, height: 360 }, async (page) => {
    await page.locator("#layupModeButton").click();
    await page.waitForTimeout(250);

    const before = await page.locator("#slingPlayer").boundingBox();
    const ballBefore = await page.locator("#slingBall").boundingBox();
    const joystick = page.locator("#layupJoystick");
    assert.equal(await joystick.count(), 1);
    const joystickBox = await joystick.boundingBox();

    await page.mouse.move(joystickBox.x + joystickBox.width / 2, joystickBox.y + joystickBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(joystickBox.x + joystickBox.width / 2 + 34, joystickBox.y + joystickBox.height / 2 - 34, { steps: 4 });
    await page.waitForTimeout(350);
    await page.mouse.up();

    const after = await page.locator("#slingPlayer").boundingBox();
    const ballAfter = await page.locator("#slingBall").boundingBox();
    const state = await page.evaluate(() => ({
      mode: document.querySelector("#slingGame").dataset.mode,
      level: document.querySelector("#slingLevelBadge").textContent.trim(),
      layupClass: document.querySelector("#slingCourt").classList.contains("layup-mode"),
      movingHoop: document.querySelector("#slingCourt").classList.contains("moving-hoop"),
      joystickVisible: getComputedStyle(document.querySelector("#layupControls")).display !== "none",
      ballAnimation: getComputedStyle(document.querySelector("#slingBall")).animationName,
      court: document.querySelector("#slingCourt").getBoundingClientRect().toJSON(),
      hoop: document.querySelector("#slingHoop").getBoundingClientRect().toJSON(),
      board: document.querySelector(".sling-board").getBoundingClientRect().toJSON(),
      rim: document.querySelector("#slingRimLine").getBoundingClientRect().toJSON()
    }));
    const courtCenterX = state.court.left + state.court.width / 2;
    const hoopCenterX = state.hoop.left + state.hoop.width / 2;
    const boardCenterX = state.board.left + state.board.width / 2;
    const rimCenterX = state.rim.left + state.rim.width / 2;

    assert.equal(state.mode, "layup");
    assert.equal(state.level, "移动上篮");
    assert.equal(state.layupClass, true);
    assert.equal(state.movingHoop, false);
    assert.equal(state.joystickVisible, true);
    assert.ok(after.x > before.x + 8, "right control should move the player");
    assert.ok(Math.abs(after.y - before.y) < 3, "layup player should only move left and right");
    assert.ok(Math.abs(ballAfter.y - ballBefore.y) < 3, "held ball should not bob vertically while moving");
    assert.equal(state.ballAnimation, "none");
    assert.ok(Math.abs(hoopCenterX - courtCenterX) < 24, "layup hoop should sit near the court center");
    assert.ok(state.hoop.top - state.court.top < 62, "layup hoop should sit high on the court");
    assert.ok(Math.abs(boardCenterX - rimCenterX) < 10, "layup rim should face the player from the center of the board");
  });
}

async function assertSlingArcStartsAtVisibleBall() {
  async function dragBallAndMeasure(page) {
    const ball = await page.locator("#slingBall").boundingBox();
    await page.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2);
    await page.mouse.down();
    await page.mouse.move(ball.x + ball.width / 2 - 110, ball.y + ball.height / 2 - 80, { steps: 4 });
    await page.waitForTimeout(100);

    const measurement = await page.evaluate(() => {
      const ballRect = document.querySelector("#slingBall").getBoundingClientRect();
      const courtRect = document.querySelector("#slingCourt").getBoundingClientRect();
      const svg = document.querySelector("#slingArcPath").ownerSVGElement;
      const point = svg.createSVGPoint();
      point.x = 0;
      point.y = 0;
      const screenPoint = point.matrixTransform(svg.getScreenCTM());
      const ballCenter = {
        x: ballRect.left + ballRect.width / 2,
        y: ballRect.top + ballRect.height / 2
      };

      return {
        dx: Math.abs(screenPoint.x - ballCenter.x),
        dy: Math.abs(screenPoint.y - ballCenter.y),
        ballLeftGap: ballRect.left - courtRect.left,
        dotCount: document.querySelectorAll("#slingArc span").length,
        pathCount: document.querySelectorAll("#slingArc path").length,
        pathLength: document.querySelector("#slingArcPath").getTotalLength()
      };
    });

    await page.mouse.up();
    return measurement;
  }

  await withPage({ width: 740, height: 360 }, async (page) => {
    await page.locator("#setShotModeButton").click();
    await page.waitForTimeout(250);
    const setShot = await dragBallAndMeasure(page);

    assert.ok(setShot.dx < 8, `set-shot arc should start at ball center x, got ${setShot.dx}`);
    assert.ok(setShot.dy < 8, `set-shot arc should start at ball center y, got ${setShot.dy}`);
    assert.ok(setShot.ballLeftGap >= 0, `set-shot ball should stay inside the court, got ${setShot.ballLeftGap}`);
    assert.equal(setShot.pathCount, 1);
    assert.equal(setShot.dotCount, 0);
    assert.ok(setShot.pathLength > 160, "set-shot should keep one visible trajectory line");
  });

  await withPage({ width: 740, height: 360 }, async (page) => {
    await page.locator("#layupModeButton").click();
    await page.waitForTimeout(250);
    const joystick = await page.locator("#layupJoystick").boundingBox();
    await page.mouse.move(joystick.x + joystick.width / 2, joystick.y + joystick.height / 2);
    await page.mouse.down();
    await page.mouse.move(joystick.x + joystick.width / 2 + 34, joystick.y + joystick.height / 2 - 34, { steps: 4 });
    await page.waitForTimeout(220);
    await page.mouse.up();

    const layup = await dragBallAndMeasure(page);

    assert.ok(layup.dx < 8, `layup arc should start at ball center x, got ${layup.dx}`);
    assert.ok(layup.dy < 8, `layup arc should start at ball center y, got ${layup.dy}`);
    assert.ok(layup.ballLeftGap >= 0, `layup ball should stay inside the court, got ${layup.ballLeftGap}`);
    assert.equal(layup.pathCount, 1);
    assert.equal(layup.dotCount, 0);
    assert.ok(layup.pathLength > 160, "layup should keep one visible trajectory line");
  });
}

(async () => {
  await assertHomeHasThreeModes();
  await assertPracticeHoopMoves();
  await assertSetShotUsesDistanceTraining();
  await assertLayupModeUsesJoystickAndCenteredHoop();
  await assertSlingArcStartsAtVisibleBall();
  console.log("mode structure checks passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
