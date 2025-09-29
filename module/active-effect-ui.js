// module/active-effect-ui.js
import { ACTIVE_EFFECT_ATTRIBUTE_OPTIONS } from "./consumable-effects.js";

const KEY_INPUT_SELECTOR = "input[name][name$='.key']";
const SELECT_CLASS = "pmd-effect-attribute-select";
const TARGET_TOGGLE_SELECTOR = "[data-pmd-target-toggle]";

function findRootElement(html) {
  if (!html) return null;
  const element = html?.element ?? html;
  if (element instanceof HTMLElement || element instanceof DocumentFragment) return element;
  if (typeof element === "object" && element !== null && 0 in element) {
    const candidate = element[0];
    if (candidate instanceof HTMLElement || candidate instanceof DocumentFragment) return candidate;
  }
  return null;
}

function syncSelectWithInput(select, input) {
  if (!select || !input) return;
  const match = ACTIVE_EFFECT_ATTRIBUTE_OPTIONS.find((option) => option.value === input.value);
  select.value = match ? match.value : "";
}

function createAttributeSelect(input) {
  if (!(input instanceof HTMLInputElement)) return null;
  if (input.dataset.pmdHasAttributeSelect === "true") return input.previousElementSibling;

  const select = document.createElement("select");
  select.classList.add(SELECT_CLASS);

  for (const option of ACTIVE_EFFECT_ATTRIBUTE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    select.appendChild(opt);
  }

  syncSelectWithInput(select, input);

  select.addEventListener("change", () => {
    if (!input) return;
    if (select.value) {
      input.value = select.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      input.focus();
    }
  });

  input.addEventListener("input", () => {
    syncSelectWithInput(select, input);
  });

  input.insertAdjacentElement("beforebegin", select);
  input.dataset.pmdHasAttributeSelect = "true";
  return select;
}

function applyAttributeSelects(root) {
  if (!root) return;
  root.querySelectorAll(KEY_INPUT_SELECTOR).forEach((input) => {
    createAttributeSelect(input);
  });
}

function getEffectFromSheet(sheet) {
  if (!sheet) return null;
  if (sheet.object) return sheet.object;
  if (sheet.document) return sheet.document;
  return null;
}

function getMoveParentItem(sheet) {
  const effect = getEffectFromSheet(sheet);
  const parent = effect?.parent ?? null;
  if (!parent) return null;
  const documentName = parent.documentName ?? parent.constructor?.documentName ?? null;
  if (documentName && documentName !== "Item") return null;
  if (parent?.type !== "move") return null;
  return parent;
}

function getApplyToTarget(effect) {
  if (!effect) return false;
  if (typeof effect.getFlag === "function") {
    const flag = effect.getFlag("pmd", "applyToTarget");
    if (flag !== undefined) return !!flag;
  }
  return !!effect?.flags?.pmd?.applyToTarget;
}

function ensureTargetToggle(sheet, root) {
  if (!root) return;
  const form = root.querySelector("form") ?? root.closest?.("form");
  if (!form) return;

  const parentItem = getMoveParentItem(sheet);
  const existing = form.querySelector(TARGET_TOGGLE_SELECTOR);

  if (!parentItem) {
    if (existing) existing.remove();
    return;
  }

  const effect = getEffectFromSheet(sheet);
  const isChecked = getApplyToTarget(effect);

  let container = existing;
  if (!container) {
    container = document.createElement("div");
    container.classList.add("form-group");
    container.dataset.pmdTargetToggle = "true";

    const label = document.createElement("label");
    label.textContent = "Aplicar a objetivo";

    const fields = document.createElement("div");
    fields.classList.add("form-fields");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "flags.pmd.applyToTarget";
    checkbox.setAttribute("data-dtype", "Boolean");

    fields.appendChild(checkbox);

    const notes = document.createElement("p");
    notes.classList.add("notes");
    notes.textContent = "Si está activo, este efecto se aplicará a la criatura objetivo al usar el movimiento.";

    container.appendChild(label);
    container.appendChild(fields);
    container.appendChild(notes);

    const targetTab = form.querySelector(".tab[data-tab='effects']") ?? form.querySelector(".sheet-body") ?? form;
    targetTab.appendChild(container);
  }

  const checkbox = container.querySelector("input[name='flags.pmd.applyToTarget']");
  if (checkbox) {
    checkbox.checked = !!isChecked;
  }
}

function observeChanges(sheet, root) {
  if (!root || !sheet) return;
  if (sheet._pmdEffectObserver) {
    sheet._pmdEffectObserver.disconnect();
  }

  const observer = new MutationObserver(() => {
    applyAttributeSelects(root);
    ensureTargetToggle(sheet, root);
  });

  observer.observe(root, { childList: true, subtree: true });
  sheet._pmdEffectObserver = observer;
}

export function setupActiveEffectUI() {
  Hooks.on("renderActiveEffectConfig", (sheet, html) => {
    const element = findRootElement(html);
    if (!element) return;
    applyAttributeSelects(element);
    ensureTargetToggle(sheet, element);
    observeChanges(sheet, element);
  });

  Hooks.on("closeActiveEffectConfig", (sheet) => {
    const observer = sheet?._pmdEffectObserver;
    observer?.disconnect?.();
    if (sheet) {
      delete sheet._pmdEffectObserver;
    }
  });
}
