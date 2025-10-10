// module/actor-sheet.js
import {
  TYPE_OPTIONS,
  normalizeTypeValue,
  typeIndexFromValue,
  calculateTypeEffectiveness
} from "./pokemon-types.js";
import { mapActiveEffects, bindEffectControls } from "./effect-helpers.js";
import { CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG } from "./consumable-effects.js";
const BaseActorSheet =
  foundry?.appv1?.sheets?.ActorSheet ??
  foundry?.applications?.sheets?.ActorSheet ??
  globalThis.ActorSheet;

function cloneDefaults(defaults) {
  if (!defaults) return {};
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(defaults);
  if (typeof structuredClone === "function") return structuredClone(defaults);
  try {
    return JSON.parse(JSON.stringify(defaults));
  } catch (err) {
    if (foundry?.utils?.mergeObject) return foundry.utils.mergeObject({}, defaults);
    return { ...defaults };
  }
}

function createActorSheetOptions() {
  return {
    classes: ["PMD-Explorers-of-Fate", "sheet", "actor"],
    template: "systems/PMD-Explorers-of-Fate/templates/actor-sheet.hbs",
    width: 700,
    height: 600,
    tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }],
    submitOnChange: true,
    closeOnSubmit: false
  };
}

function resolveHTMLElement(html) {
  if (!html) return null;
  const element = html?.element ?? html;
  if (element instanceof HTMLElement || element instanceof DocumentFragment) return element;
  if (typeof element === "object" && element !== null && 0 in element) {
    const candidate = element[0];
    if (candidate instanceof HTMLElement || candidate instanceof DocumentFragment) return candidate;
  }
  return null;
}

function onceResolver(resolve) {
  let done = false;
  return (value) => {
    if (done) return;
    done = true;
    resolve(value);
  };
}

