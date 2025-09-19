// module/init.js
import { MyActor } from "./actor.js";
import { MyActorSheet } from "./actor-sheet.js";
import { PMDItem } from "./item.js";
import { PMDItemSheet } from "./item-sheet.js";

Hooks.once("init", function () {
  console.log("PMD-Explorers-of-Fate | Inicializando sistema básico");

  // Registrar clases de documento
  CONFIG.Actor.documentClass = MyActor;

  // Registrar hoja por defecto para nuestro tipo
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("PMD-Explorers-of-Fate", MyActorSheet, {
    types: ["creature"],
    makeDefault: true,
    label: "Hoja de Criatura (Básica)"
  });

  // Items (movimientos y objetos)
  CONFIG.Item.documentClass = PMDItem;
  Items.registerSheet("PMD-Explorers-of-Fate", PMDItemSheet, {
    types: ["move", "equipment", "consumable", "gear"],
    makeDefault: true,
    label: "Objeto PMD"
  });
});

Hooks.once("ready", function () {
  console.log("PMD-Explorers-of-Fate | Listo");
});