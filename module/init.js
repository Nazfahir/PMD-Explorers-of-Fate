// module/init.js
import { MyActor } from "./actor.js";
import { MyActorSheet } from "./actor-sheet.js";
import { MoveItem } from "./item.js";
import { MoveItemSheet } from "./item-sheet.js";

Hooks.once("init", function () {
  console.log("my-basic-system | Inicializando sistema básico");

  // Registrar clases de documento
  CONFIG.Actor.documentClass = MyActor;

  // Registrar hoja por defecto para nuestro tipo
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("my-basic-system", MyActorSheet, {
    types: ["creature"],
    makeDefault: true,
    label: "Hoja de Criatura (Básica)"
  });

  // Item (movimientos)
  CONFIG.Item.documentClass = MoveItem;
  Items.registerSheet("my-basic-system", MoveItemSheet, {
    types: ["move"],
    makeDefault: true,
    label: "Movimiento"
  });
});

Hooks.once("ready", function () {
  console.log("my-basic-system | Listo");
});