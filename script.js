
const CARRITO_KEY = "chilango_carrito";
let carrito = {};

try { carrito = JSON.parse(localStorage.getItem(CARRITO_KEY) || "{}"); } catch(e) { carrito = {}; }

function guardarCarrito(){
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  actualizarCarrito();
}

function obtenerPrecio(el){
  const raw = (el.dataset.price || "").replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function pedirProducto(el){
  const producto = el.dataset.product || el.querySelector("h3")?.textContent?.trim() || "producto";
  const precio = obtenerPrecio(el);
  const key = producto;
  if(!carrito[key]) carrito[key] = {nombre: producto, precio: precio, cantidad: 0};
  carrito[key].cantidad += 1;
  el.classList.add("selected");
  guardarCarrito();
  mostrarAvisoCarrito();
}

function cambiarCantidad(key, cambio){
  if(!carrito[key]) return;
  carrito[key].cantidad += cambio;
  if(carrito[key].cantidad <= 0) delete carrito[key];
  document.querySelectorAll(".order-item").forEach(el=>{
    const producto = el.dataset.product;
    if(producto === key) el.classList.toggle("selected", !!carrito[key]);
  });
  guardarCarrito();
  renderCarrito();
}

function totalCarrito(){
  return Object.values(carrito).reduce((sum,item)=>sum + ((item.precio ?? 0) * item.cantidad), 0);
}

function actualizarCarrito(){
  const count = Object.values(carrito).reduce((sum,item)=>sum + item.cantidad, 0);
  const badge = document.getElementById("cartCount");
  if(badge) badge.textContent = count;
  const total = document.getElementById("cartTotal");
  if(total) total.textContent = "$" + totalCarrito().toFixed(2).replace(".00","");
}

function renderCarrito(){
  const cont = document.getElementById("cartItems");
  if(!cont) return;
  const items = Object.values(carrito);
  if(!items.length){
    cont.innerHTML = '<div class="cart-empty">Tu carrito está vacío.<br>Toca las comidas que quieras agregar.</div>';
    actualizarCarrito();
    return;
  }
  cont.innerHTML = items.map(item=>{
    const subtotal = item.precio == null ? "Precio por confirmar" : "$" + (item.precio * item.cantidad).toFixed(2).replace(".00","");
    const key = encodeURIComponent(item.nombre);
    return `<div class="cart-row"><div><strong>${escapeHtml(item.nombre)}</strong><small>${item.precio == null ? "" : "$"+item.precio+" c/u"} · ${subtotal}</small></div><div class="qty-controls"><button type="button" class="qty-btn qty-minus" data-key="${key}" aria-label="Restar una unidad">−</button><b>${item.cantidad}</b><button type="button" class="qty-btn qty-plus" data-key="${key}" aria-label="Sumar una unidad">+</button></div></div>`;
  }).join("");
  actualizarCarrito();
}

document.addEventListener("click", function(event){
  const btn = event.target.closest(".qty-btn");
  if(!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const key = decodeURIComponent(btn.dataset.key || "");
  cambiarCantidad(key, btn.classList.contains("qty-plus") ? 1 : -1);
}, true);

function escapeHtml(text){
  return String(text).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function abrirCarrito(){
  renderCarrito();
  document.getElementById("cartPanel").classList.add("open");
  document.body.style.overflow="hidden";
}
function cerrarCarrito(){
  document.getElementById("cartPanel").classList.remove("open");
  document.body.style.overflow="";
}
function cerrarCarritoSiFondo(event){ if(event.target.id === "cartPanel") cerrarCarrito(); }
function vaciarCarrito(){
  carrito = {};
  document.querySelectorAll(".order-item.selected").forEach(el=>el.classList.remove("selected"));
  guardarCarrito();
  renderCarrito();
}
function mostrarAvisoCarrito(){
  const fab = document.querySelector(".cart-fab");
  if(!fab) return;
  fab.animate([{transform:"scale(1)"},{transform:"scale(1.08)"},{transform:"scale(1)"}],{duration:350});
}
function pedirProductoWhatsApp(el){
  const producto = el.dataset.product || el.querySelector("h3")?.textContent?.trim() || "producto";
  const precio = obtenerPrecio(el);
  let mensaje = "Hola, quiero pedir en Chilango.\n\n";
  mensaje += "• " + producto;
  if(precio != null) mensaje += " — $" + precio;
  mensaje += "\n\n¿Me pueden confirmar disponibilidad?";
  window.open("https://wa.me/584245445480?text=" + encodeURIComponent(mensaje), "_blank");
}

function enviarCarritoWhatsApp(){
  const items = Object.values(carrito);
  if(!items.length){ alert("Agrega al menos una comida al carrito."); return; }
  let mensaje = "Hola, quiero hacer un pedido en Chilango.\n\n";
  items.forEach(item=>{
    const precio = item.precio == null ? "Precio por confirmar" : "$" + item.precio;
    mensaje += "• " + item.nombre + " x" + item.cantidad + " — " + precio + " c/u\n";
  });
  const total = totalCarrito();
  if(total > 0) mensaje += "\nTotal: $" + total.toFixed(2).replace(".00","") + "\n";
  mensaje += "\nNegocio: Chilango\n¿Me pueden confirmar disponibilidad?";
  window.open("https://wa.me/584245445480?text=" + encodeURIComponent(mensaje), "_blank");
}

// Restaurar selección visual si el cliente vuelve a abrir el menú.
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".order-item").forEach(el=>{
    if(carrito[el.dataset.product]) el.classList.add("selected");
  });
  actualizarCarrito();
});
