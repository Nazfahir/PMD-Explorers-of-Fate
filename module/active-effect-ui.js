// module/active-effect-ui.js
import { ACTIVE_EFFECT_ATTRIBUTE_OPTIONS } from "./consumable-effects.js";

const KEY_INPUT_SELECTOR = "input[name][name$='.key']";
const SELECT_CLASS = "pmd-effect-attribute-select";

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

function observeChanges(sheet, root) {
  if (!root || !sheet) return;
  if (sheet._pmdEffectObserver) {
    sheet._pmdEffectObserver.disconnect();
  }

  const observer = new MutationObserver(() => {
    applyAttributeSelects(root);
  });

  observer.observe(root, { childList: true, subtree: true });
  sheet._pmdEffectObserver = observer;
}

export function setupActiveEffectUI() {
  Hooks.on("renderActiveEffectConfig", (sheet, html) => {
    const element = findRootElement(html);
    if (!element) return;
    applyAttributeSelects(element);
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
