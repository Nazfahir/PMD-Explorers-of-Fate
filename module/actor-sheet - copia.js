// module/actor-sheet.js
export class MyActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["PMD-Explorers-of-Fate", "sheet", "actor"],
      template: "systems/PMD-Explorers-of-Fate/templates/actor-sheet.hbs",
      width: 500,
      height: 600,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }],
      submitOnChange: true,  // guarda automáticamente al cambiar
      closeOnSubmit: false
    });
  }

  /** @override */
  getData(options) {
    const data = super.getData(options);
    data.system = this.actor.system;

    // Lista de habilidades para iterar en la plantilla
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

    // Límites de UI (coinciden con tu clamp del actor)
    data.skillMin = 15;
    data.skillMax = 95;

    // Movimientos del actor (para la pestaña "Movimientos")
    data.moves = this.actor.items
      .filter(i => i.type === "move")
      .sort((a, b) => a.name.localeCompare(b.name));

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // ===== Tiradas de Habilidades =====
    html.find("[data-action='roll-skill']").on("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const el = ev.currentTarget;
      const key = el.dataset.skill;
      const label = el.dataset.label ?? key;
      this._rollSkill(key, label);
    });

    // ===== Gestión de Movimientos =====

    // Crear movimiento desde la ficha
    html.find("[data-action='create-move']").on("click", async (ev) => {
      ev.preventDefault();
      const created = await this.actor.createEmbeddedDocuments("Item", [{
        name: "Nuevo Movimiento",
        type: "move",
        system: {} // usa defaults del template.json
      }]);
      created?.[0]?.sheet?.render(true);
    });

    // Editar movimiento
    html.find("[data-action='edit-move']").on("click", (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(id);
      item?.sheet?.render(true);
    });

    // Eliminar movimiento
    html.find("[data-action='delete-move']").on("click", async (ev) => {
      ev.preventDefault();
      const li = ev.currentTarget.closest("[data-item-id]");
      const id = li?.dataset.itemId;
      if (!id) return;
      await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // === USAR movimiento (tirada de precisión con bono + gasto de PP) ===
    html.find("[data-action='use-move']").on("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const li = ev.currentTarget.closest("[data-item-id]");
      const id = li?.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      await this._useMove(item);
    });
  }

  /**
   * Pregunta "Normal" o "Crítica" y devuelve 'normal' | 'critical' o null si cancelan. (Para skills)
   */
  async _askRollMode() {
    return await new Promise((resolve) => {
      new Dialog({
        title: "Tipo de tirada",
        content: "<p>Selecciona el tipo de tirada:</p>",
        buttons: {
          normal:   { label: "Normal",  callback: () => resolve("normal") },
          critical: { label: "Crítica", callback: () => resolve("critical") }
        },
        default: "normal",
        close: () => resolve(null)
      }).render(true);
    });
  }

  /**
   * Realiza la tirada 1d100 de HABILIDAD y publica el resultado en el chat.
   * Éxito si (resultado < umbral). En crítica el umbral es ceil(skill/2).
   */
  async _rollSkill(skillKey, label = skillKey) {
    const mode = await this._askRollMode();
    if (!mode) return; // cancelaron el diálogo

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

  /**
   * Pide un bono numérico (puede ser negativo) para ataques.
   * Devuelve un Number (default 0) o null si cancelan.
   */
  async _promptAttackBonus(moveName = "Ataque") {
    return await new Promise((resolve) => {
      let bonus = 0;

      const content = `
        <div class="form-group">
          <label>Bonificador de Precision para <b>${foundry.utils.escapeHTML(moveName)}</b>:</label>
          <input type="number" name="bonus" value="0" step="1" />
          <p class="notes">Puedes usar valores negativos (ej.: -10) o positivos (ej.: 5).</p>
        </div>
      `;

      new Dialog({
        title: "Bonificador de ataque",
        content,
        buttons: {
          ok: {
            label: "Lanzar",
            callback: (html) => {
              const raw = html.find('input[name="bonus"]').val();
              const n = Number(raw);
              if (Number.isFinite(n)) bonus = n;
              resolve(bonus);
            }
          },
          cancel: { label: "Cancelar", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }).render(true);
    });
  }

  /**
   * Usa un movimiento:
   * - Verifica PP > 0
   * - Pide bono
   * - Tira 1d100
   * - Determina crítico (raw < 10) y acierto (raw+bono < accuracy)
   * - Gasta 1 PP SIEMPRE que se usa (acierte o no)
   */
async _useMove(item) {
  // 1) Verificar PP disponible
  const curPP = Number(item.system?.pp?.value ?? 0);
  const maxPP = Number(item.system?.pp?.max ?? 0);
  if (curPP <= 0) {
    ui.notifications.warn(`"${item.name}" no tiene PP disponibles.`);
    return;
  }

  // 2) Pide el bono
  const bonus = await this._promptAttackBonus(item.name ?? "Ataque");
  if (bonus === null) return; // cancelado
  const bonusNum = Number(bonus || 0);

  // 3) Umbral de precisión (con bono aplicado al UMBRAL)
  const baseAcc = Number(item.system?.accuracy ?? 0);
  const finalThreshold = baseAcc + bonusNum;

  // 4) Tirada d100
  const roll = await (new Roll("1d100")).evaluate({ async: true });
  const raw = roll.total;            // resultado del dado SIN bono
  const isCrit = raw < 10;           // crítico si resultado crudo < 10
  const isHit  = raw < finalThreshold; // acierta si crudo < (accuracy + bono)

  // 5) Gasto de PP (siempre que se usa el movimiento)
  const newPP = Math.max(0, curPP - 1);
  await item.update({ "system.pp.value": newPP });

  // 6) Info auxiliar
  const cat  = item.system?.category ?? "";
  const elem = item.system?.element ?? "";
  const rng  = item.system?.range ?? "";
  const eff  = item.system?.effect ?? "";
  const baseDmg = Number(item.system?.baseDamage ?? 0);

  // 7) Mensaje al chat
  const flavor = `
    <div><strong>Usa Movimiento:</strong> ${foundry.utils.escapeHTML(item.name)}</div>
    <div><small>${elem ? `Tipo: ${foundry.utils.escapeHTML(elem)} · ` : ""}${cat ? `Categoría: ${foundry.utils.escapeHTML(cat)}` : ""}${rng ? ` · Rango: ${foundry.utils.escapeHTML(rng)}` : ""}</small></div>
    <hr/>
    <div>Precisión base: <b>${baseAcc}</b>${bonusNum ? ` &nbsp;(bono ${bonusNum > 0 ? "+" : ""}${bonusNum})` : ""}</div>
    <div>Umbral final: <b>${finalThreshold}</b></div>
    <div>d100: <b>${raw}</b></div>
    <div>Chequeo: ${
      isHit ? '<span class="roll-success">ACIERTO</span>' : '<span class="roll-failure">FALLO</span>'
    } ${isCrit ? ' · <b>CRÍTICO</b>' : ''}</div>
    ${eff ? `<hr/><div><em>Efecto:</em> ${foundry.utils.escapeHTML(eff)}</div>` : ""}
    <hr/>
    <div><small>PP: ${newPP}/${maxPP} (−1 gastado)</small></div>
    <div><small>Daño base: ${baseDmg}${isCrit ? " · (Crítico)" : ""}</small></div>
  `;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    flavor
  });
}
}
