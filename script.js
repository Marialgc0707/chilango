/* ==========================================================================
   CHILANGO · Menú Mexicano — carrito de pedidos
   --------------------------------------------------------------------------
   Para agregar opciones a un plato (lomito, pollo, mixto…), basta con poner
   en su tarjeta del HTML:
     data-options="Lomito|Pollo|Mixto"
     data-options-label="Elige tu proteína"      (opcional)
   ========================================================================== */

const WHATSAPP_NUMERO = "584245445480";
const CARRITO_KEY = "chilango_carrito_v2";
const CARRITO_KEY_ANTIGUA = "chilango_carrito";
const CLIENTE_KEY = "chilango_cliente_v1";
const CARRITO_DIAS_VIGENTE = 7;   // pasado este tiempo sin cambios, el carrito guardado se descarta

// carrito = { "<plato>::<opción>": { producto, opcion, precio, cantidad } }
let carrito = {};
let notasPedido = "";
let focoAntesDelCarrito = null;


/* ---------- Almacenamiento seguro (puede estar bloqueado en modo privado) ---------- */
function leerStorage(clave){ try { return localStorage.getItem(clave); } catch(e) { return null; } }
function escribirStorage(clave, valor){ try { localStorage.setItem(clave, valor); } catch(e) {} }
function borrarStorage(clave){ try { localStorage.removeItem(clave); } catch(e) {} }


