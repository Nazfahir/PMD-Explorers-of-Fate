const RAW_TYPE_OPTIONS = [
  { value: "", label: "Sin tipo" },
  { value: "Normal", label: "Normal" },
  { value: "Fuego", label: "Fuego" },
  { value: "Agua", label: "Agua" },
  { value: "Planta", label: "Planta" },
  { value: "Eléctrico", label: "Eléctrico" },
  { value: "Hielo", label: "Hielo" },
  { value: "Lucha", label: "Lucha" },
  { value: "Veneno", label: "Veneno" },
  { value: "Tierra", label: "Tierra" },
  { value: "Volador", label: "Volador" },
  { value: "Psíquico", label: "Psíquico" },
  { value: "Bicho", label: "Bicho" },
  { value: "Roca", label: "Roca" },
  { value: "Fantasma", label: "Fantasma" },
  { value: "Dragón", label: "Dragón" },
  { value: "Siniestro", label: "Siniestro" },
  { value: "Acero", label: "Acero" },
  { value: "Hada", label: "Hada" }
];

export const TYPE_OPTIONS = Object.freeze(RAW_TYPE_OPTIONS.map((opt) => Object.freeze({ ...opt })));

function createMatchup({ strong = [], weak = [], immune = [] }) {
  const toList = (values) => values
    .map((value) => normalizeTypeValue(value))
    .filter((value) => !!value);
  return Object.freeze({
    strong: Object.freeze(toList(strong)),
    weak: Object.freeze(toList(weak)),
    immune: Object.freeze(toList(immune))
  });
}

export const TYPE_EFFECTIVENESS_CHART = Object.freeze({
  [normalizeTypeValue("Normal")]: createMatchup({
    weak: ["Roca", "Acero"],
    immune: ["Fantasma"]
  }),
  [normalizeTypeValue("Fuego")]: createMatchup({
    strong: ["Planta", "Hielo", "Bicho", "Acero"],
    weak: ["Fuego", "Agua", "Roca", "Dragón"]
  }),
  [normalizeTypeValue("Agua")]: createMatchup({
    strong: ["Fuego", "Tierra", "Roca"],
    weak: ["Agua", "Planta", "Dragón"]
  }),
  [normalizeTypeValue("Planta")]: createMatchup({
    strong: ["Agua", "Tierra", "Roca"],
    weak: ["Fuego", "Planta", "Veneno", "Volador", "Bicho", "Dragón", "Acero"]
  }),
  [normalizeTypeValue("Eléctrico")]: createMatchup({
    strong: ["Agua", "Volador"],
    weak: ["Planta", "Eléctrico", "Dragón"],
    immune: ["Tierra"]
  }),
  [normalizeTypeValue("Hielo")]: createMatchup({
    strong: ["Planta", "Tierra", "Volador", "Dragón"],
    weak: ["Fuego", "Agua", "Hielo", "Acero"]
  }),
  [normalizeTypeValue("Lucha")]: createMatchup({
    strong: ["Normal", "Hielo", "Roca", "Siniestro", "Acero"],
    weak: ["Veneno", "Volador", "Psíquico", "Bicho", "Hada"],
    immune: ["Fantasma"]
  }),
  [normalizeTypeValue("Veneno")]: createMatchup({
    strong: ["Planta", "Hada"],
    weak: ["Veneno", "Tierra", "Roca", "Fantasma"],
    immune: ["Acero"]
  }),
  [normalizeTypeValue("Tierra")]: createMatchup({
    strong: ["Fuego", "Eléctrico", "Veneno", "Roca", "Acero"],
    weak: ["Planta", "Bicho"],
    immune: ["Volador"]
  }),
  [normalizeTypeValue("Volador")]: createMatchup({
    strong: ["Planta", "Lucha", "Bicho"],
    weak: ["Eléctrico", "Roca", "Acero"]
  }),
  [normalizeTypeValue("Psíquico")]: createMatchup({
    strong: ["Lucha", "Veneno"],
    weak: ["Psíquico", "Acero"],
    immune: ["Siniestro"]
  }),
  [normalizeTypeValue("Bicho")]: createMatchup({
    strong: ["Planta", "Psíquico", "Siniestro"],
    weak: ["Fuego", "Lucha", "Veneno", "Volador", "Fantasma", "Acero", "Hada"]
  }),
  [normalizeTypeValue("Roca")]: createMatchup({
    strong: ["Fuego", "Hielo", "Volador", "Bicho"],
    weak: ["Lucha", "Tierra", "Acero"]
  }),
  [normalizeTypeValue("Fantasma")]: createMatchup({
    strong: ["Psíquico", "Fantasma"],
    weak: ["Siniestro"],
    immune: ["Normal"]
  }),
  [normalizeTypeValue("Dragón")]: createMatchup({
    strong: ["Dragón"],
    weak: ["Acero"],
    immune: ["Hada"]
  }),
  [normalizeTypeValue("Siniestro")]: createMatchup({
    strong: ["Psíquico", "Fantasma"],
    weak: ["Lucha", "Siniestro", "Hada"]
  }),
  [normalizeTypeValue("Acero")]: createMatchup({
    strong: ["Hielo", "Roca", "Hada"],
    weak: ["Fuego", "Agua", "Eléctrico", "Acero"]
  }),
  [normalizeTypeValue("Hada")]: createMatchup({
    strong: ["Lucha", "Dragón", "Siniestro"],
    weak: ["Fuego", "Veneno", "Acero"]
  })
});

