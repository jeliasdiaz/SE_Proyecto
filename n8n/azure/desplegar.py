#!/usr/bin/env python3
"""Despliega n8n/*.json en el n8n de Azure por la API pública, sin acceso a la VM (ver README.md).

  python3 n8n/azure/desplegar.py inventario            # respalda Azure y muestra flujos y credenciales
  python3 n8n/azure/desplegar.py plan    [opciones]    # qué haría, sin cambiar nada
  python3 n8n/azure/desplegar.py aplicar [opciones]    # respalda, actualiza y publica
  python3 n8n/azure/desplegar.py restaurar <respaldo>  # deja los flujos como en ese respaldo

Actualiza en su lugar los flujos que ya existen (mismo id y misma ruta de webhook), cambia las
credenciales locales por las de producción y apunta las llamadas a Enviar-aviso a su id en Azure.
Despliega los JSON de la carpeta local: `aplicar` se niega si la rama no incluye la última
feat/frontend o si los JSON tienen cambios sin commit (--forzar lo salta).
La configuración (llave de API incluida) se lee de n8n/azure/.env o de variables de entorno.
"""
import argparse
import copy
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request

AQUI = pathlib.Path(__file__).resolve().parent
FLUJOS = AQUI.parent
RESPALDOS = AQUI / "respaldos"
RAMA_PRODUCCION = "feat/frontend"
# Enviar-aviso primero: los demás necesitan su id.
ORDEN = ["Enviar-aviso", "F1-registro", "F2-cambio-estado", "F4-correo-a-caso", "F3-recordatorio"]
ID_LOCAL_ENVIAR = "seEnviarAviso001"
ID_F4 = "KFHt4aD0YlAJMrYr"
EXPR_SUPABASE_URL = "{{ $env.SUPABASE_URL.replace(/\\/$/, '') }}"
EXPR_REMITENTE = "={{ $env.CORREO_REMITENTE }}"
# Ajustes que acepta la API pública (rechaza cualquier otro).
AJUSTES = {"saveExecutionProgress", "saveManualExecutions", "saveDataErrorExecution", "saveDataSuccessExecution",
           "executionTimeout", "errorWorkflow", "timezone", "executionOrder", "binaryMode", "callerPolicy"}


def configuracion():
    """n8n/azure/.env (KEY=valor) y encima las variables de entorno."""
    valores = {}
    archivo = AQUI / ".env"
    if archivo.exists():
        for linea in archivo.read_text().splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                clave, valor = linea.split("=", 1)
                valores[clave.strip()] = valor.strip().strip("'\"")
    valores.update({k: v for k, v in os.environ.items() if k in ("N8N_URL", "N8N_API_KEY", "SUPABASE_URL", "CORREO_REMITENTE")})
    return valores


CONFIG = configuracion()
BASE = CONFIG.get("N8N_URL", "https://n8n-request.chilecentral.cloudapp.azure.com").rstrip("/") + "/api/v1"


