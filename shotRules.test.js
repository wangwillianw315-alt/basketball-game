const test = require("node:test");
const assert = require("node:assert/strict");
const { judgeShot, judgeSlingShot, normalizeDrag, normalizeSlingDrag, coachSlingAim } = require("./shotRules");

test("normalizeDrag clamps direction and power", () => {
  assert.deepEqual(normalizeDrag({ dragX: 200, dragY: 260 }), {
    direction: 95,
    power: 1
  });

  assert.deepEqual(normalizeDrag({ dragX: -200, dragY: -40 }), {
    direction: -95,
    power: 0
  });
});

test("judgeShot makes centered shots with useful power", () => {
  const result = judgeShot({ dragX: 12, dragY: 95, randomOffset: 0 });

  assert.equal(result.made, true);
  assert.equal(result.reason, "made");
});

test("judgeShot misses when power is too low", () => {
  const result = judgeShot({ dragX: 0, dragY: 30, randomOffset: 0 });

  assert.equal(result.made, false);
  assert.equal(result.reason, "short");
});

test("judgeShot misses when direction is too far right", () => {
  const result = judgeShot({ dragX: 80, dragY: 95, randomOffset: 0 });

  assert.equal(result.made, false);
  assert.equal(result.reason, "right");
});

test("judgeShot explains right-side misses", () => {
  const result = judgeShot({ dragX: 80, dragY: 95, randomOffset: 0 });

  assert.equal(result.made, false);
  assert.equal(result.reason, "right");
});

test("judgeShot explains left-side misses", () => {
  const result = judgeShot({ dragX: -80, dragY: 95, randomOffset: 0 });

  assert.equal(result.made, false);
  assert.equal(result.reason, "left");
});

test("normalizeSlingDrag clamps backward pull and arc", () => {
  assert.deepEqual(normalizeSlingDrag({ dragX: -260, dragY: 120 }), {
    pull: 1,
    arc: 0.8
  });

  assert.deepEqual(normalizeSlingDrag({ dragX: 60, dragY: -120 }), {
    pull: 0,
    arc: -0.8
  });
});

test("judgeSlingShot makes a good landscape shot", () => {
  const result = judgeSlingShot({ dragX: -150, dragY: -12, randomOffset: 0 });

  assert.equal(result.made, true);
  assert.equal(result.reason, "made");
});

test("judgeSlingShot explains weak and strong landscape shots", () => {
  assert.equal(judgeSlingShot({ dragX: -50, dragY: 0, randomOffset: 0 }).reason, "short");
  assert.equal(judgeSlingShot({ dragX: -235, dragY: 0, randomOffset: 0 }).reason, "strong");
});

test("judgeSlingShot explains high and low landscape shots", () => {
  assert.equal(judgeSlingShot({ dragX: -150, dragY: -110, randomOffset: 0 }).reason, "high");
  assert.equal(judgeSlingShot({ dragX: -150, dragY: 110, randomOffset: 0 }).reason, "low");
});

test("judgeSlingTrajectory scores only when path crosses rim line and net", () => {
  const geometry = {
    rimX: 480,
    rimY: -58.5,
    rimWidth: 118,
    netLeft: 433,
    netRight: 525,
    netTop: -53,
    netBottom: 29
  };

  const result = require("./shotRules").judgeSlingTrajectory(
    { dragX: -150, dragY: -12, randomOffset: 0 },
    geometry
  );

  assert.equal(result.made, true);
  assert.equal(result.crossedRim, true);
  assert.equal(result.crossedNet, true);
});

test("judgeSlingTrajectory rejects balls that are visibly away from the hoop", () => {
  const geometry = {
    rimX: 480,
    rimY: -58.5,
    rimWidth: 118,
    netLeft: 433,
    netRight: 525,
    netTop: -53,
    netBottom: 29
  };

  const result = require("./shotRules").judgeSlingTrajectory(
    { dragX: -90, dragY: -12, randomOffset: 0 },
    geometry
  );

  assert.equal(result.made, false);
  assert.equal(result.reason, "short");
});

test("judgeSlingTrajectory returns rim bounce for overpowered rim hits", () => {
  const geometry = {
    rimX: 480,
    rimY: -59,
    rimWidth: 118,
    netLeft: 433,
    netRight: 525,
    netTop: -53,
    netBottom: 29
  };

  const result = require("./shotRules").judgeSlingTrajectory(
    { dragX: -205, dragY: 0, randomOffset: 0 },
    geometry
  );

  assert.equal(result.made, false);
  assert.equal(result.reason, "rim");
  assert.equal(result.crossedRim, true);
});

test("coachSlingAim uses real trajectory for a made shot instead of raw arc", () => {
  const geometry = {
    rimX: 480,
    rimY: -58.5,
    rimWidth: 118,
    netLeft: 433,
    netRight: 525,
    netTop: -53,
    netBottom: 29
  };

  const hint = coachSlingAim({ dragX: -110, dragY: -80, randomOffset: 0 }, geometry);

  assert.equal(hint.text, "角度刚好");
  assert.equal(hint.tone, "good");
});

test("coachSlingAim treats rim-near trajectories as close instead of too high", () => {
  const geometry = {
    rimX: 480,
    rimY: -58.5,
    rimWidth: 118,
    netLeft: 433,
    netRight: 525,
    netTop: -53,
    netBottom: 29
  };

  const hint = coachSlingAim({ dragX: -110, dragY: -90, randomOffset: 0 }, geometry);

  assert.notEqual(hint.text, "弧线太高");
  assert.match(hint.text, /接近|角度/);
});