function clampIndex(index) {
  const max = TYPE_OPTIONS.length - 1;
  const num = Number(index);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num);
  if (rounded < 0) return 0;
  if (rounded > max) return max;
  return rounded;
}

function normalizeForMatch(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function typeOptionFromIndex(index) {
  return TYPE_OPTIONS[clampIndex(index)] ?? TYPE_OPTIONS[0];
}

export function normalizeTypeValue(value) {
  const str = String(value ?? "").trim();
  if (!str) return "";
  const target = normalizeForMatch(str);
  const found = TYPE_OPTIONS.find((opt) => normalizeForMatch(opt.value) === target);
  return found ? found.value : "";
}

export function typeIndexFromValue(value) {
  const normalized = normalizeTypeValue(value);
  const idx = TYPE_OPTIONS.findIndex((opt) => opt.value === normalized);
  return idx >= 0 ? idx : 0;
}

export function typeLabelFromValue(value) {
  const normalized = normalizeTypeValue(value);
  const found = TYPE_OPTIONS.find((opt) => opt.value === normalized);
  return found ? found.label : TYPE_OPTIONS[0].label;
}

export function typeValueFromIndex(index) {
  return typeOptionFromIndex(index).value;
}

export function calculateTypeEffectiveness(attackType, defenderTypes) {
  const normalizedAttack = normalizeTypeValue(attackType);
  if (!normalizedAttack) {
    return { multiplier: 1, effective: 0, resistant: 0, immune: 0 };
  }

  const matchup = TYPE_EFFECTIVENESS_CHART[normalizedAttack];
  if (!matchup) {
    return { multiplier: 1, effective: 0, resistant: 0, immune: 0 };
  }

  const defenders = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
  let effective = 0;
  let resistant = 0;
  let immune = 0;

  for (const type of defenders) {
    const normalizedDefender = normalizeTypeValue(type);
    if (!normalizedDefender) continue;
    if (matchup.immune.includes(normalizedDefender)) {
      immune += 1;
      continue;
    }
    if (matchup.strong.includes(normalizedDefender)) {
      effective += 1;
      continue;
    }
    if (matchup.weak.includes(normalizedDefender)) {
      resistant += 1;
    }
  }

  if (immune > 0) {
    return { multiplier: 0, effective, resistant, immune };
  }

  if (resistant >= 2) {
    return { multiplier: 0.25, effective, resistant, immune };
  }

  if (effective >= 2) {
    return { multiplier: 2, effective, resistant, immune };
  }

  if (resistant === 1 && effective === 0) {
    return { multiplier: 0.5, effective, resistant, immune };
  }

  if (effective === 1 && resistant === 0) {
    return { multiplier: 1.5, effective, resistant, immune };
  }

  return { multiplier: 1, effective, resistant, immune };
}