export class MyActorSheet extends BaseActorSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    cloneDefaults(super.DEFAULT_OPTIONS ?? super.defaultOptions),
    createActorSheetOptions()
  );

  static get defaultOptions() {
    if (super.defaultOptions) {
      return foundry.utils.mergeObject(cloneDefaults(super.defaultOptions), createActorSheetOptions());
    }
    return this.DEFAULT_OPTIONS;
  }

  async _prepareContext(options) {
    const context = await this._getBaseContext(options, true);
    return this._augmentContext(context);
  }

  async getData(options = {}) {
    const context = await this._getBaseContext(options, false);
    return this._augmentContext(context);
  }

  async _getBaseContext(options, preferV2) {
    if (preferV2 && typeof super._prepareContext === "function") {
      return await super._prepareContext(options);
    }
    if (!preferV2 && typeof super.getData === "function") {
      return await super.getData(options);
    }
    if (typeof super._prepareContext === "function") {
      return await super._prepareContext(options);
    }
    if (typeof super.getData === "function") {
      return await super.getData(options);
    }
    return {};
  }

  _augmentContext(context) {
    const data = context ?? {};
    data.system = this.actor.system;

    data.typeOptions = TYPE_OPTIONS;
    data.typeIndices = {
      type1: typeIndexFromValue(this.actor.system?.type1),
      type2: typeIndexFromValue(this.actor.system?.type2)
    };

    data.skillList = [
      { key: "athletics",   label: "Athletics" },
      { key: "craft",       label: "Craft" },
      { key: "endurance",   label: "Endurance" },
      { key: "finesse",     label: "Finesse" },
      { key: "medicine",    label: "Medicine" },
      { key: "perception",  label: "Perception" },
      { key: "performance", label: "Performance" },
      { key: "persuasion",  label: "Persuasion" },
      { key: "spKnowledge", label: "Sp. Knowledge" },
      { key: "stealth",     label: "Stealth" },
      { key: "survival",    label: "Survival" }
    ];

    data.skillMin = 15;
    data.skillMax = 95;

    data.moves = this.actor.items
      .filter(i => i.type === "move")
      .sort((a, b) => a.name.localeCompare(b.name));

    const typeList = (type) => this.actor.items
      .filter((i) => i.type === type)
      .sort((a, b) => a.name.localeCompare(b.name));

    data.traits = typeList("trait");

    data.inventorySections = [
      {
        type: "equipment",
        label: "Equipamiento",
        createLabel: "+ Nuevo equipamiento",
        emptyHint: "Arrastra Items tipo <b>Equipamiento</b> o usa “+ Nuevo equipamiento”.",
        items: typeList("equipment"),
      },
      {
        type: "consumable",
        label: "Consumibles",
        createLabel: "+ Nuevo consumible",
        emptyHint: "Arrastra Items tipo <b>Consumible</b> o usa “+ Nuevo consumible”.",
        items: typeList("consumable"),
      },
      {
        type: "gear",
        label: "Otros objetos",
        createLabel: "+ Nuevo objeto",
        emptyHint: "Arrastra Items tipo <b>Objeto</b> o usa “+ Nuevo objeto”.",
        items: typeList("gear"),
      },
    ];

    data.activeEffects = mapActiveEffects(this.actor);
    data.isGM = game?.user?.isGM ?? false;

    return data;
  }

  /** @override */
  activateListeners(html) {
    if (typeof super.activateListeners === "function") {
      super.activateListeners(html);
    }

    const root = resolveHTMLElement(html);
    if (!root || !this.isEditable) return;

    const addClick = (selector, handler) => {
      root.querySelectorAll(selector).forEach((element) => {
        element.addEventListener("click", async (event) => {
          event.preventDefault();
          await handler(event, element);
        });
      });
    };

    // Habilidades
    addClick("[data-action='roll-skill']", (event, element) => {
      const skill = element.dataset.skill;
      if (!skill) return;
      const label = element.dataset.label ?? skill;
      this._rollSkill(skill, label);
    });

    addClick("[data-action='restore-actor']", async () => {
      await this._restoreActorResources();
    });

    addClick("[data-action='use-basic-attack']", async () => {
      await this._useBasicAttack();
    });

    // Movimientos
    addClick("[data-action='create-move']", async () => {
      const created = await this.actor.createEmbeddedDocuments("Item", [{
        name: "Nuevo Movimiento",
        type: "move",
        system: {}
      }]);
      created?.[0]?.sheet?.render(true);
    });

    addClick("[data-action='edit-move']", (event, element) => {
      const id = element.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.sheet?.render(true);
    });

    addClick("[data-action='delete-move']", async (event, element) => {
      const id = element.closest("[data-item-id]")?.dataset.itemId;
      if (id) await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    addClick("[data-action='use-move']", async (event, element) => {
      const id = element.closest("[data-item-id]")?.dataset.itemId;
      const item = id ? this.actor.items.get(id) : null;
      if (item) await this._useMove(item);
    });

    addClick("[data-action='create-item']", async (event, element) => {
      const type = element.dataset.type;
      if (!type) return;

      const names = {
        equipment: "Nuevo equipamiento",
        consumable: "Nuevo consumible",
        gear: "Nuevo objeto",
        trait: "Nuevo rasgo",
      };

      const created = await this.actor.createEmbeddedDocuments("Item", [{
        name: names[type] ?? "Nuevo objeto",
        type,
        system: {},
      }]);
      created?.[0]?.sheet?.render(true);
    });

    addClick("[data-action='edit-item']", (event, element) => {
      const id = element.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.sheet?.render(true);
    });

    addClick("[data-action='delete-item']", async (event, element) => {
      const id = element.closest("[data-item-id]")?.dataset.itemId;
      if (id) await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    addClick("[data-action='use-consumable']", async (event, element) => {
      const id = element.closest("[data-item-id]")?.dataset.itemId;
      const item = id ? this.actor.items.get(id) : null;
      if (item) await this._consumeItem(item);
    });

    addClick("[data-action='use-gear']", async (event, element) => {
      const id = element.closest("[data-item-id]")?.dataset.itemId;
      const item = id ? this.actor.items.get(id) : null;
      if (item) await this._useGearItem(item);
    });

    root.querySelectorAll("[data-action='toggle-equipped']").forEach((element) => {
      element.addEventListener("change", async () => {
        const id = element.closest("[data-item-id]")?.dataset.itemId;
        if (!id) return;
        const item = this.actor.items.get(id);
        if (!item) return;
        await item.update({ "system.equipped": !!element.checked });
      });
    });

    bindEffectControls(root, this.actor, "actor");
  }

  async _restoreActorResources() {
    const actorUpdates = {};
    const maxHP = Number(this.actor.system?.hp?.max);
    if (Number.isFinite(maxHP)) {
      actorUpdates["system.hp.value"] = Math.max(0, maxHP);
    }
    const tempHP = Number(this.actor.system?.hp?.temp);
    if (Number.isFinite(tempHP) && tempHP !== 0) {
      actorUpdates["system.hp.temp"] = 0;
    }

    const moveUpdates = this.actor.items
      .filter((item) => item.type === "move")
      .map((item) => {
        const maxPP = Number(item.system?.pp?.max);
        if (!Number.isFinite(maxPP)) return null;
        return { _id: item.id, "system.pp.value": Math.max(0, maxPP) };
      })
      .filter((update) => update !== null);

    const updateTasks = [];
    if (Object.keys(actorUpdates).length) {
      updateTasks.push(this.actor.update(actorUpdates));
    }
    if (moveUpdates.length) {
      updateTasks.push(this.actor.updateEmbeddedDocuments("Item", moveUpdates));
    }

    if (!updateTasks.length) {
      ui.notifications?.warn("No se encontraron valores de HP o PP para restaurar.");
      return;
    }

    await Promise.all(updateTasks);
    ui.notifications?.info("HP y PP restaurados.");
  }

  /* -------------------- Tiradas de HABILIDAD -------------------- */
  async _askRollMode() {
    return await new Promise((resolve) => {
      const safeResolve = onceResolver(resolve);
      new Dialog({
        title: "Tipo de tirada",
        content: "<p>Selecciona el tipo de tirada:</p>",
        buttons: {
          normal:   { label: "Normal",  callback: () => safeResolve("normal") },
          critical: { label: "Crítica", callback: () => safeResolve("critical") }
        },
        default: "normal",
        close: () => safeResolve(null)
      }).render(true);
    });
  }

  async _rollSkill(skillKey, label = skillKey) {
    const mode = await this._askRollMode();
    if (!mode) return;

    const baseValRaw = Number(this.actor.system?.skills?.[skillKey] ?? 0);
    const baseVal = Number.isFinite(baseValRaw) ? baseValRaw : 0;

    let situationalBonus = 0;
    if (this.actor.system?.soccerMode) {
      const bonus = await this._promptSkillBonus(label);
      if (bonus === null) return;
      if (Number.isFinite(bonus)) situationalBonus = bonus;
    }

    const threshold = mode === "critical"
      ? Math.ceil(baseVal / 2)
      : baseVal;

    const roll = await (new Roll("1d100")).evaluate({ async: true });
    const adjustedTotal = this.actor.system?.soccerMode
      ? roll.total - situationalBonus
      : roll.total;
    const success = adjustedTotal <= threshold;

    const bonusSign = situationalBonus < 0 ? "+" : "-";
    const bonusText = this.actor.system?.soccerMode && situationalBonus !== 0
      ? ` ${bonusSign} ${Math.abs(situationalBonus)} = ${adjustedTotal}`
      : "";
    const modeNote = this.actor.system?.soccerMode ? " (Modo Futbol)" : "";

    const flavor = `
      <div><strong>Tirada de ${label}</strong> (${mode === "critical" ? "Crítica" : "Normal"})</div>
      <div>Umbral: <b>${threshold}</b> (habilidad: ${baseVal}${modeNote})</div>
      <div>Resultado: <b>${roll.total}</b>${bonusText} → ${
        success ? '<span class="roll-success">Éxito</span>' : '<span class="roll-failure">Fallo</span>'
      }</div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor
    });
  }

  async _promptSkillBonus(skillLabel = "") {
    return await new Promise((resolve) => {
      const safeResolve = onceResolver(resolve);
      const escapedLabel = foundry.utils.escapeHTML(skillLabel);
      const content = `
        <div class="form-group">
          <label>Bono situacional para <b>${escapedLabel}</b>:</label>
          <input type="number" name="bonus" value="0" step="1" />
          <p class="notes">Se aplica al resultado del d100 tras la tirada (Modo Futbol).</p>
        </div>
      `;
      new Dialog({
        title: "Bono situacional",
        content,
        buttons: {
          ok: {
            label: "Aplicar",
            callback: (html) => {
              const element = resolveHTMLElement(html);
              const input = element?.querySelector('input[name="bonus"]');
              const value = Number(input?.value);
              safeResolve(Number.isFinite(value) ? value : 0);
            }
          },
          cancel: { label: "Cancelar", callback: () => safeResolve(null) }
        },
        default: "ok",
        close: () => safeResolve(null)
      }).render(true);
    });
  }

  /* -------------------- Helpers de Input -------------------- */
  async _promptAttackBonus(moveName = "Ataque") {
    return await new Promise((resolve) => {
      const safeResolve = onceResolver(resolve);
      const content = `
        <div class="form-group">
          <label>Bonificador ocasional para <b>${foundry.utils.escapeHTML(moveName)}</b>:</label>
          <input type="number" name="bonus" value="0" step="1" />
          <p class="notes">Se suma al umbral de precisión (puede ser negativo o positivo).</p>
        </div>
      `;
      new Dialog({
        title: "Bonificador de precisión",
        content,
        buttons: {
          ok: {
            label: "Lanzar",
            callback: (html) => {
              const element = resolveHTMLElement(html);
              const input = element?.querySelector('input[name="bonus"]');
              const value = Number(input?.value);
              safeResolve(Number.isFinite(value) ? value : 0);
            }
          },
          cancel: { label: "Cancelar", callback: () => safeResolve(null) }
        },
        default: "ok",
        close: () => safeResolve(null)
      }).render(true);
    });
  }

  async _promptDamageOptions({ itemName, isCrit, hasStab, effectiveness, autoCalculated }) {
    return await new Promise((resolve) => {
      const safeResolve = onceResolver(resolve);
      const effValue = Number.isFinite(effectiveness) ? effectiveness : 1;
      const effNote = autoCalculated
        ? `<p class="notes">Efectividad detectada automáticamente: ×${effValue}</p>`
        : "";
      const effOptions = [
        { value: 1, label: "Normal (x1)" },
        { value: 2, label: "Súper efectivo (x2)" },
        { value: 1.5, label: "Súper efectivo (x1.5)" },
        { value: 0.5, label: "No muy efectivo (x0.5)" },
        { value: 0.25, label: "Muy poco efectivo (x0.25)" },
        { value: 0, label: "Sin efecto (x0)" }
      ];
      const effSelectOptions = effOptions.map(({ value, label }) => {
        const selected = value === effValue ? " selected" : "";
        return `<option value="${value}"${selected}>${label}</option>`;
      }).join("");
      const content = `
        <p class="notes">${hasStab
          ? "El STAB se aplicará automáticamente."
          : "Este movimiento no aplica STAB."}</p>
        ${effNote}
        <div>
          <label>Efectividad:</label>
          <select name="eff">
            ${effSelectOptions}
          </select>
        </div>
        <hr/>
        ${["stat","ability","weather","terrain","enemy"].map(k => `
          <div class="form-group">
            <label>Bono ${k}:</label>
            <select name="${k}-op">
              <option value="+">+</option>
              <option value="*">×</option>
              <option value="/">÷</option>
            </select>
            <input type="number" name="${k}-val" value="0" step="1"/>
          </div>
        `).join("")}
      `;

      new Dialog({
        title: `Opciones de daño: ${foundry.utils.escapeHTML(itemName)}`,
        content,
        buttons: {
          ok: {
            label: "Calcular",
            callback: (html) => {
              const element = resolveHTMLElement(html);
              if (!element) {
                safeResolve(null);
                return;
              }
              const parse = (name) => {
                const input = element.querySelector(`input[name='${name}-val']`);
                const number = Number(input?.value);
                return Number.isFinite(number) ? number : 0;
              };
              const getOp = (name) => {
                const select = element.querySelector(`select[name='${name}-op']`);
                return select?.value ?? "+";
              };
              const effSelect = element.querySelector("select[name='eff']");
              const effParsed = Number(effSelect?.value);
              const selectedEff = Number.isFinite(effParsed) ? effParsed : 1;
              const useAutoEffectiveness =
                autoCalculated && Number.isFinite(effectiveness)
                  ? selectedEff === effectiveness
                  : false;
              safeResolve({
                stab: !!hasStab,
                effectiveness: selectedEff,
                useAutoEffectiveness,
                stat: { op: getOp("stat"), val: parse("stat") },
                ability: { op: getOp("ability"), val: parse("ability") },
                weather: { op: getOp("weather"), val: parse("weather") },
                terrain: { op: getOp("terrain"), val: parse("terrain") },
                enemy: { op: getOp("enemy"), val: parse("enemy") }
              });
            }
          },
          cancel: { label: "Cancelar", callback: () => safeResolve(null) }
        },
        default: "ok",
        close: () => safeResolve(null)
      }).render(true);
    });
  }

  _applyOp(x, op, v) {
    if (!v) return x;
    if (op === "+") return x + v;
    if (op === "*") return x * v;
    if (op === "/") return x / (v || 1);
    return x;
  }

  _getActorTypes() {
    return [
      normalizeTypeValue(this.actor.system?.type1),
      normalizeTypeValue(this.actor.system?.type2)
    ].filter((value) => !!value);
  }

  _getTargetTypes(actor) {
    if (!actor) return [];
    return [
      normalizeTypeValue(actor.system?.type1),
      normalizeTypeValue(actor.system?.type2)
    ].filter((value) => !!value);
  }

  _getTargetActors() {
    const targets = game?.user?.targets;
    if (!targets || targets.size === 0) return [];
    const actors = [];
    const seen = new Set();
    for (const token of targets) {
      const actor = token?.actor ?? token?.document?.actor ?? null;
      if (!actor) continue;
      const key = actor.uuid ?? actor.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      actors.push(actor);
    }
    return actors;
  }

  _getFirstTargetActor() {
    const [first] = this._getTargetActors();
    return first ?? null;
  }

  _moveHasStab(moveType) {
    const normalizedMove = normalizeTypeValue(moveType);
    if (!normalizedMove) return false;
    return this._getActorTypes().some((actorType) => actorType === normalizedMove);
  }

  _getAttackAndDefense(cat, attacker, defender) {
    if (cat === "special") {
      return {
        atkStat: Number(attacker.system?.spAttack ?? 0),
        defStat: Number(defender.system?.spDefense ?? 0),
        atkKey: "Sp.Atk",
        defKey: "Sp.Def"
      };
    }
    return {
      atkStat: Number(attacker.system?.attack ?? 0),
      defStat: Number(defender.system?.defense ?? 0),
      atkKey: "Atk",
      defKey: "Def"
    };
  }

  /* -------------------- Ataque Básico -------------------- */
  async _useBasicAttack() {
    const baseAcc = 75;
    const accBonus = await this._promptAttackBonus("Ataque básico");
    if (accBonus === null) return;

    const globalAccBonus = Number(this.actor.system?.accuracyBonus ?? 0);
    const finalThreshold = baseAcc + accBonus + globalAccBonus;

    const roll = await (new Roll("1d100")).evaluate({ async: true });
    const raw = roll.total;

    const targetActors = this._getTargetActors();
    const baseCritThreshold = 10;
    const attackCritMod = Number(this.actor.system?.critAttackMod ?? 0);
    const isHit = raw < finalThreshold;

    const baseDamageRaw = Number(this.actor.system?.basicattack ?? 0);
    const baseDamage = Number.isFinite(baseDamageRaw) ? baseDamageRaw : 0;

    const applyEntries = [];
    const targetResults = targetActors.map((actor) => {
      const defenderCritMod = Number(actor.system?.critDefenseMod ?? 0);
      const critThreshold = baseCritThreshold + attackCritMod + defenderCritMod;
      const isCritTarget = isHit && raw < critThreshold;
      const name = actor.name ?? "Objetivo";
      const uuid = actor.uuid ?? "";
      let finalDamage = 0;
      if (isHit) {
        let damage = baseDamage;
        if (isCritTarget) damage *= 1.5;
        finalDamage = Math.max(1, Math.ceil(damage));
      }
      const canApply = !!uuid && isHit && finalDamage > 0;
      if (canApply) {
        applyEntries.push({ targetUuid: uuid, damage: finalDamage });
      }
      return {
        name,
        uuid,
        hit: isHit,
        isCrit: isCritTarget,
        effectiveness: 1,
        finalDamage: isHit ? finalDamage : 0,
        canApply
      };
    });

    const accuracyNotesParts = [];
    if (globalAccBonus) {
      accuracyNotesParts.push(`bono global ${globalAccBonus > 0 ? "+" : ""}${globalAccBonus}`);
    }
    if (accBonus) {
      accuracyNotesParts.push(`bono situacional ${accBonus > 0 ? "+" : ""}${accBonus}`);
    }
    const accuracyNotes = accuracyNotesParts.length ? `(${accuracyNotesParts.join(" · ")})` : "";

    const formatEffectiveness = (value) => {
      if (!Number.isFinite(value)) return "—";
      const rounded = Math.round(value * 100) / 100;
      return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
    };

    const targetSections = targetResults.length
      ? targetResults
          .map((result) => {
            const safeName = foundry.utils.escapeHTML(result.name);
            let inner = "";
            if (!result.hit) {
              inner += "<div>Resultado: Fallo</div>";
            } else {
              inner += `<div>Crítico: ${result.isCrit ? "Sí" : "No"}</div>`;
              inner += `<div>Efectividad: ${formatEffectiveness(result.effectiveness)}</div>`;
              inner += `<div>Daño final: <b>${result.finalDamage}</b></div>`;
              if (result.canApply) {
                const safeDamage = foundry.utils.escapeHTML(String(result.finalDamage));
                const safeUuid = foundry.utils.escapeHTML(String(result.uuid));
                inner += `
                  <div class="pmd-damage-actions">
                    <button type="button" data-action="apply-move-damage" data-damage="${safeDamage}" data-target-uuid="${safeUuid}">
                      Aplicar ${safeDamage} de daño a ${safeName}
                    </button>
                  </div>
                `;
              }
            }
            return `<div class="pmd-target-result"><div><strong>${safeName}</strong></div>${inner}</div>`;
          })
          .join("")
      : "<div><em>No hay objetivos seleccionados.</em></div>";

    let applyAllHtml = "";
    if (applyEntries.length > 1) {
      const payload = encodeURIComponent(JSON.stringify(applyEntries));
      const safePayload = foundry.utils.escapeHTML(payload);
      applyAllHtml = `
        <div class="pmd-damage-actions">
          <button type="button" data-action="apply-move-damage-all" data-targets="${safePayload}">
            Aplicar a todos
          </button>
        </div>
      `;
    }

    const overallCrit = targetResults.some((result) => result.isCrit);
    const checkText = isHit ? '<span class="roll-success">ACIERTO</span>' : '<span class="roll-failure">FALLO</span>';
    const critText = isHit && overallCrit ? " · <b>CRÍTICO</b>" : "";

    const flavor = `
      <div><strong>Ataque básico</strong></div>
      <div><small>Sin tipo · sin bonificadores de daño</small></div>
      <hr/>
      <div>Precisión base: <b>${baseAcc}</b> ${accuracyNotes}</div>
      <div>Umbral final: <b>${finalThreshold}</b></div>
      <div>d100: <b>${raw}</b></div>
      <div>Chequeo: ${checkText}${critText}</div>
      ${targetSections}
      ${applyAllHtml}
    `;

    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor });
  }

  /* -------------------- Tirada de Movimiento -------------------- */
  async _useMove(item) {
    // Verificar PP
    const curPP = Number(item.system?.pp?.value ?? 0);
    const maxPP = Number(item.system?.pp?.max ?? 0);
    if (curPP <= 0) {
      ui.notifications.warn(`"${item.name}" no tiene PP disponibles.`);
      return;
    }

    // Precisión
    const accBonus = await this._promptAttackBonus(item.name ?? "Ataque");
    if (accBonus === null) return;
    const baseAcc = Number(item.system?.accuracy ?? 0);
    const globalAccBonus = Number(this.actor.system?.accuracyBonus ?? 0);
    const finalThreshold = baseAcc + accBonus + globalAccBonus;

    // Tirada d100
    const roll = await (new Roll("1d100")).evaluate({ async: true });
    const raw = roll.total;
    const targetActors = this._getTargetActors();
    const targetActor = targetActors[0] ?? null;
    const baseCritThreshold = 10;
    const attackCritMod = Number(this.actor.system?.critAttackMod ?? 0);
    const moveCritMod = Number(item.system?.critThresholdMod ?? 0);
    const primaryDefenderCritMod = targetActor ? Number(targetActor.system?.critDefenseMod ?? 0) : 0;
    const primaryCritThreshold = baseCritThreshold + attackCritMod + primaryDefenderCritMod + moveCritMod;
    const isHit = raw < finalThreshold;

    // Gastar PP
    await item.update({ "system.pp.value": Math.max(0, curPP - 1) });

    // Info básica
    const cat  = item.system?.category ?? "";
    const elem = item.system?.element ?? "";
    const rng  = item.system?.range ?? "";
    const effTxt = item.system?.effect ?? "";
    const baseDmg = Number(item.system?.baseDamage ?? 0);
    const target = targetActor;
    const canDealDamage = cat !== "status";
    const canCalcMultiDamage = !!target && canDealDamage;

    const normalizedMove = normalizeTypeValue(elem);
    const targetEffectivenessMap = new Map();
    for (const actor of targetActors) {
      const key = actor.uuid ?? actor.id;
      if (!key) continue;
      const defenderTypes = this._getTargetTypes(actor);
      const autoEffect = normalizedMove && defenderTypes.length > 0
        ? calculateTypeEffectiveness(normalizedMove, defenderTypes)
        : null;
      const multiplier = Number.isFinite(autoEffect?.multiplier) ? autoEffect.multiplier : null;
      targetEffectivenessMap.set(key, { multiplier });
    }
    const primaryKey = target ? target.uuid ?? target.id : null;
    const primaryAuto = primaryKey ? targetEffectivenessMap.get(primaryKey) : null;
    const autoEffectiveness = Number.isFinite(primaryAuto?.multiplier) ? primaryAuto.multiplier : null;

    const canPromptDamage = targetActors.length > 0 && isHit && canDealDamage;
    const hasStab = this._moveHasStab(elem);
    let damageOptions = null;
    if (canPromptDamage) {
      damageOptions = await this._promptDamageOptions({
        itemName: item.name,
        isCrit: isHit && raw < primaryCritThreshold,
        hasStab,
        effectiveness: autoEffectiveness,
        autoCalculated: Number.isFinite(autoEffectiveness)
      });
    }

    const targetResults = targetActors.map((actor) => {
      const key = actor.uuid ?? actor.id ?? "";
      const autoInfo = key ? targetEffectivenessMap.get(key) : null;
      const autoMultiplier = Number.isFinite(autoInfo?.multiplier) ? autoInfo.multiplier : null;
      let effectiveness = null;
      if (damageOptions) {
        if (damageOptions.useAutoEffectiveness && Number.isFinite(autoMultiplier)) {
          effectiveness = autoMultiplier;
        } else {
          effectiveness = damageOptions.effectiveness;
        }
      } else {
        effectiveness = autoMultiplier;
      }
      const resolvedEffectiveness = Number.isFinite(effectiveness)
        ? effectiveness
        : damageOptions && canDealDamage
          ? 1
          : effectiveness;
      const isImmune = canDealDamage && Number.isFinite(resolvedEffectiveness) && resolvedEffectiveness === 0;
      const defenderCritMod = Number(actor.system?.critDefenseMod ?? 0);
      const critThreshold = baseCritThreshold + attackCritMod + defenderCritMod + moveCritMod;
      const isCritTarget = isHit && raw < critThreshold;
      let finalDamage = 0;
      let canCalculateDamage = false;
      if (isHit && damageOptions && canDealDamage && !isImmune) {
        const { atkStat, defStat } = this._getAttackAndDefense(cat, this.actor, actor);
        let dmg = baseDmg + atkStat;
        dmg = this._applyOp(dmg, damageOptions.stat.op, damageOptions.stat.val);
        dmg = this._applyOp(dmg, damageOptions.ability.op, damageOptions.ability.val);
        if (damageOptions.stab) dmg += Number(this.actor.system?.stab ?? 0);
        const effValue = Number.isFinite(resolvedEffectiveness) ? resolvedEffectiveness : 1;
        dmg *= effValue;
        if (isCritTarget) dmg *= 1.5;
        dmg = this._applyOp(dmg, damageOptions.weather.op, damageOptions.weather.val);
        dmg = this._applyOp(dmg, damageOptions.terrain.op, damageOptions.terrain.val);
        dmg = this._applyOp(dmg, damageOptions.enemy.op, damageOptions.enemy.val);
        dmg -= defStat;
        finalDamage = Math.max(1, Math.ceil(dmg));
        canCalculateDamage = true;
      }
      return {
        name: actor.name ?? "Objetivo",
        uuid: actor.uuid ?? "",
        hit: isHit,
        isCrit: canDealDamage ? isCritTarget : false,
        effectiveness: Number.isFinite(resolvedEffectiveness) ? resolvedEffectiveness : null,
        isImmune,
        finalDamage: isHit && canDealDamage ? finalDamage : 0,
        canCalculateDamage
      };
    });

    const sanitizeDie = (value) => {
      const die = String(value ?? "").toLowerCase();
      return /^d\d+$/.test(die) ? die : null;
    };

    let extraRollHTML = "";
    const extraRolls =
      typeof item.system?.extraRolls === "object" && !Array.isArray(item.system.extraRolls)
        ? item.system.extraRolls
        : null;
    if (extraRolls?.enabled) {
      const quantity = Math.max(0, Math.round(Number(extraRolls.quantity ?? 0)));
      const die = sanitizeDie(extraRolls.die);
      if (quantity > 0 && die) {
        const formula = `${quantity}${die}`;
        const extraRoll = await (new Roll(formula)).evaluate({ async: true });
        const extraMessage = foundry.utils.escapeHTML(String(extraRolls.message ?? ""));
        const extraRollRendered = await extraRoll.render();
        const safeFormula = foundry.utils.escapeHTML(formula);
        extraRollHTML = `
          <hr/>
          <div><strong>Tiradas adicionales (${safeFormula})</strong></div>
          ${extraMessage ? `<div>${extraMessage}</div>` : ""}
          ${extraRollRendered}
        `;
      }
    }

    const primaryResult = targetResults[0] ?? null;
    let multiAttackHTML = "";
    let multiDamageTotal = 0;
    const multiAttack =
      typeof item.system?.multiAttack === "object" && !Array.isArray(item.system.multiAttack)
        ? item.system.multiAttack
        : null;
    if (multiAttack?.enabled) {
      const die = sanitizeDie(multiAttack.die);
      if (die) {
        const dieFormula = `1${die}`;
        const multiRoll = await (new Roll(dieFormula)).evaluate({ async: true });
        const additionalAttacks = Math.max(0, Math.floor(Number(multiRoll.total ?? 0)));
        const entries = [];
        let stoppedEarly = false;
        const primaryImmune = Boolean(primaryResult?.isImmune);
        const primaryCanCalculate = Boolean(primaryResult?.canCalculateDamage);
        for (let i = 0; i < additionalAttacks; i++) {
          const accRoll = await (new Roll("1d100")).evaluate({ async: true });
          const total = accRoll.total;
          const hit = total < finalThreshold;
          const critExtra = total < primaryCritThreshold;
          const damage = hit && canCalcMultiDamage && primaryCanCalculate && !primaryImmune && baseDmg > 0 ? baseDmg : 0;
          if (damage > 0) {
            multiDamageTotal += damage;
          }
          entries.push({ roll: accRoll, hit, crit: critExtra, damage });
          if (!hit) {
            stoppedEarly = true;
            break;
          }
        }
        const multiRollHTML = await multiRoll.render();
        const entriesHTML = entries.length
          ? entries
              .map((entry, index) => {
                const rollValue = foundry.utils.escapeHTML(String(entry.roll.total ?? "-"));
                const hitText = entry.hit
                  ? `<span class="roll-success">ACIERTO${entry.crit ? " · CRÍTICO" : ""}</span>`
                  : '<span class="roll-failure">FALLO</span>';
                const damageText = entry.hit
                  ? entry.damage > 0
                    ? ` · Daño base: <b>${entry.damage}</b>`
                    : " · Sin daño adicional"
                  : "";
                return `<div>Ataque adicional ${index + 1}: d100 = <b>${rollValue}</b> → ${hitText}${damageText}</div>`;
              })
              .join("")
          : "<div>Sin ataques adicionales.</div>";
        const totalLine = multiDamageTotal > 0 ? `<div><b>Daño adicional total: ${multiDamageTotal}</b></div>` : "";
        const countLine = `<div>Ataques adicionales: <b>${additionalAttacks}</b></div>`;
        const stoppedLine = stoppedEarly ? "<div>El multiataque se detuvo tras un fallo.</div>" : "";
        const safeDieFormula = foundry.utils.escapeHTML(dieFormula);
        multiAttackHTML = `
          <hr/>
          <div><strong>Multiataque (${safeDieFormula})</strong></div>
          ${countLine}
          ${multiRollHTML}
          ${entriesHTML}
          ${stoppedLine}
          ${totalLine}
        `;
      }
    }

    const accuracyNotesParts = [];
    if (globalAccBonus) {
      accuracyNotesParts.push(`bono global ${globalAccBonus > 0 ? "+" : ""}${globalAccBonus}`);
    }
    if (accBonus) {
      accuracyNotesParts.push(`bono situacional ${accBonus > 0 ? "+" : ""}${accBonus}`);
    }
    const accuracyNotes = accuracyNotesParts.length ? `(${accuracyNotesParts.join(" · ")})` : "";
    if (multiDamageTotal > 0) {
      for (const result of targetResults) {
        if (!result.hit) continue;
        if (!result.canCalculateDamage) continue;
        if (result.isImmune) continue;
        result.finalDamage += multiDamageTotal;
      }
    }

    const formatEffectiveness = (value) => {
      if (!Number.isFinite(value)) return "—";
      const rounded = Math.round(value * 100) / 100;
      return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
    };

    const applyEntries = targetResults
      .filter((result) => result.hit && result.finalDamage > 0 && result.uuid)
      .map((result) => ({ targetUuid: result.uuid, damage: result.finalDamage }));

    const targetSections = targetResults.length
      ? targetResults
          .map((result) => {
            const safeName = foundry.utils.escapeHTML(result.name);
            if (!result.hit) {
              return `<div class="pmd-target-result"><div><strong>${safeName}</strong></div><div>Resultado: Fallo</div></div>`;
            }
            const critText = canDealDamage ? (result.isCrit ? "Sí" : "No") : "—";
            const effectivenessText = canDealDamage && Number.isFinite(result.effectiveness)
              ? formatEffectiveness(result.effectiveness)
              : canDealDamage
                ? "—"
                : "—";
            let inner = `
              <div>Crítico: ${critText}</div>
              <div>Efectividad: ${effectivenessText}</div>
            `;
            if (!canDealDamage) {
              inner += "<div>Daño final: —</div>";
            } else if (result.isImmune) {
              inner += "<div>Daño final: 0</div>";
              inner += "<div>Objetivo inmune.</div>";
            } else {
              inner += `<div>Daño final: <b>${result.finalDamage}</b></div>`;
            }
            if (result.finalDamage > 0 && result.uuid) {
              const safeDamage = foundry.utils.escapeHTML(String(result.finalDamage));
              const safeUuid = foundry.utils.escapeHTML(String(result.uuid));
              inner += `
                <div class="pmd-damage-actions">
                  <button type="button" data-action="apply-move-damage" data-damage="${safeDamage}" data-target-uuid="${safeUuid}">
                    Aplicar ${safeDamage} de daño a ${safeName}
                  </button>
                </div>
              `;
            }
            return `<div class="pmd-target-result"><div><strong>${safeName}</strong></div>${inner}</div>`;
          })
          .join("")
      : "<div><em>No hay objetivos seleccionados.</em></div>";

    let applyAllHtml = "";
    if (applyEntries.length > 1) {
      const payload = encodeURIComponent(JSON.stringify(applyEntries));
      const safePayload = foundry.utils.escapeHTML(payload);
      applyAllHtml = `
        <div class="pmd-damage-actions">
          <button type="button" data-action="apply-move-damage-all" data-targets="${safePayload}">
            Aplicar a todos
          </button>
        </div>
      `;
    }

    const overallCrit = canDealDamage ? targetResults.some((result) => result.isCrit) : false;
    const checkText = isHit ? '<span class="roll-success">ACIERTO</span>' : '<span class="roll-failure">FALLO</span>';
    const critSuffix = isHit && overallCrit ? " · <b>CRÍTICO</b>" : "";

    const flavor = `
      <div><strong>Usa Movimiento:</strong> ${foundry.utils.escapeHTML(item.name)}</div>
      <div><small>${elem ? `Tipo: ${elem} · ` : ""}${cat ? `Categoría: ${cat}` : ""}${rng ? ` · Rango: ${rng}` : ""}</small></div>
      <hr/>
      <div>Precisión base: <b>${baseAcc}</b> ${accuracyNotes}</div>
      <div>Umbral final: <b>${finalThreshold}</b></div>
      <div>Umbral crítico (objetivo primario): <b>${primaryCritThreshold}</b></div>
      <div>d100: <b>${raw}</b></div>
      <div>Chequeo: ${checkText}${critSuffix}</div>
      ${effTxt ? `<hr/><div><em>Efecto:</em> ${effTxt}</div>` : ""}
      ${targetSections}
      ${applyAllHtml}
      ${extraRollHTML}
      ${multiAttackHTML}
    `;

    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor });
  }

  _formatText(text) {
    const str = String(text ?? "").trim();
    if (!str) return "";
    return foundry.utils.escapeHTML(str).replace(/\n/g, "<br/>");
  }

  async _consumeItem(item) {
    const quantity = Number(item.system?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      ui.notifications?.warn(`No quedan usos de "${item.name}".`);
      return;
    }

    const newQuantity = Math.max(0, quantity - 1);
    const itemUuid = item.uuid ?? null;
    const trapData =
      typeof item.system?.trap === "object" && !Array.isArray(item.system?.trap) ? item.system.trap : {};
    const trapEnabled = trapData?.enabled === true;
    const trapDescription = trapEnabled ? this._formatText(trapData?.description ?? "") : "";
    const effectText = trapEnabled && trapDescription
      ? trapDescription
      : this._formatText(item.system?.effect ?? "");
    const itemName = foundry.utils.escapeHTML(item.name ?? "Objeto");
    const actorName = foundry.utils.escapeHTML(this.actor.name ?? "Personaje");

    const rawPermanentEffects = Array.isArray(item.system?.permanentEffects)
      ? item.system.permanentEffects
      : [];

    const legacyPermanentEffect =
      typeof item.system?.permanentEffect === "object" &&
      item.system?.permanentEffect !== null &&
      !Array.isArray(item.system?.permanentEffect)
        ? item.system.permanentEffect
        : null;

    const effectSources = rawPermanentEffects.length
      ? rawPermanentEffects
      : legacyPermanentEffect
      ? [legacyPermanentEffect]
      : [];

    const permanentEffects = [];
    for (const effect of effectSources) {
      if (!effect || typeof effect !== "object" || Array.isArray(effect)) continue;
      const attributeKey = String(effect.attribute ?? "");
      const attributeConfig = CONSUMABLE_PERMANENT_ATTRIBUTE_CONFIG[attributeKey];
      if (!attributeConfig) continue;
      const amountValue = Number(effect.amount ?? 0);
      if (!Number.isFinite(amountValue) || amountValue <= 0) continue;
      const mode = effect.mode === "subtract" ? "subtract" : "add";
      permanentEffects.push({
        attributeConfig,
        amount: Math.abs(amountValue),
        mode,
      });
    }

    const getProperty =
      foundry?.utils?.getProperty ??
      ((object, path) => {
        if (!object || typeof path !== "string") return undefined;
        return path
          .split(".")
          .reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), object);
      });

    const actorSource = this.actor?._source ?? {};
    const baseValueCache = new Map();
    const readBaseValue = (path) => {
      if (baseValueCache.has(path)) return baseValueCache.get(path);
      const baseValueRaw = getProperty(actorSource, path);
      const baseValue = Number(baseValueRaw);
      const safeBase = Number.isFinite(baseValue) ? baseValue : 0;
      baseValueCache.set(path, safeBase);
      return safeBase;
    };

    const permanentUpdates = {};
    const permanentMessages = [];
    let hasPermanentUpdates = false;

    for (const effect of permanentEffects) {
      const { attributeConfig, amount, mode } = effect;
      const safeBase = readBaseValue(attributeConfig.path);
      const signedDelta = mode === "subtract" ? -amount : amount;

      let newValue = safeBase + signedDelta;
      if (typeof attributeConfig.clamp === "function") {
        newValue = attributeConfig.clamp(newValue, this.actor);
      }

      if (!Number.isFinite(newValue)) {
        baseValueCache.set(attributeConfig.path, safeBase);
        continue;
      }

      baseValueCache.set(attributeConfig.path, newValue);

      if (!Object.is(newValue, safeBase)) {
        permanentUpdates[attributeConfig.path] = newValue;
        hasPermanentUpdates = true;

        const actualDelta = newValue - safeBase;
        const deltaText = `${actualDelta >= 0 ? "+" : ""}${actualDelta}`;
        const finalValue = newValue;
        permanentMessages.push(`<div><strong>${attributeConfig.label}:</strong> ${deltaText} (ahora ${finalValue})</div>`);
      }

      if (typeof attributeConfig.afterUpdate === "function") {
        const additional = attributeConfig.afterUpdate(newValue, this.actor);
        if (additional && typeof additional === "object") {
          for (const [path, value] of Object.entries(additional)) {
            permanentUpdates[path] = value;
            hasPermanentUpdates = true;
          }
        }
      }
    }

    const permanentMessage = permanentMessages.length ? permanentMessages.join("") : null;

    const effectsToCreate = (item.effects?.contents ?? [])
      .filter((effect) => {
        if (!effect) return false;
        const source = effect._source ?? {};
        if (source.disabled === true) return false;
        return source.transfer !== false;
      })
      .map((effect) => {
        const data = typeof effect.toObject === "function" ? effect.toObject() : effect;
        if (!data) return null;
        let clone;
        if (foundry?.utils?.duplicate) {
          clone = foundry.utils.duplicate(data);
        } else if (typeof structuredClone === "function") {
          clone = structuredClone(data);
        } else {
          try {
            clone = JSON.parse(JSON.stringify(data));
          } catch (err) {
            clone = { ...data };
          }
        }
        if (!clone) return null;
        delete clone._id;
        clone.origin = clone.origin || itemUuid;
        clone.transfer = false;
        clone.disabled = false;
        if (clone.duration) {
          delete clone.duration.startTime;
          delete clone.duration.startRound;
          delete clone.duration.startTurn;
          delete clone.duration.combat;
        }
        if (!clone.name && item.name) {
          clone.name = item.name;
        }
        return clone;
      })
      .filter((data) => data !== null);

    if (newQuantity > 0) {
      await item.update({ "system.quantity": newQuantity });
    } else {
      await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
    }

    if (effectsToCreate.length) {
      await this.actor.createEmbeddedDocuments("ActiveEffect", effectsToCreate);
    }

    if (hasPermanentUpdates) {
      await this.actor.update(permanentUpdates);
    }

    const parts = [`<div><strong>${actorName}</strong> consumió ${itemName}.</div>`];
    if (effectText) parts.push(`<div><strong>Efecto:</strong> ${effectText}</div>`);
    if (permanentMessage) parts.push(permanentMessage);
    if (newQuantity > 0) parts.push(`<div>Restantes: ${newQuantity}</div>`);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: parts.join(""),
    });
  }

  async _useGearItem(item) {
    const trapData =
      typeof item.system?.trap === "object" && !Array.isArray(item.system?.trap) ? item.system.trap : {};
    const trapEnabled = trapData?.enabled === true;
    const trapDescription = trapEnabled ? this._formatText(trapData?.description ?? "") : "";
    const description = trapEnabled && trapDescription
      ? trapDescription
      : this._formatText(item.system?.description ?? "");
    const itemName = foundry.utils.escapeHTML(item.name ?? "Objeto");
    const actorName = foundry.utils.escapeHTML(this.actor.name ?? "Personaje");

    const parts = [`<div><strong>${actorName}</strong> utilizó ${itemName}.</div>`];
    if (description) {
      parts.push(`<div><strong>Descripción:</strong> ${description}</div>`);
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: parts.join(""),
    });
  }
}

