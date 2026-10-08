const $ = (id) => document.getElementById(id);

const datos = { categorias: [] };

const filtros = {
  q: "",
  categoria: "",
  min: "",
  max: "",
  ofertas: false,
  orden: "nombre"
};

let lista = [];
let carrito = JSON.parse(localStorage.getItem("carrito") || "{}");
let temporizador;
let numeroPeticion = 0;


function el(tag, clase, texto) {
  const elemento = document.createElement(tag);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function soles(n) {
  return "S/ " + Number(n).toFixed(2);
}

function nombreCategoria(id) {
  const categoria = datos.categorias.find((c) => c.id === id);
  return categoria ? categoria.nombre : id;
}

function descuento(producto) {
  if (!producto.antes) return 0;
  return Math.round((1 - producto.precio / producto.antes) * 100);
}

function mostrarCarga(contenedor) {
  contenedor.replaceChildren();
  const caja = el("div", "estado");
  caja.append(el("div", "spin"), el("span", "", "Cargando..."));
  contenedor.append(caja);
}

function mostrarError(contenedor, mensaje, reintento) {
  contenedor.replaceChildren();
  const caja = el("div", "estado error");
  const boton = el("button", "pildora", "Reintentar");
  boton.onclick = reintento;
  caja.append(el("p", "", "No se pudo cargar la información. " + mensaje), boton);
  contenedor.append(caja);
}

function mostrarVacio(contenedor, mensaje) {
  contenedor.replaceChildren(el("div", "estado", mensaje));
}


function crearFoto(producto) {
  const foto = el("div", "foto");
  const imagen = document.createElement("img");
  imagen.src = producto.img;
  imagen.alt = producto.nombre;
  imagen.loading = "lazy";
  imagen.referrerPolicy = "no-referrer";
  imagen.onerror = () => imagen.replaceWith(el("span", "inicial", producto.nombre[0]));
  foto.append(imagen);
  if (producto.antes) foto.append(el("span", "dto", "-" + descuento(producto) + "%"));
  return foto;
}

function crearTarjeta(producto) {
  const tarjeta = el("article", "tarjeta");
  const precio = el("span", "precio", soles(producto.precio));
  if (producto.antes) precio.append(el("span", "antes", soles(producto.antes)));

  const acciones = el("div", "acc");
  const botonDetalle = el("button", "pildora sec", "Detalle");
  const botonAgregar = el("button", "pildora", "Agregar");
  botonDetalle.onclick = () => verDetalle(producto.id);
  botonAgregar.onclick = () => agregarAlCarrito(producto);
  acciones.append(botonDetalle, botonAgregar);

  tarjeta.append(
    crearFoto(producto),
    el("span", "marca", nombreCategoria(producto.categoria)),
    el("h4", "", producto.nombre),
    el("p", "pres", producto.presentacion),
    precio,
    acciones
  );
  return tarjeta;
}


async function cargarInicio() {
  const banner = $("banner");
  mostrarCarga(banner);
  try {
    const [empresa, promociones] = await Promise.all([Api.empresa(), Api.promociones()]);

    $("logo").textContent = empresa.nombre;
    document.title = empresa.nombre;
    $("contacto").textContent =
      empresa.nombre + " | " + empresa.direccion + " | Tel. " + empresa.telefono + " | " + empresa.horarioAtencion;

    banner.className = "banner-in";
    banner.replaceChildren(el("h1", "", empresa.nombre), el("p", "", empresa.eslogan));

    const activas = promociones.filter((p) => p.activa);
    if (!activas.length) {
      banner.append(el("p", "", "No hay promociones vigentes por ahora."));
      return;
    }

    const fila = el("div", "datos");
    activas.forEach((promocion) => {
      const boton = el("button", "pildora", promocion.titulo + " - " + promocion.etiqueta);
      boton.onclick = () => cambiarCategoria(promocion.categoria, true);
      fila.append(boton);
    });
    banner.append(fila);
  } catch (error) {
    mostrarError(banner, error.message, cargarInicio);
  }
}


async function cargarCategorias() {
  try {
    datos.categorias = await Api.categorias();
    const todas = [{ id: "", nombre: "Todas" }, ...datos.categorias];

    $("navCategorias").replaceChildren(
      ...todas.map((categoria) => {
        const boton = el("button", "", categoria.nombre);
        boton.dataset.id = categoria.id;
        boton.onclick = () => cambiarCategoria(categoria.id, true);
        return boton;
      })
    );

    $("fCategorias").replaceChildren(
      ...todas.map((categoria) => {
        const etiqueta = el("label", "opt");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "cat";
        radio.value = categoria.id;
        radio.onchange = () => cambiarCategoria(categoria.id);
        etiqueta.append(radio, categoria.nombre);
        return etiqueta;
      })
    );

    marcarCategoria();
  } catch (error) {
    mostrarError($("navCategorias"), error.message, cargarCategorias);
  }
}

function marcarCategoria() {
  document.querySelectorAll("#navCategorias button").forEach((boton) => {
    boton.classList.toggle("on", boton.dataset.id === filtros.categoria);
  });
  document.querySelectorAll("#fCategorias input").forEach((radio) => {
    radio.checked = radio.value === filtros.categoria;
  });
}

function cambiarCategoria(id, irAlCatalogo) {
  filtros.categoria = id;
  marcarCategoria();
  cargarProductos();
  if (irAlCatalogo) location.hash = "#catalogo";
}


function aplicarFiltros(productos) {
  const texto = filtros.q.toLowerCase();
  const minimo = parseFloat(filtros.min);
  const maximo = parseFloat(filtros.max);

  const criteriosDeOrden = {
    nombre: (a, b) => a.nombre.localeCompare(b.nombre),
    precio_asc: (a, b) => a.precio - b.precio,
    precio_desc: (a, b) => b.precio - a.precio
  };

  return productos
    .filter((p) =>
      (!texto || p.nombre.toLowerCase().includes(texto)) &&
      (!filtros.categoria || p.categoria === filtros.categoria) &&
      (isNaN(minimo) || p.precio >= minimo) &&
      (isNaN(maximo) || p.precio <= maximo) &&
      (!filtros.ofertas || p.antes)
    )
    .sort(criteriosDeOrden[filtros.orden] || criteriosDeOrden.nombre);
}

async function cargarProductos() {
  const contenedor = $("listaProductos");
  const numero = ++numeroPeticion;
  mostrarCarga(contenedor);
  try {
    const respuesta = await Api.productos(filtros);
    if (numero !== numeroPeticion) return;

    lista = aplicarFiltros(Array.isArray(respuesta) ? respuesta : []);
    $("contador").textContent = "Resultado de búsqueda: " + lista.length + " producto(s)";

    if (!lista.length) {
      mostrarVacio(contenedor, "No encontramos productos con esos filtros.");
      return;
    }
    contenedor.replaceChildren(...lista.map(crearTarjeta));
  } catch (error) {
    if (numero === numeroPeticion) mostrarError(contenedor, error.message, cargarProductos);
  }
}

function esperarYBuscar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(cargarProductos, 400);
}

