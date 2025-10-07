// module/item.js
import { normalizeTypeValue } from "./pokemon-types.js";
import { CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG } from "./consumable-effects.js";
import { MOVE_DIE_OPTIONS } from "./constants.js";

const MOVE_DIE_SET = new Set(MOVE_DIE_OPTIONS);

function sanitizeMoveDie(value, fallback) {
  const die = String(value ?? "").toLowerCase();
  if (MOVE_DIE_SET.has(die)) return die;
  return fallback;
}
export class PMDItem extends Item {
  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    const sys = this.system;

    const trapData =
      typeof sys.trap === "object" && sys.trap !== null && !Array.isArray(sys.trap)
        ? sys.trap
        : {};
    const trapEnabled = trapData.enabled === true;
    const trapDescription = String(trapData.description ?? "");
    sys.trap = {
      enabled: trapEnabled,
      description: trapDescription,
    };

    const num = (v, d = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    switch (this.type) {
      case "move": {
        sys.pp ??= { max: 10, value: 10 };
        sys.pp.max = Math.max(0, num(sys.pp.max, 10));
        sys.pp.value = num(sys.pp.value, sys.pp.max);

        sys.accuracy = num(sys.accuracy, 75);
        sys.baseDamage = Math.max(0, num(sys.baseDamage, 10));
        sys.critThresholdMod = num(sys.critThresholdMod, 0);

        if (!["physical", "special", "status"].includes(sys.category)) {
          sys.category = "physical";
        }

        sys.range   = String(sys.range ?? "");
        sys.element = normalizeTypeValue(sys.element);
        sys.effect  = String(sys.effect ?? "");

        const extraRolls =
          typeof sys.extraRolls === "object" && !Array.isArray(sys.extraRolls)
            ? sys.extraRolls
            : {};
        const extraEnabled = !!extraRolls.enabled;
        const extraQuantity = Math.max(0, Math.round(num(extraRolls.quantity, 0)));
        const extraDie = sanitizeMoveDie(extraRolls.die, "d6");
        const extraMessage = String(extraRolls.message ?? "");
        sys.extraRolls = {
          enabled: extraEnabled,
          quantity: extraQuantity,
          die: extraDie,
          message: extraMessage,
        };

        const multiAttack =
          typeof sys.multiAttack === "object" && !Array.isArray(sys.multiAttack)
            ? sys.multiAttack
            : {};
        const multiEnabled = !!multiAttack.enabled;
        const multiDie = sanitizeMoveDie(multiAttack.die, "d4");
        sys.multiAttack = {
          enabled: multiEnabled,
          die: multiDie,
        };
        break;
      }

      case "equipment":
      case "consumable":
      case "gear": {
        const str = (v) => String(v ?? "");
        const nonNeg = (v, d = 0) => Math.max(0, num(v, d));

        sys.quantity = Math.max(0, Math.round(num(sys.quantity, 1)));
        sys.weight   = nonNeg(sys.weight, 0);
        sys.value    = nonNeg(sys.value, 0);

        sys.description = str(sys.description);
        sys.effect      = str(sys.effect);
        sys.notes       = str(sys.notes);

        if (this.type === "equipment") {
          sys.slot = str(sys.slot);
        }

        if (this.type === "consumable") {
          sys.uses ??= { max: 1, value: 1 };
          sys.uses.max = Math.max(0, Math.round(num(sys.uses.max, 1)));
          sys.uses.value = Math.round(num(sys.uses.value, sys.uses.max));

          const rawEffects = Array.isArray(sys.permanentEffects) ? sys.permanentEffects : [];
          const permanentEffects = rawEffects
            .filter((effect) => effect && typeof effect === "object" && !Array.isArray(effect))
            .map((effect) => {
              const attributeKey = String(effect.attribute ?? "");
              const mode = effect.mode === "subtract" ? "subtract" : "add";
              const amount = Math.max(0, num(effect.amount, 0));
              const isValidAttribute = attributeKey in CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG;
              return {
                attribute: isValidAttribute ? attributeKey : "",
                mode,
                amount,
              };
            });

          if (!permanentEffects.length) {
            const legacy =
              typeof sys.permanentEffect === "object" &&
              sys.permanentEffect !== null &&
              !Array.isArray(sys.permanentEffect)
                ? sys.permanentEffect
                : null;
            if (legacy) {
              const attributeKey = String(legacy.attribute ?? "");
              const mode = legacy.mode === "subtract" ? "subtract" : "add";
              const amount = Math.max(0, num(legacy.amount, 0));
              const isValidAttribute = attributeKey in CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG;
              permanentEffects.push({
                attribute: isValidAttribute ? attributeKey : "",
                mode,
                amount,
              });
            }
          }

          if (!permanentEffects.length) {
            permanentEffects.push({ attribute: "", mode: "add", amount: 0 });
          }

          sys.permanentEffects = permanentEffects;
          sys.permanentEffect = permanentEffects[0] ?? { attribute: "", mode: "add", amount: 0 };
        }
        break;
      }

      case "trait": {
        const str = (v) => String(v ?? "");
        sys.effect = str(sys.effect);
        break;
      }
    }
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    if (this.type === "move") {
      if (Number.isFinite(sys.pp?.max) && Number.isFinite(sys.pp?.value)) {
        sys.pp.value = Math.clamp(sys.pp.value, 0, sys.pp.max);
      }
    }

    if (this.type === "consumable") {
      if (Number.isFinite(sys.uses?.max) && Number.isFinite(sys.uses?.value)) {
        sys.uses.value = Math.clamp(sys.uses.value, 0, sys.uses.max);
      }
    }

    const effects = this.effects?.contents ?? [];
    if (!effects.length) return;

    if (this.type === "equipment") {
      const isEquipped = !!sys?.equipped;
      for (const effect of effects) {
        if (!effect) continue;
        const source = effect._source ?? {};
        const baseDisabled = source.disabled === true;
        const baseTransfer = source.transfer !== false;
        effect.disabled = baseDisabled || !isEquipped;
        effect.transfer = baseTransfer && isEquipped;
      }
    } else if (this.type === "consumable" || this.type === "move") {
      for (const effect of effects) {
        if (!effect) continue;
        effect.disabled = true;
        effect.transfer = false;
      }
    }
  }

  /** @override */
  applyActiveEffects(actor, changeData) {
    if (this.type === "equipment" && !this.system?.equipped) {
      return;
    }

    if (this.type === "consumable") {
      return;
    }

    if (typeof super.applyActiveEffects === "function") {
      return super.applyActiveEffects(actor, changeData);
    }
  }
}
