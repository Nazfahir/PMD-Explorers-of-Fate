// module/consumable-effects.js
const clampNonNegative = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
};

const clampLevel = (value) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
};

const clampInteger = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
};

const clampHpValue = (value, actor) => {
  const maxHp = Number(actor?.system?.hp?.max);
  const safeMax = Number.isFinite(maxHp) ? Math.max(0, maxHp) : null;
  const safeValue = Number.isFinite(value) ? value : 0;
  if (safeMax === null) return Math.max(0, Math.round(safeValue));
  return Math.clamp(Math.round(safeValue), 0, safeMax);
};

const clampHpMax = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
};

const clampExperienceValue = (value, actor) => {
  const maxExp = Number(actor?.system?.experience?.max);
  const safeMax = Number.isFinite(maxExp) ? Math.max(0, Math.round(maxExp)) : null;
  const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
  if (safeMax === null) return Math.max(0, safeValue);
  return Math.clamp(safeValue, 0, safeMax);
};

export const CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG = {
  hpValue: {
    label: "HP actual",
    path: "system.hp.value",
    clamp: clampHpValue,
  },
  hpMax: {
    label: "HP máxima",
    path: "system.hp.max",
    clamp: clampHpMax,
    afterUpdate: (newMax, actor) => {
      const sourceHp = actor?._source?.system?.hp?.value;
      const currentHp = Number(sourceHp ?? actor?.system?.hp?.value);
      if (!Number.isFinite(currentHp)) return null;
      const safeMax = Number.isFinite(newMax) ? Math.max(0, Math.round(newMax)) : 0;
      const clamped = Math.clamp(Math.round(currentHp), 0, safeMax);
      if (clamped === Math.round(currentHp)) return null;
      return { "system.hp.value": clamped };
    },
  },
  hpTemp: {
    label: "HP temporal / Escudo",
    path: "system.hp.temp",
    clamp: clampNonNegative,
  },
  experienceValue: {
    label: "EXP actual",
    path: "system.experience.value",
    clamp: clampExperienceValue,
  },
  experienceMax: {
    label: "EXP máxima",
    path: "system.experience.max",
    clamp: clampNonNegative,
    afterUpdate: (newMax, actor) => {
      const sourceExp = actor?._source?.system?.experience?.value;
      const currentExp = Number(sourceExp ?? actor?.system?.experience?.value);
      if (!Number.isFinite(currentExp)) return null;
      const safeMax = Number.isFinite(newMax) ? Math.max(0, Math.round(newMax)) : 0;
      const clamped = Math.clamp(Math.round(currentExp), 0, safeMax);
      if (clamped === Math.round(currentExp)) return null;
      return { "system.experience.value": clamped };
    },
  },
  lp: {
    label: "LP",
    path: "system.lp",
    clamp: clampNonNegative,
  },
  lvl: {
    label: "Nivel",
    path: "system.lvl",
    clamp: clampLevel,
  },
  speed: {
    label: "Velocidad",
    path: "system.speed",
    clamp: clampInteger,
  },
  attack: {
    label: "Ataque",
    path: "system.attack",
    clamp: clampInteger,
  },
  spAttack: {
    label: "Ataque Especial",
    path: "system.spAttack",
    clamp: clampInteger,
  },
  defense: {
    label: "Defensa",
    path: "system.defense",
    clamp: clampInteger,
  },
  spDefense: {
    label: "Defensa Especial",
    path: "system.spDefense",
    clamp: clampInteger,
  },
  stab: {
    label: "STAB",
    path: "system.stab",
    clamp: clampInteger,
  },
  basicattack: {
    label: "Basic Attack",
    path: "system.basicattack",
    clamp: clampInteger,
  },
  accuracyBonus: {
    label: "Precisión global",
    path: "system.accuracyBonus",
    clamp: clampInteger,
  },
  critAttackMod: {
    label: "Mod. crítico (ataques)",
    path: "system.critAttackMod",
    clamp: clampInteger,
  },
  critDefenseMod: {
    label: "Mod. crítico (defensa)",
    path: "system.critDefenseMod",
    clamp: clampInteger,
  },
  belly: {
    label: "Belly",
    path: "system.belly",
    clamp: clampNonNegative,
  },
};

export const CONSUMABLE_PERMANENT_ATTRIBUTE_OPTIONS = [
  { key: "", label: "Sin efecto permanente" },
  ...Object.entries(CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG).map(([key, config]) => ({
    key,
    label: config.label,
  })),
];

export const ACTIVE_EFFECT_ATTRIBUTE_OPTIONS = [
  { value: "", label: "Selecciona atributo…" },
  ...Object.values(CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG).map((config) => ({
    value: config.path,
    label: config.label,
  })),
];
