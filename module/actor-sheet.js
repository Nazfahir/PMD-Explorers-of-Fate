// module/actor-sheet.js
import {
  TYPE_OPTIONS,
  normalizeTypeValue,
  typeIndexFromValue
} from "./pokemon-types.js";
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
  }

  async _restoreActorResources() {
    const actorUpdates = {};
    const maxHP = Number(this.actor.system?.hp?.max);
    if (Number.isFinite(maxHP)) {
      actorUpdates["system.hp.value"] = Math.max(0, maxHP);
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

    const val = Number(this.actor.system?.skills?.[skillKey] ?? 0);
    const threshold = mode === "critical" ? Math.ceil(val / 2) : val;

    const roll = await (new Roll("1d100")).evaluate({ async: true });
    const success = roll.total < threshold;

    const flavor = `
      <div><strong>Tirada de ${label}</strong> (${mode === "critical" ? "Crítica" : "Normal"})</div>
      <div>Umbral: <b>${threshold}</b> (habilidad: ${val})</div>
      <div>Resultado: <b>${roll.total}</b> → ${
        success ? '<span class="roll-success">Éxito</span>' : '<span class="roll-failure">Fallo</span>'
      }</div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor
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

  async _promptDamageOptions({ itemName, isCrit, hasStab }) {
    return await new Promise((resolve) => {
      const safeResolve = onceResolver(resolve);
      const content = `
        <p class="notes">${hasStab
          ? "El STAB se aplicará automáticamente."
          : "Este movimiento no aplica STAB."}</p>
        <div>
          <label>Efectividad:</label>
          <select name="eff">
            <option value="1">Normal (x1)</option>
            <option value="1.5">Súper efectivo (x1.5)</option>
            <option value="2">Súper efectivo (x2)</option>
            <option value="0.5">No muy efectivo (x0.5)</option>
            <option value="0.25">Muy poco efectivo (x0.25)</option>
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
              const effValue = Number(effSelect?.value);
              safeResolve({
                stab: !!hasStab,
                effectiveness: Number.isFinite(effValue) ? effValue : 1,
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
    const finalThreshold = baseAcc + accBonus;

    // Tirada d100
    const roll = await (new Roll("1d100")).evaluate({ async: true });
    const raw = roll.total;
    const isCrit = raw < 10;
    const isHit = raw < finalThreshold;

    // Gastar PP
    await item.update({ "system.pp.value": Math.max(0, curPP - 1) });

    // Info básica
    const cat  = item.system?.category ?? "";
    const elem = item.system?.element ?? "";
    const rng  = item.system?.range ?? "";
    const effTxt = item.system?.effect ?? "";
    const baseDmg = Number(item.system?.baseDamage ?? 0);

    const targets = Array.from(game.user?.targets ?? []);
    const target = targets[0]?.actor ?? null;
    const canCalc = !!target && isHit && cat !== "status";

    let dmgBreakdownHTML = "";

    if (canCalc) {
      const hasStab = this._moveHasStab(elem);
      const opts = await this._promptDamageOptions({ itemName: item.name, isCrit, hasStab });
      if (opts) {
        const { atkStat, defStat, atkKey, defKey } = this._getAttackAndDefense(cat, this.actor, target);

        let dmg = baseDmg + atkStat;
        dmg = this._applyOp(dmg, opts.stat.op, opts.stat.val);
        dmg = this._applyOp(dmg, opts.ability.op, opts.ability.val);
        if (opts.stab) dmg += Number(this.actor.system?.stab ?? 0);
        dmg *= opts.effectiveness;
        if (isCrit) dmg *= 1.5;
        dmg = this._applyOp(dmg, opts.weather.op, opts.weather.val);
        dmg = this._applyOp(dmg, opts.terrain.op, opts.terrain.val);
        dmg = this._applyOp(dmg, opts.enemy.op, opts.enemy.val);
        dmg -= defStat;

        const finalDamage = Math.max(1, Math.ceil(dmg));

        dmgBreakdownHTML = `
          <hr/>
          <div><b>Cálculo de Daño</b></div>
          <div>Base (${baseDmg}) + ${atkKey}: <b>${baseDmg + atkStat}</b></div>
          <div>Bonif. Estadística: ${opts.stat.op} ${opts.stat.val}</div>
          <div>Bonif. Habilidad: ${opts.ability.op} ${opts.ability.val}${opts.stab ? ` + STAB (${this.actor.system?.stab ?? 0})` : ""}</div>
          <div>Efectividad: ×${opts.effectiveness}</div>
          <div>Crítico: ${isCrit ? "Sí (×1.5)" : "No"}</div>
          <div>Clima: ${opts.weather.op} ${opts.weather.val}</div>
          <div>Terreno: ${opts.terrain.op} ${opts.terrain.val}</div>
          <div>Enemigo: ${opts.enemy.op} ${opts.enemy.val}</div>
          <div>− ${defKey}: <b>${defStat}</b></div>
          <div><b>Daño final: ${finalDamage}</b> <small>(redondeo ↑, mínimo 1)</small></div>
        `;
      }
    }

    // Mensaje en chat
    const flavor = `
      <div><strong>Usa Movimiento:</strong> ${foundry.utils.escapeHTML(item.name)}</div>
      <div><small>${elem ? `Tipo: ${elem} · ` : ""}${cat ? `Categoría: ${cat}` : ""}${rng ? ` · Rango: ${rng}` : ""}</small></div>
      <hr/>
      <div>Precisión base: <b>${baseAcc}</b> ${accBonus ? `(bono ${accBonus > 0 ? "+" : ""}${accBonus})` : ""}</div>
      <div>Umbral final: <b>${finalThreshold}</b></div>
      <div>d100: <b>${raw}</b></div>
      <div>Chequeo: ${isHit ? '<span class="roll-success">ACIERTO</span>' : '<span class="roll-failure">FALLO</span>'} ${isCrit ? '· <b>CRÍTICO</b>' : ''}</div>
      ${effTxt ? `<hr/><div><em>Efecto:</em> ${effTxt}</div>` : ""}
      ${dmgBreakdownHTML}
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
    const effectText = this._formatText(item.system?.effect ?? "");
    const itemName = foundry.utils.escapeHTML(item.name ?? "Objeto");
    const actorName = foundry.utils.escapeHTML(this.actor.name ?? "Personaje");

    if (newQuantity > 0) {
      await item.update({ "system.quantity": newQuantity });
    } else {
      await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
    }

    const parts = [`<div><strong>${actorName}</strong> consumió ${itemName}.</div>`];
    if (effectText) parts.push(`<div><strong>Efecto:</strong> ${effectText}</div>`);
    if (newQuantity > 0) parts.push(`<div>Restantes: ${newQuantity}</div>`);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: parts.join(""),
    });
  }

  async _useGearItem(item) {
    const description = this._formatText(item.system?.description ?? "");
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