def api(metodo, ruta, cuerpo=None):
    if not CONFIG.get("N8N_API_KEY"):
        sys.exit(f"Falta N8N_API_KEY en {AQUI / '.env'} (ver README.md).")
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    pedido = urllib.request.Request(BASE + ruta, data=datos, method=metodo, headers={
        "X-N8N-API-KEY": CONFIG["N8N_API_KEY"], "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(pedido, timeout=60) as r:
            texto = r.read().decode()
            return r.status, json.loads(texto) if texto else None
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, {"message": texto[:300]}


def listar(ruta):
    elementos, cursor = [], None
    while True:
        st, d = api("GET", f"{ruta}?limit=250" + (f"&cursor={cursor}" if cursor else ""))
        if st != 200:
            return None, f"{st} {d.get('message') if isinstance(d, dict) else d}"
        elementos += d["data"]
        cursor = d.get("nextCursor")
        if not cursor:
            return elementos, None


def inventario(guardar=True):
    resumidos, error = listar("/workflows")
    if error:
        sys.exit(f"No pude listar los flujos: {error}")
    flujos = []
    for w in resumidos:
        st, d = api("GET", f"/workflows/{w['id']}")
        if st != 200:
            sys.exit(f"No pude leer el flujo {w['id']}: {st} {d}")
        flujos.append(d)
    credenciales, error = listar("/credentials")
    if error:
        print(f"(La API no lista credenciales: {error}. Se toman de los nodos de los flujos.)")
        credenciales = None
    carpeta = None
    if guardar:
        carpeta = RESPALDOS / datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        carpeta.mkdir(parents=True)
        for w in flujos:
            nombre = re.sub(r"[^A-Za-z0-9._-]+", "-", w["name"])
            (carpeta / f"{w['id']}-{nombre}.json").write_text(json.dumps(w, indent=2, ensure_ascii=False))
        (carpeta / "credenciales.json").write_text(json.dumps(credenciales, indent=2, ensure_ascii=False))
    return flujos, credenciales, carpeta


def tipo_corto(nodo):
    return nodo["type"].split(".")[-1]


def describir(w):
    nodos = w["nodes"]
    rutas = [n["parameters"].get("path") for n in nodos if tipo_corto(n) == "webhook"]
    disparadores = sorted({tipo_corto(n) for n in nodos if re.search(r"(?i)trigger|webhook|emailReadImap", n["type"])})
    creds = sorted({f"{t}={c.get('name')} ({c.get('id')})" for n in nodos for t, c in (n.get("credentials") or {}).items()})
    subflujos = sorted({str((n["parameters"].get("workflowId") or {}).get("value")) for n in nodos
                        if tipo_corto(n) == "executeWorkflow"})
    env = sorted(set(re.findall(r"\$env\.([A-Z_]+)", json.dumps(nodos))))
    estado = "PUBLICADO" if w.get("active") else "sin publicar"
    print(f"- {w['id']}  {w['name']}  [{estado}{', archivado' if w.get('isArchived') else ''}]  "
          f"actualizado {str(w.get('updatedAt'))[:16]}")
    print(f"    disparadores: {', '.join(disparadores) or '—'}"
          + (f"   rutas webhook: {', '.join(map(str, rutas))}" if rutas else ""))
    if creds:
        print(f"    credenciales: {'; '.join(creds)}")
    if subflujos:
        print(f"    llama a: {', '.join(subflujos)}")
    if env:
        print(f"    variables: {', '.join(env)}")


def destinos(flujos):
    """El flujo de Azure que reemplaza cada archivo, o None si hay que crearlo."""
    vigentes = [w for w in flujos if not w.get("isArchived")]

    def tiene(w, tipo):
        return any(tipo_corto(n) == tipo for n in w["nodes"])

    def ruta(w, p):
        return any(tipo_corto(n) == "webhook" and n["parameters"].get("path") == p for n in w["nodes"])

    def uno(pred, que):
        candidatos = [w for w in vigentes if pred(w)]
        if len(candidatos) > 1:
            sys.exit(f"Hay {len(candidatos)} flujos que parecen {que}: "
                     + ", ".join(f"{w['id']} «{w['name']}»" for w in candidatos) + ". Archiva los que sobran.")
        return candidatos[0] if candidatos else None

    return {
        "Enviar-aviso": uno(lambda w: tiene(w, "executeWorkflowTrigger") and "aviso" in w["name"].lower(), "Enviar-aviso"),
        "F1-registro": uno(lambda w: ruta(w, "f1-registro"), "F1"),
        "F2-cambio-estado": uno(lambda w: ruta(w, "f2-cambio-estado"), "F2"),
        "F4-correo-a-caso": uno(lambda w: w["id"] == ID_F4 or tiene(w, "emailReadImap"), "F4"),
        "F3-recordatorio": uno(lambda w: w["name"].lower().startswith("f3"), "F3"),
    }


def credenciales_produccion(flujos, credenciales, forzadas):
    """Por tipo, la credencial de producción: la que ya usan los flujos de Azure o, si ninguno la
    usa, la única de ese tipo en la instancia. Si hay más de una, hay que elegirla con --credencial."""
    tipos = sorted({t for nombre in ORDEN for n in json.loads((FLUJOS / f"{nombre}.json").read_text())["nodes"]
                    for t in (n.get("credentials") or {})})
    existentes = {c["id"]: c for c in credenciales or []}
    usadas = {}
    for w in flujos:
        if w.get("isArchived"):
            continue
        for n in w["nodes"]:
            for t, c in (n.get("credentials") or {}).items():
                # Una credencial borrada sigue referenciada en el nodo: no sirve.
                if credenciales is None or c["id"] in existentes:
                    usadas.setdefault(t, {})[c["id"]] = c.get("name")
    mapa, problemas = {}, []
    for t in tipos:
        if t in forzadas:
            cid = forzadas[t]
            mapa[t] = {"id": cid, "name": existentes.get(cid, {}).get("name") or usadas.get(t, {}).get(cid) or cid}
            continue
        candidatos = usadas.get(t) or {c["id"]: c["name"] for c in credenciales or [] if c["type"] == t}
        if len(candidatos) == 1:
            cid, nombre = next(iter(candidatos.items()))
            mapa[t] = {"id": cid, "name": nombre}
        else:
            problemas.append(f"{t}: {'ninguna' if not candidatos else candidatos} (usa --credencial {t}=<id>)")
    return mapa, problemas


def construir(nombre, enviar_id, mapa, supabase_url, remitente):
    d = json.loads((FLUJOS / f"{nombre}.json").read_text())
    nodos = copy.deepcopy(d["nodes"])
    for n in nodos:
        for t in list(n.get("credentials") or {}):
            n["credentials"][t] = mapa[t]
        if tipo_corto(n) == "executeWorkflow":
            assert n["parameters"]["workflowId"]["value"] == ID_LOCAL_ENVIAR, n["name"]
            n["parameters"]["workflowId"] = {"__rl": True, "value": enviar_id, "mode": "id"}
        # Las variables de la VM no se pueden cambiar sin acceso a Azure: estos valores van en los nodos.
        if supabase_url and isinstance(n["parameters"].get("url"), str):
            n["parameters"]["url"] = n["parameters"]["url"].replace(EXPR_SUPABASE_URL, supabase_url.rstrip("/"))
        if remitente:
            for clave, valor in n["parameters"].items():
                if valor == EXPR_REMITENTE:
                    n["parameters"][clave] = remitente
                elif clave == "jsCode":
                    n["parameters"][clave] = valor.replace("$env.CORREO_REMITENTE", json.dumps(remitente, ensure_ascii=False))
    if supabase_url:
        assert "$env.SUPABASE_URL" not in json.dumps(nodos), "quedó una referencia a $env.SUPABASE_URL"
    if remitente:
        assert "$env.CORREO_REMITENTE" not in json.dumps(nodos), "quedó una referencia a $env.CORREO_REMITENTE"
    cuerpo = {"name": d["name"], "nodes": nodos, "connections": d["connections"],
              "settings": {k: v for k, v in d["settings"].items() if k in AJUSTES}}
    if d.get("description"):
        cuerpo["description"] = d["description"]
    return cuerpo


def guardar(destino, cuerpo):
    """PUT si existe (la API lo republica si estaba publicado), POST si es nuevo. Si esta versión de
    n8n no acepta `description`, reintenta sin ella."""
    for intento in (cuerpo, {k: v for k, v in cuerpo.items() if k != "description"}):
        st, d = api("PUT", f"/workflows/{destino['id']}", intento) if destino else api("POST", "/workflows", intento)
        if st in (200, 201):
            return d
        if st == 400 and "description" in intento:
            continue
        sys.exit(f"Falló al guardar {cuerpo['name']}: {st} {d}")
    sys.exit(f"Falló al guardar {cuerpo['name']}: {st} {d}")


def publicar(wid):
    st, d = api("POST", f"/workflows/{wid}/publish", {})
    if st == 404:  # versiones anteriores de n8n: "activar"
        st, d = api("POST", f"/workflows/{wid}/activate")
    return st, d


def flujos_a_desplegar(args):
    return [n for n in ORDEN if not args.solo or n in args.solo]


def revisar_rama():
    """Devuelve (bloqueos, avisos). Desde una rama atrasada se desplegarían flujos viejos y se
    desharían cambios ya publicados."""
    def git(*partes):
        return subprocess.run(["git", "-C", str(FLUJOS), *partes], capture_output=True, text=True)

    bloqueos, avisos = [], []
    if git("fetch", "-q", "origin", RAMA_PRODUCCION).returncode != 0:
        avisos.append(f"no se pudo traer origin/{RAMA_PRODUCCION}: se compara con la copia local")
    if git("merge-base", "--is-ancestor", f"origin/{RAMA_PRODUCCION}", "HEAD").returncode != 0:
        bloqueos.append(f"la rama actual no incluye la última origin/{RAMA_PRODUCCION}: desplegaría flujos viejos")
    cambios = git("status", "--porcelain", "--", *[f"{nombre}.json" for nombre in ORDEN]).stdout.rstrip()
    if cambios:
        bloqueos.append(f"hay cambios sin commit en los JSON:\n{cambios}")
    return bloqueos, avisos


def credencial_imap(nodos):
    return next((c["id"] for n in nodos for t, c in (n.get("credentials") or {}).items() if t == "imap"), None)


def reinicio_imap(objetivo, mapa, pedido):
    """Motivo para borrar el último UID leído de F4, o None. El disparador IMAP descarta los correos
    con UID menor o igual al guardado, y cada buzón numera desde 1: con otro buzón no leería nada."""
    w = objetivo["F4-correo-a-caso"]
    if not w:
        return None
    if pedido:
        return "a pedido (--reiniciar-imap)"
    publicado = (w.get("activeVersion") or {}).get("nodes") or w["nodes"]
    if credencial_imap(publicado) != mapa.get("imap", {}).get("id"):
        return "cambia la credencial IMAP"
    return None


def cmd_inventario(args):
    flujos, credenciales, carpeta = inventario()
    print(f"Respaldo: {carpeta}\n\nFlujos en Azure ({len(flujos)}):")
    for w in sorted(flujos, key=lambda w: w["name"]):
        describir(w)
    if credenciales is not None:
        print(f"\nCredenciales ({len(credenciales)}):")
        for c in sorted(credenciales, key=lambda c: (c["type"], c["name"])):
            print(f"- {c['type']}: {c['name']} ({c['id']})")


def cmd_plan(args, aplicar=False):
    supabase_url = args.supabase_url or CONFIG.get("SUPABASE_URL")
    remitente = args.correo_remitente or CONFIG.get("CORREO_REMITENTE")
    flujos, credenciales, carpeta = inventario(guardar=aplicar)
    objetivo = destinos(flujos)
    mapa, problemas = credenciales_produccion(flujos, credenciales, dict(c.split("=", 1) for c in args.credencial))

    print("Credenciales de producción por tipo:")
    for t, c in mapa.items():
        print(f"  {t}: {c['name']} ({c['id']})")
    for p in problemas:
        print(f"  FALTA DECIDIR {p}")
    print("\nFlujos:")
    for nombre in flujos_a_desplegar(args):
        w = objetivo[nombre]
        print(f"  {nombre}: " + (f"reemplaza {w['id']} «{w['name']}» ({'publicado' if w.get('active') else 'sin publicar'})"
                                  if w else "se crea nuevo")
              + (", queda sin publicar" if nombre in args.sin_publicar else ""))
    print(f"\nRemitente: {remitente or 'se deja $env.CORREO_REMITENTE (variable de la VM)'}")
    print(f"SUPABASE_URL en «Subir adjunto»: {supabase_url or 'se deja $env.SUPABASE_URL (debe existir en la VM)'}")
    reinicio = reinicio_imap(objetivo, mapa, args.reiniciar_imap) if "F4-correo-a-caso" in flujos_a_desplegar(args) else None
    if reinicio:
        print(f"F4: se borra el último correo leído del buzón ({reinicio})")
    bloqueos, avisos = revisar_rama()
    for aviso in avisos:
        print(f"\nAviso: {aviso}")
    for bloqueo in bloqueos:
        print(f"\nRAMA: {bloqueo}")
    if problemas:
        sys.exit("\nNo se aplica nada hasta resolver las credenciales.")
    if not aplicar:
        print("\n(Solo plan: no se cambió nada.)")
        return
    if bloqueos and not args.forzar:
        sys.exit(f"\nNo se aplica nada: actualiza la rama (git pull origin {RAMA_PRODUCCION}) y haz commit, o usa --forzar.")

    print(f"\nRespaldo antes de cambiar: {carpeta}\n")
    enviar_id = objetivo["Enviar-aviso"]["id"] if objetivo["Enviar-aviso"] else None
    guardados = {}
    for nombre in flujos_a_desplegar(args):
        if nombre != "Enviar-aviso" and not enviar_id:
            sys.exit("Enviar-aviso no existe en Azure: despliégalo primero.")
        cuerpo = construir(nombre, enviar_id, mapa, supabase_url, remitente)
        if nombre == "F4-correo-a-caso" and reinicio:
            cuerpo["staticData"] = {}  # n8n lo vuelve a cargar al republicar
        d = guardar(objetivo[nombre], cuerpo)
        guardados[nombre] = d["id"]
        if nombre == "Enviar-aviso":
            enviar_id = d["id"]
        if nombre in args.sin_publicar:
            print(f"  {nombre}: guardado en {d['id']}, sin publicar (a pedido)")
            continue
        st, r = publicar(d["id"])
        estado = "publicado" if st == 200 else f"NO publicado ({st} {r.get('message') if isinstance(r, dict) else r})"
        print(f"  {nombre}: guardado en {d['id']}, {estado}")

    print("\nEstado final:")
    for nombre, wid in guardados.items():
        st, w = api("GET", f"/workflows/{wid}")
        print(f"  {nombre} ({wid}): {'PUBLICADO' if st == 200 and w.get('active') else 'sin publicar'}")


def cmd_restaurar(args):
    for archivo in sorted(pathlib.Path(args.carpeta).glob("*.json")):
        if archivo.name == "credenciales.json":
            continue
        w = json.loads(archivo.read_text())
        cuerpo = {"name": w["name"], "nodes": w["nodes"], "connections": w["connections"],
                  "settings": {k: v for k, v in (w.get("settings") or {}).items() if k in AJUSTES}}
        st, d = api("PUT", f"/workflows/{w['id']}", cuerpo)
        print(f"  {w['name']}: {st}")
        if st == 200 and not w.get("active") and d.get("active"):
            api("POST", f"/workflows/{w['id']}/unpublish")
        elif st == 200 and w.get("active"):
            publicar(w["id"])
    print("Los flujos creados después del respaldo no se borran: archívalos desde la interfaz.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("inventario")
    for nombre in ("plan", "aplicar"):
        s = sub.add_parser(nombre)
        s.add_argument("--solo", action="append", default=[], choices=ORDEN, help="despliega solo estos flujos")
        s.add_argument("--sin-publicar", action="append", default=[], choices=ORDEN,
                       help="los guarda sin publicarlos (un flujo que ya estaba publicado se republica igual)")
        s.add_argument("--credencial", action="append", default=[], metavar="TIPO=ID",
                       help="fuerza la credencial de un tipo (supabaseApi, smtp, httpHeaderAuth, imap)")
        s.add_argument("--supabase-url", help="reemplaza SUPABASE_URL de .env")
        s.add_argument("--correo-remitente", help="reemplaza CORREO_REMITENTE de .env")
        s.add_argument("--reiniciar-imap", action="store_true",
                       help="borra el último correo leído de F4 (si cambia el buzón sin cambiar de credencial)")
        s.add_argument("--forzar", action="store_true",
                       help="aplica aunque la rama esté atrasada o los JSON tengan cambios sin commit")
    r = sub.add_parser("restaurar")
    r.add_argument("carpeta", help="una carpeta de n8n/azure/respaldos/")
    args = p.parse_args()
    {"inventario": cmd_inventario, "plan": cmd_plan, "aplicar": lambda a: cmd_plan(a, aplicar=True),
     "restaurar": cmd_restaurar}[args.cmd](args)


if __name__ == "__main__":
    main()