$("busqueda").addEventListener("input", (evento) => {
  filtros.q = evento.target.value.trim();
  esperarYBuscar();
  if (filtros.q) location.hash = "#catalogo";
});

$("fMin").addEventListener("input", (evento) => {
  filtros.min = evento.target.value;
  esperarYBuscar();
});

$("fMax").addEventListener("input", (evento) => {
  filtros.max = evento.target.value;
  esperarYBuscar();
});

$("fOfertas").onchange = (evento) => {
  filtros.ofertas = evento.target.checked;
  cargarProductos();
};

$("fOrden").onchange = (evento) => {
  filtros.orden = evento.target.value;
  cargarProductos();
};

$("limpiar").onclick = () => {
  Object.assign(filtros, { q: "", min: "", max: "", ofertas: false, orden: "nombre" });
  ["busqueda", "fMin", "fMax"].forEach((id) => ($(id).value = ""));
  $("fOfertas").checked = false;
  $("fOrden").value = "nombre";
  cambiarCategoria("");
};


async function verDetalle(id) {
  const contenedor = $("detalleCuerpo");
  mostrarCarga(contenedor);
  $("detalle").showModal();
  try {
    const producto = await Api.producto(id);

    const datosDelProducto = el("dl");
    [
      ["Código", producto.codigo],
      ["Categoría", nombreCategoria(producto.categoria)],
      ["Presentación", producto.presentacion],
      ["Precio", soles(producto.precio)],
      ["Precio anterior", producto.antes ? soles(producto.antes) : "-"],
      ["Ahorras", producto.antes ? soles(producto.antes - producto.precio) : "-"]
    ].forEach(([titulo, valor]) => datosDelProducto.append(el("dt", "", titulo), el("dd", "", valor)));

    const botonAgregar = el("button", "pildora", "Agregar al carrito");
    botonAgregar.onclick = () => {
      agregarAlCarrito(producto);
      $("detalle").close();
    };

    const informacion = el("div");
    informacion.append(el("h3", "", producto.nombre), datosDelProducto, botonAgregar);

    const fila = el("div", "det");
    fila.append(crearFoto(producto), informacion);
    contenedor.replaceChildren(fila);
  } catch (error) {
    mostrarError(contenedor, error.message, () => verDetalle(id));
  }
}

$("cerrarDetalle").onclick = () => $("detalle").close();


function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  $("cuenta").textContent = Object.values(carrito).reduce((total, item) => total + item.cantidad, 0);
}

function agregarAlCarrito(producto) {
  if (!carrito[producto.id]) {
    carrito[producto.id] = { id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 0 };
  }
  carrito[producto.id].cantidad++;
  guardarCarrito();

  const boton = $("abrirCarrito");
  boton.classList.add("ok");
  setTimeout(() => boton.classList.remove("ok"), 900);
}

function pintarCarrito() {
  const contenedor = $("carritoCuerpo");
  const items = Object.values(carrito);

  contenedor.replaceChildren();
  $("resumen").replaceChildren();
  $("vaciar").hidden = !items.length;

  if (!items.length) {
    mostrarVacio(contenedor, "Tu carrito está vacío.");
    return;
  }

  items.forEach((item) => {
    const linea = el("div", "linea");

    const cantidad = el("input");
    cantidad.type = "number";
    cantidad.min = 1;
    cantidad.value = item.cantidad;
    cantidad.onchange = () => {
      item.cantidad = Math.max(1, Number(cantidad.value) || 1);
      guardarCarrito();
      pintarCarrito();
    };

    const botonQuitar = el("button", "pildora sec", "Quitar");
    botonQuitar.onclick = () => {
      delete carrito[item.id];
      guardarCarrito();
      pintarCarrito();
    };

    linea.append(el("span", "", item.nombre), cantidad, el("strong", "", soles(item.precio * item.cantidad)), botonQuitar);
    contenedor.append(linea);
  });

  const total = items.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  $("resumen").append(el("strong", "", "Total: " + soles(total)));
}

$("abrirCarrito").onclick = () => {
  pintarCarrito();
  $("carrito").showModal();
};

$("vaciar").onclick = () => {
  carrito = {};
  guardarCarrito();
  pintarCarrito();
};

$("cerrarCarrito").onclick = () => $("carrito").close();


(async () => {
  guardarCarrito();
  cargarInicio();
  await cargarCategorias();
  cargarProductos();
})();