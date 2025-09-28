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