/* ---------- Utilidades ---------- */
function obtenerPrecio(el){
  const raw = (el.dataset.price || "").replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function formatearPrecio(n){ return String(Number(n.toFixed(2))); }   // 12 → "12", 1.5 → "1.5"

function nombreProducto(el){
  return el.dataset.product || el.querySelector("h3")?.textContent?.trim() || "producto";
}

function opcionesDe(el){
  return (el.dataset.options || "").split("|").map(s => s.trim()).filter(Boolean);
}

function claveItem(producto, opcion){ return opcion ? producto + "::" + opcion : producto; }

function escapeHtml(text){
  return String(text).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function panelAbierto(){
  const panel = document.getElementById("cartPanel");
  return !!panel && panel.classList.contains("open");
}


/* ---------- Guardar y recuperar el carrito ---------- */
function cargarCarrito(){
  carrito = {};
  notasPedido = "";
  const raw = leerStorage(CARRITO_KEY);
  if(!raw) return;
  try {
    const data = JSON.parse(raw);
    const edad = Date.now() - (Number(data.guardado) || 0);
    if(!data || data.v !== 2 || edad > CARRITO_DIAS_VIGENTE * 86400000){
      borrarStorage(CARRITO_KEY);
      return;
    }
    Object.values(data.items || {}).forEach(it => {
      if(!it || typeof it.producto !== "string") return;
      const cantidad = Math.floor(Number(it.cantidad));
      if(!(cantidad > 0)) return;
      const opcion = typeof it.opcion === "string" ? it.opcion : "";
      carrito[claveItem(it.producto, opcion)] = {
        producto: it.producto,
        opcion: opcion,
        precio: Number.isFinite(it.precio) ? it.precio : null,
        cantidad: cantidad
      };
    });
    notasPedido = typeof data.notas === "string" ? data.notas.slice(0, 300) : "";
  } catch(e) {
    carrito = {};
    notasPedido = "";
  }
}

function guardarCarrito(){
  if(Object.keys(carrito).length){
    escribirStorage(CARRITO_KEY, JSON.stringify({v: 2, guardado: Date.now(), items: carrito, notas: notasPedido}));
  } else {
    borrarStorage(CARRITO_KEY);
  }
  actualizarCarrito();
}

// Compara lo guardado con el menú actual: quita platos u opciones que ya no existen
// y actualiza los precios. Devuelve true si cambió algo.
function conciliarConMenu(){
  const menu = {};
  document.querySelectorAll(".order-item").forEach(el => { menu[nombreProducto(el)] = el; });
  let cambio = false;
  Object.keys(carrito).forEach(clave => {
    const it = carrito[clave];
    const el = menu[it.producto];
    if(!el){ delete carrito[clave]; cambio = true; return; }
    const opciones = opcionesDe(el);
    const opcionInvalida = opciones.length ? !opciones.includes(it.opcion) : !!it.opcion;
    if(opcionInvalida){ delete carrito[clave]; cambio = true; return; }
    const precio = obtenerPrecio(el);
    if(it.precio !== precio){ it.precio = precio; cambio = true; }
  });
  return cambio;
}


/* ---------- Datos del cliente (nombre, dirección, tipo de entrega) ---------- */
function leerCliente(){
  let d = {};
  try { d = JSON.parse(leerStorage(CLIENTE_KEY) || "{}") || {}; } catch(e) { d = {}; }
  return {
    nombre: typeof d.nombre === "string" ? d.nombre.slice(0, 60) : "",
    direccion: typeof d.direccion === "string" ? d.direccion.slice(0, 200) : "",
    entrega: d.entrega === "retiro" ? "retiro" : "domicilio"
  };
}

function datosFormulario(){
  const valor = id => (document.getElementById(id)?.value || "").trim();
  const marcado = document.querySelector('#pedidoForm input[name="entrega"]:checked');
  return {
    nombre: valor("clienteNombre"),
    direccion: valor("clienteDireccion"),
    notas: valor("pedidoNotas"),
    entrega: marcado && marcado.value === "retiro" ? "retiro" : "domicilio"
  };
}

function guardarCliente(){
  const d = datosFormulario();
  escribirStorage(CLIENTE_KEY, JSON.stringify({nombre: d.nombre, direccion: d.direccion, entrega: d.entrega}));
}

function actualizarCampoDireccion(){
  const campo = document.getElementById("campoDireccion");
  if(!campo) return;
  const retiro = datosFormulario().entrega === "retiro";
  campo.hidden = retiro;
  if(retiro) limpiarErrorCampo(document.getElementById("clienteDireccion"));
}

function mostrarErrorCampo(campo, mensaje){
  campo.setAttribute("aria-invalid", "true");
  const error = document.getElementById(campo.getAttribute("aria-describedby"));
  if(error){ error.textContent = mensaje; error.hidden = false; }
}

function limpiarErrorCampo(campo){
  if(!campo || !campo.hasAttribute || !campo.hasAttribute("aria-describedby")) return;
  campo.removeAttribute("aria-invalid");
  const error = document.getElementById(campo.getAttribute("aria-describedby"));
  if(error) error.hidden = true;
}

function mostrarEstado(texto, esError){
  const el = document.getElementById("cartStatus");
  if(!el) return;
  el.textContent = texto;
  el.classList.toggle("error", !!esError);
  el.hidden = false;
}

function ocultarEstado(){
  const el = document.getElementById("cartStatus");
  if(el) el.hidden = true;
}

function validarDatosCliente(){
  const d = datosFormulario();
  const nombre = document.getElementById("clienteNombre");
  const direccion = document.getElementById("clienteDireccion");
  let primero = null;
  if(!d.nombre){
    mostrarErrorCampo(nombre, "Escribe tu nombre para que sepamos a quién entregar.");
    primero = nombre;
  }
  if(d.entrega === "domicilio" && !d.direccion){
    mostrarErrorCampo(direccion, "Escribe la dirección de entrega.");
    primero = primero || direccion;
  }
  if(primero){ primero.focus(); return false; }
  return true;
}

function iniciarFormulario(){
  const form = document.getElementById("pedidoForm");
  if(!form) return;
  const cliente = leerCliente();
  document.getElementById("clienteNombre").value = cliente.nombre;
  document.getElementById("clienteDireccion").value = cliente.direccion;
  document.getElementById("pedidoNotas").value = notasPedido;
  const radio = form.querySelector('input[name="entrega"][value="' + cliente.entrega + '"]');
  if(radio) radio.checked = true;
  actualizarCampoDireccion();

  form.addEventListener("input", e => {
    if(e.target.id === "pedidoNotas"){
      notasPedido = e.target.value.slice(0, 300);
      guardarCarrito();
    } else {
      guardarCliente();
    }
    limpiarErrorCampo(e.target);
    ocultarEstado();
  });
  form.addEventListener("change", e => {
    if(e.target.name === "entrega"){ actualizarCampoDireccion(); guardarCliente(); }
  });
  form.addEventListener("submit", e => { e.preventDefault(); enviarCarritoWhatsApp(); });
}


/* ---------- Opciones por producto ---------- */
function construirOpciones(){
  document.querySelectorAll(".order-item[data-options]").forEach((el, i) => {
    const opciones = opcionesDe(el);
    if(!opciones.length) return;
    const titulo = el.dataset.optionsLabel || "Elige una opción";

    const grupo = document.createElement("fieldset");
    grupo.className = "opciones";
    const leyenda = document.createElement("legend");
    leyenda.textContent = titulo;
    const lista = document.createElement("div");
    lista.className = "opciones-lista";
    opciones.forEach(texto => {
      const label = document.createElement("label");
      label.className = "opcion";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "opcion-" + i;
      input.value = texto;
      const span = document.createElement("span");
      span.textContent = texto;
      label.append(input, span);
      lista.append(label);
    });
    const error = document.createElement("p");
    error.className = "opciones-error";
    error.setAttribute("role", "alert");
    error.textContent = titulo + " para agregarlo.";
    error.hidden = true;

    grupo.append(leyenda, lista, error);
    grupo.addEventListener("change", () => { grupo.classList.remove("invalid"); error.hidden = true; });
    el.insertBefore(grupo, el.querySelector(".product-actions"));
  });
}

// Devuelve "" si el plato no tiene opciones, la opción elegida, o null si falta elegir.
function leerOpcion(el){
  const grupo = el.querySelector(".opciones");
  if(!grupo) return "";
  const marcada = grupo.querySelector("input:checked");
  if(marcada) return marcada.value;
  grupo.classList.add("invalid");
  grupo.querySelector(".opciones-error").hidden = false;
  const primera = grupo.querySelector("input");
  if(primera) primera.focus();
  return null;
}


/* ---------- Agregar, quitar y mostrar ---------- */
function sincronizarSeleccion(){
  const enCarrito = new Set(Object.values(carrito).map(it => it.producto));
  document.querySelectorAll(".order-item").forEach(el => {
    el.classList.toggle("selected", enCarrito.has(nombreProducto(el)));
  });
}

function pedirProducto(el){
  const producto = nombreProducto(el);
  const opcion = leerOpcion(el);
  if(opcion === null) return;
  const clave = claveItem(producto, opcion);
  if(!carrito[clave]) carrito[clave] = {producto: producto, opcion: opcion, precio: obtenerPrecio(el), cantidad: 0};
  carrito[clave].cantidad += 1;
  guardarCarrito();
  sincronizarSeleccion();
  mostrarAvisoCarrito();
}

function cambiarCantidad(clave, cambio){
  const it = carrito[clave];
  if(!it) return;
  it.cantidad += cambio;
  if(it.cantidad <= 0) delete carrito[clave];
  guardarCarrito();
  sincronizarSeleccion();
  renderCarrito();
}

function totalCarrito(){
  return Object.values(carrito).reduce((sum, it) => sum + ((it.precio ?? 0) * it.cantidad), 0);
}

function actualizarCarrito(){
  const count = Object.values(carrito).reduce((sum, it) => sum + it.cantidad, 0);
  const badge = document.getElementById("cartCount");
  if(badge) badge.textContent = count;
  const total = document.getElementById("cartTotal");
  if(total) total.textContent = "$" + formatearPrecio(totalCarrito());
}

function renderCarrito(){
  const cont = document.getElementById("cartItems");
  if(!cont) return;
  const items = Object.values(carrito);
  const form = document.getElementById("pedidoForm");
  if(form) form.hidden = !items.length;
  if(!items.length){
    cont.innerHTML = '<div class="cart-empty">Tu carrito está vacío.<br>Toca las comidas que quieras agregar.</div>';
    actualizarCarrito();
    return;
  }
  cont.innerHTML = items.map(it => {
    const clave = encodeURIComponent(claveItem(it.producto, it.opcion));
    const detalle = it.precio == null
      ? "Precio por confirmar"
      : "$" + formatearPrecio(it.precio) + " c/u · $" + formatearPrecio(it.precio * it.cantidad);
    const opcion = it.opcion ? '<span class="cart-opcion">' + escapeHtml(it.opcion) + '</span>' : "";
    const nombre = escapeHtml(it.producto + (it.opcion ? " (" + it.opcion + ")" : ""));
    return `<div class="cart-row"><div><strong>${escapeHtml(it.producto)}</strong>${opcion}<small>${detalle}</small></div><div class="qty-controls"><button type="button" class="qty-btn qty-minus" data-key="${clave}" aria-label="Restar una unidad de ${nombre}">−</button><b>${it.cantidad}</b><button type="button" class="qty-btn qty-plus" data-key="${clave}" aria-label="Sumar una unidad de ${nombre}">+</button></div></div>`;
  }).join("");
  actualizarCarrito();
}

document.addEventListener("click", function(event){
  const btn = event.target.closest(".qty-btn");
  if(!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const clave = decodeURIComponent(btn.dataset.key || "");
  cambiarCantidad(clave, btn.classList.contains("qty-plus") ? 1 : -1);
}, true);

document.addEventListener("keydown", function(event){
  if(event.key === "Escape" && panelAbierto()) cerrarCarrito();
});


/* ---------- Panel del carrito ---------- */
function abrirCarrito(){
  focoAntesDelCarrito = document.activeElement;
  ocultarEstado();
  renderCarrito();
  document.getElementById("cartPanel").classList.add("open");
  document.body.style.overflow = "hidden";
  document.querySelector(".cart-close")?.focus();
}
function cerrarCarrito(){
  document.getElementById("cartPanel").classList.remove("open");
  document.body.style.overflow = "";
  if(focoAntesDelCarrito && document.contains(focoAntesDelCarrito)) focoAntesDelCarrito.focus();
}
function cerrarCarritoSiFondo(event){ if(event.target.id === "cartPanel") cerrarCarrito(); }

function vaciarCarrito(){
  carrito = {};
  notasPedido = "";
  const notas = document.getElementById("pedidoNotas");
  if(notas) notas.value = "";
  guardarCarrito();
  sincronizarSeleccion();
  renderCarrito();
  ocultarEstado();
}

function mostrarAvisoCarrito(){
  const fab = document.querySelector(".cart-fab");
  if(!fab) return;
  if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  fab.animate([{transform:"scale(1)"},{transform:"scale(1.08)"},{transform:"scale(1)"}], {duration: 350});
}


/* ---------- WhatsApp ---------- */
function abrirWhatsApp(mensaje){
  const url = "https://wa.me/" + WHATSAPP_NUMERO + "?text=" + encodeURIComponent(mensaje);
  const ventana = window.open(url, "_blank");
  if(!ventana) window.location.href = url;   // si el navegador bloquea la ventana nueva
}

function pedirProductoWhatsApp(el){
  const producto = nombreProducto(el);
  const opcion = leerOpcion(el);
  if(opcion === null) return;
  const precio = obtenerPrecio(el);
  let mensaje = "Hola, quiero pedir en Chilango.\n\n";
  mensaje += "• " + producto + (opcion ? " (" + opcion + ")" : "");
  if(precio != null) mensaje += " — $" + formatearPrecio(precio);
  mensaje += "\n\n¿Me pueden confirmar disponibilidad?";
  abrirWhatsApp(mensaje);
}

function construirMensajePedido(){
  const d = datosFormulario();
  const lineas = ["Hola, quiero hacer un pedido en Chilango.", "", "*Pedido*"];
  Object.values(carrito).forEach(it => {
    const nombre = it.producto + (it.opcion ? " (" + it.opcion + ")" : "");
    const precio = it.precio == null ? "precio por confirmar" : "$" + formatearPrecio(it.precio) + " c/u";
    lineas.push("• " + nombre + " x" + it.cantidad + " — " + precio);
  });
  const total = totalCarrito();
  if(total > 0) lineas.push("", "*Total:* $" + formatearPrecio(total));
  lineas.push("", "*Nombre:* " + d.nombre);
  if(d.entrega === "retiro"){
    lineas.push("*Entrega:* Retiro en el local");
  } else {
    lineas.push("*Entrega:* A domicilio", "*Dirección:* " + d.direccion);
  }
  if(d.notas) lineas.push("*Notas:* " + d.notas);
  lineas.push("", "¿Me pueden confirmar disponibilidad?");
  return lineas.join("\n");
}

function enviarCarritoWhatsApp(){
  if(!Object.keys(carrito).length){
    mostrarEstado("Agrega al menos una comida al carrito.", true);
    return;
  }
  if(!validarDatosCliente()) return;
  guardarCliente();
  abrirWhatsApp(construirMensajePedido());
  mostrarEstado("Abrimos WhatsApp con tu pedido. Si ya lo enviaste, puedes vaciar el carrito.", false);
}


/* ---------- Arranque y sincronización entre pestañas ---------- */
document.addEventListener("DOMContentLoaded", () => {
  borrarStorage(CARRITO_KEY_ANTIGUA);   // formato anterior, sin opciones
  construirOpciones();
  cargarCarrito();
  const huboCambios = conciliarConMenu();
  iniciarFormulario();
  if(huboCambios) guardarCarrito();
  sincronizarSeleccion();
  actualizarCarrito();
});

window.addEventListener("storage", e => {
  if(e.key !== CARRITO_KEY && e.key !== null) return;
  cargarCarrito();
  conciliarConMenu();
  const notas = document.getElementById("pedidoNotas");
  if(notas) notas.value = notasPedido;
  sincronizarSeleccion();
  actualizarCarrito();
  if(panelAbierto()) renderCarrito();
});
