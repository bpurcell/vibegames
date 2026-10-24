import type { Shot, Session } from "./types";
export const shots: Shot[] = [
  {
    id: "front-neutral",
    label: "Front neutral",
    group: "portraits",
    instruction: "Look directly at the camera. Relax your face.",
    yaw: 0,
    pitch: 0,
  },
  {
    id: "left-45",
    label: "Left three-quarter",
    group: "portraits",
    instruction: "Turn your head about 45° to your left.",
    yaw: 45,
    pitch: 0,
  },
  {
    id: "right-45",
    label: "Right three-quarter",
    group: "portraits",
    instruction: "Turn your head about 45° to your right.",
    yaw: -45,
    pitch: 0,
  },
  {
    id: "left-profile",
    label: "Left profile",
    group: "portraits",
    instruction:
      "Turn to your left until your profile is visible. Use manual capture.",
    manual: true,
  },
  {
    id: "right-profile",
    label: "Right profile",
    group: "portraits",
    instruction:
      "Turn to your right until your profile is visible. Use manual capture.",
    manual: true,
  },
  {
    id: "slightly-up",
    label: "Chin slightly up",
    group: "portraits",
    instruction: "Look slightly upward, keeping your face toward the camera.",
    yaw: 0,
    pitch: 15,
  },
  {
    id: "slightly-down",
    label: "Chin slightly down",
    group: "portraits",
    instruction:
      "Lower your chin slightly, keeping your face toward the camera.",
    yaw: 0,
    pitch: -15,
  },
  ...[
    "Neutral",
    "Natural smile",
    "Big smile",
    "Laughing",
    "Serious",
    "Surprised",
  ].map((label, i) => ({
    id: ["neutral", "smile", "big-smile", "laughing", "serious", "surprised"][
      i
    ],
    label,
    group: "expressions" as const,
    instruction: [
      "Relax your face and look straight ahead.",
      "Give a gentle, natural smile.",
      "Give a broad smile with your teeth visible.",
      "Let out a natural laugh.",
      "Keep a composed, serious expression.",
      "Raise your eyebrows with a surprised expression.",
    ][i],
    yaw: 0,
    pitch: 0,
  })),
  ...["Front", "Left three-quarter", "Right three-quarter"].map((label, i) => ({
    id: ["upper-front", "upper-left", "upper-right"][i],
    label: "Upper · " + label,
    group: "body" as const,
    instruction:
      "Frame your head through your waist. " +
      [
        "Face the camera.",
        "Turn your body 45° to your left.",
        "Turn your body 45° to your right.",
      ][i],
    manual: true,
  })),
  ...["Front", "Left profile", "Right profile", "Back", "Three-quarter"].map(
    (label, i) => ({
      id: [
        "full-front",
        "full-left",
        "full-right",
        "full-back",
        "full-three-quarter",
      ][i],
      label: "Full · " + label,
      group: "body" as const,
      instruction:
        "Step back until your head and feet fit. " +
        [
          "Face the camera.",
          "Turn your body to your left.",
          "Turn your body to your right.",
          "Turn your back to the camera.",
          "Turn your body about 45°.",
        ][i] +
        " Use the timer or ask a helper.",
      manual: true,
    }),
  ),
  ...[
    "Glasses on / off",
    "Hair variation",
    "Alternative clothing",
    "Hands visible",
  ].map((label, i) => ({
    id: ["glasses", "hair", "clothing", "hands"][i],
    label,
    group: "variants" as const,
    instruction:
      label + ". Keep your appearance natural and the framing consistent.",
    optional: true,
    manual: true,
  })),
];
export const requiredShots = shots.filter((s) => !s.optional);
export const groupLabels = {
  portraits: "Face angles",
  expressions: "Expressions",
  body: "Body & framing",
  variants: "Optional variations",
};
export function newSession(): Session {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Untitled identity",
    createdAt: now,
    updatedAt: now,
    details: "",
    photos: {},
    skipped: [],
  };
}
export function coverage(session: Session) {
  return {
    complete: requiredShots.filter((s) => session.photos[s.id]).length,
    total: requiredShots.length,
    missing: requiredShots
      .filter((s) => !session.photos[s.id])
      .map((s) => s.id),
  };
}
export function nextShot(session: Session, current: string) {
  const start = shots.findIndex((s) => s.id === current);
  return [...shots.slice(start + 1), ...shots.slice(0, start)].find(
    (s) =>
      !s.optional && !session.photos[s.id] && !session.skipped.includes(s.id),
  )?.id;
}
