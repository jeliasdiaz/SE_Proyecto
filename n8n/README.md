# n8n

Flujos de n8n exportados en JSON: un archivo por flujo.

- Nombre del archivo: `F<n>-<nombre>.json` (por ejemplo, `F1-aviso-registro.json`).
- Cada flujo tiene un único dueño; solo esa persona lo edita y lo exporta.
- Al terminar un cambio, se exporta la versión de producción y se hace commit indicando qué cambió.
- Las copias de prueba (`[PRUEBA] F<n>-<nombre>`) no se suben.

Antes de hacer commit, revisar que el JSON no contenga secretos: las credenciales viven en n8n y el export solo guarda su referencia, pero una llave o contraseña escrita a mano dentro de un nodo (por ejemplo, en un header HTTP) sí quedaría expuesta.
