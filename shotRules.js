(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.shotRules = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_DRAG_X = 95;
  const MAX_DRAG_Y = 130;
  const MIN_MAKE_POWER = 0.48;
  const MAX_MAKE_POWER = 0.9;
  const MAX_DIRECTION_ERROR = 34;
  const MAX_SLING_PULL = 220;
  const MAX_SLING_ARC = 150;
  const MIN_SLING_PULL = 0.46;
  const MAX_SLING_MAKE_PULL = 0.88;
  const MAX_SLING_ARC_ERROR = 0.5;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeDrag(input) {
    const direction = clamp(Math.round(input.dragX), -MAX_DRAG_X, MAX_DRAG_X);
    const dragY = clamp(input.dragY, 0, MAX_DRAG_Y);
    const power = Number((dragY / MAX_DRAG_Y).toFixed(2));
    return { direction, power };
  }

  function judgeShot(input) {
    const normalized = normalizeDrag(input);
    const randomOffset = input.randomOffset ?? (Math.random() * 12 - 6);
    const directionError = Math.abs(normalized.direction + randomOffset);

    if (normalized.power < MIN_MAKE_POWER) {
      return { made: false, reason: "short", ...normalized, directionError };
    }

    if (normalized.power > MAX_MAKE_POWER) {
      return { made: false, reason: "strong", ...normalized, directionError };
    }

    if (directionError > MAX_DIRECTION_ERROR) {
      const reason = normalized.direction < 0 ? "left" : "right";
      return { made: false, reason, ...normalized, directionError };
    }

    return { made: true, reason: "made", ...normalized, directionError };
  }

  function normalizeSlingDrag(input) {
    const backwardPull = clamp(-input.dragX, 0, MAX_SLING_PULL);
    const arcDrag = clamp(input.dragY, -MAX_SLING_ARC, MAX_SLING_ARC);
    const pull = Number((backwardPull / MAX_SLING_PULL).toFixed(2));
    const arc = Number((arcDrag / MAX_SLING_ARC).toFixed(2));
    return { pull, arc };
  }

  function judgeSlingShot(input) {
    const normalized = normalizeSlingDrag(input);
    const randomOffset = input.randomOffset ?? (Math.random() * 0.12 - 0.06);
    const arcError = normalized.arc + randomOffset;

    if (normalized.pull < MIN_SLING_PULL) {
      return { made: false, reason: "short", ...normalized, arcError };
    }

    if (normalized.pull > MAX_SLING_MAKE_PULL) {
      return { made: false, reason: "strong", ...normalized, arcError };
    }

    if (arcError < -MAX_SLING_ARC_ERROR) {
      return { made: false, reason: "high", ...normalized, arcError };
    }

    if (arcError > MAX_SLING_ARC_ERROR) {
      return { made: false, reason: "low", ...normalized, arcError };
    }

    return { made: true, reason: "made", ...normalized, arcError };
  }

  function calculateSlingPoint(input, geometry, t) {
    const pullPixels = clamp(-input.dragX, 0, MAX_SLING_PULL);
    const normalized = normalizeSlingDrag(input);
    const followThrough = Math.max(70, geometry.rimWidth * 0.65);
    const endX = geometry.rimX + followThrough + (pullPixels - 150) * 2.1;
    const rimT = clamp(geometry.rimX / Math.max(endX, 1), 0.35, 0.96);
    const targetYAtRim = geometry.rimY + (input.dragY + 12) * 0.42;
    const arcHeight = 96 + pullPixels * 0.32 + Math.max(0, -input.dragY) * 0.45;
    const endY = (targetYAtRim + 4 * arcHeight * rimT * (1 - rimT)) / rimT;
    const x = endX * t;
    const y = endY * t - 4 * arcHeight * t * (1 - t);

    return {
      x,
      y,
      t,
      pull: normalized.pull,
      arc: normalized.arc
    };
  }

  function judgeSlingTrajectory(input, geometry) {
    const normalized = normalizeSlingDrag(input);
    const samples = [];
    const endPoint = calculateSlingPoint(input, geometry, 1);

    if (normalized.pull < MIN_SLING_PULL) {
      return withTrajectory({ made: false, reason: "short", ...normalized }, samples);
    }

    for (let i = 0; i <= 40; i += 1) {
      samples.push(calculateSlingPoint(input, geometry, i / 40));
    }

    if (endPoint.x < geometry.rimX - geometry.rimWidth / 2) {
      return withTrajectory({ made: false, reason: "short", ...normalized }, samples);
    }

    const rimPoint = pointAtX(input, geometry, geometry.rimX);
    const crossedRim = Math.abs(rimPoint.y - geometry.rimY) <= 16;
    const crossedNet = samples.some((point) => (
      point.x >= geometry.netLeft &&
      point.x <= geometry.netRight &&
      point.y >= geometry.netTop - 12 &&
      point.y <= geometry.netBottom
    ));

    if (normalized.pull > MAX_SLING_MAKE_PULL) {
      const reason = Math.abs(rimPoint.y - geometry.rimY) <= 28 ? "rim" : "strong";
      return withTrajectory({ made: false, reason, crossedRim, crossedNet, impactPoint: rimPoint, ...normalized }, samples);
    }

    if (rimPoint.y < geometry.rimY - 16) {
      return withTrajectory({ made: false, reason: "high", crossedRim: false, crossedNet, impactPoint: rimPoint, ...normalized }, samples);
    }

    if (rimPoint.y > geometry.rimY + 16) {
      return withTrajectory({ made: false, reason: "low", crossedRim: false, crossedNet, impactPoint: rimPoint, ...normalized }, samples);
    }

    if (crossedRim && crossedNet) {
      return withTrajectory({ made: true, reason: "made", crossedRim, crossedNet, impactPoint: rimPoint, ...normalized }, samples);
    }

    return withTrajectory({ made: false, reason: "rim", crossedRim, crossedNet, impactPoint: rimPoint, ...normalized }, samples);
  }

  function coachSlingAim(input, geometry) {
    const normalized = normalizeSlingDrag(input);
    const result = judgeSlingTrajectory(input, geometry);
    const hint = { result };

    if (normalized.pull < MIN_SLING_PULL) {
      return { text: "力度偏小", tone: "warn", ...hint };
    }

    if (normalized.pull > MAX_SLING_MAKE_PULL) {
      if (result.reason === "rim" || result.crossedRim || result.crossedNet) {
        return { text: "角度接近，少用力", tone: "warn", ...hint };
      }

      return { text: "力度太大", tone: "warn", ...hint };
    }

    if (result.made) {
      return { text: "角度刚好", tone: "good", ...hint };
    }

    if (result.reason === "rim" || result.crossedRim || result.crossedNet) {
      return { text: "角度接近", tone: "good", ...hint };
    }

    if (result.reason === "high") {
      return { text: "弧线稍高", tone: "warn", ...hint };
    }

    if (result.reason === "low") {
      return { text: "弧线稍低", tone: "warn", ...hint };
    }

    return { text: "力度偏小", tone: "warn", ...hint };
  }

  function pointAtX(input, geometry, x) {
    const endPoint = calculateSlingPoint(input, geometry, 1);
    const t = clamp(x / Math.max(endPoint.x, 1), 0, 1);
    return calculateSlingPoint(input, geometry, t);
  }

  function withTrajectory(result, samples) {
    return {
      ...result,
      trajectory: samples
    };
  }

  return {
    MAX_DRAG_X,
    MAX_DRAG_Y,
    MAX_SLING_PULL,
    MAX_SLING_ARC,
    normalizeDrag,
    judgeShot,
    normalizeSlingDrag,
    judgeSlingShot,
    calculateSlingPoint,
    judgeSlingTrajectory,
    coachSlingAim
  };
});
