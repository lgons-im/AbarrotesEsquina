async function peticion(ruta, opciones) {
  if (API_URL.includes("PEGAR_AQUI")) throw new Error("Falta configurar la URL de la API en js/config.js");
  let respuesta;
  try { respuesta = await fetch(API_URL + ruta, opciones); }
  catch { throw new Error("Problema de conexión con el servidor"); }
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error((cuerpo && cuerpo.mensaje) || "Error " + respuesta.status + " en " + ruta);
  return cuerpo;
}

const Api = {
  empresa: () => peticion("/api/empresa"),
  categorias: () => peticion("/api/categorias"),
  promociones: () => peticion("/api/promociones"),
  entregas: () => peticion("/api/entregas"),
  productos: (f = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== "" && v !== false && v != null)).toString();
    return peticion("/api/productos" + (qs ? "?" + qs : ""));
  },
  producto: (id) => peticion("/api/productos/" + id),
  crearPedido: (datos) => peticion("/api/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) })
};