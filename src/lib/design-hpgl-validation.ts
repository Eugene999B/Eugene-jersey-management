export type HpglValidationResult = {
  valid: boolean;
  normalized: string;
  error: string | null;
};

function invalid(normalized: string, error: string): HpglValidationResult {
  return { valid: false, normalized, error };
}

export function validateHpglCutterPayload(input: {
  payload: string;
  maxX: number;
  maxY: number;
}): HpglValidationResult {
  const normalized = input.payload.trim();
  if (!Number.isFinite(input.maxX) || !Number.isFinite(input.maxY) || input.maxX <= 0 || input.maxY <= 0) {
    return invalid(normalized, "The configured HPGL coordinate bounds are invalid.");
  }
  if (!normalized.endsWith(";")) {
    return invalid(normalized, "The HPGL stream must end with a command delimiter.");
  }
  if (!/^[A-Z0-9,;\-]+$/.test(normalized)) {
    return invalid(normalized, "The HPGL stream contains unsupported characters.");
  }

  const commands = normalized.split(";");
  if (commands.at(-1) !== "") return invalid(normalized, "The HPGL stream is not terminated.");
  commands.pop();
  if (commands.length < 7) return invalid(normalized, "The HPGL stream is incomplete.");
  if (commands[0] !== "IN" || commands[1] !== "PA" || commands[2] !== "SP1") {
    return invalid(normalized, "The HPGL stream must initialize absolute plotting with pen 1.");
  }
  if (commands.at(-2) !== "SP0" || commands.at(-1) !== "IN") {
    return invalid(normalized, "The HPGL stream must lift the pen and reset the device after cutting.");
  }

  let hasPenDownPath = false;
  for (const command of commands.slice(3, -2)) {
    const prefix = command.slice(0, 2);
    if (prefix !== "PU" && prefix !== "PD") {
      return invalid(normalized, `Unsupported HPGL command ${command.slice(0, 8) || "(empty)"}.`);
    }
    const coordinateText = command.slice(2);
    if (!coordinateText) {
      if (prefix === "PD") return invalid(normalized, "A pen-down command must include coordinates.");
      continue;
    }
    const values = coordinateText.split(",");
    if (values.length < 2 || values.length % 2 !== 0 || values.some((value) => !/^-?\d+$/.test(value))) {
      return invalid(normalized, "An HPGL movement contains malformed coordinate pairs.");
    }
    for (let index = 0; index < values.length; index += 2) {
      const x = Number(values[index]);
      const y = Number(values[index + 1]);
      if (x < 0 || y < 0 || x > input.maxX || y > input.maxY) {
        return invalid(normalized, `HPGL coordinate ${x},${y} is outside the prepared production area.`);
      }
    }
    if (prefix === "PD") hasPenDownPath = true;
  }

  if (!hasPenDownPath) return invalid(normalized, "The HPGL stream contains no cutting path.");
  return { valid: true, normalized, error: null };
}
