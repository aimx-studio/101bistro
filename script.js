/* =========================================================
   CONFIG SUPABASE — Albis: llenar esto antes de desplegar.
   Debe coincidir con lo que uses en dashboard-caseritos.html.
   ========================================================= */
const SUPABASE_URL = "https://hotryxyvbdbizfivgfft.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdHJ5eHl2YmRiaXpmaXZnZmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDk1MDMsImV4cCI6MjA5MjM4NTUwM30.e_8rXHLVKl8gGH7r65LzCbXpLVygnHJf3lSvYXqosfw";

let caseritosCargados = false;
let caseritosMods = {}; // { [productoId]: { grupos: [...], opciones: [...] } } — plantilla de modificadores por plato

function construirItemCaserito(p, grupos, opciones, asignaciones){
  const id = "Cas" + String(p.id);
  const nombre = p.nombre || "";
  const precio = Number(p.precio) || 0;
  const desc = p.descripcion || "";
  const imgHtml = p.imagen ? `<img src="${p.imagen}" alt="${nombre}" class="foto-plato">` : "";

  const idsGrupoBase = asignaciones.filter(a => a.producto_id === p.id).map(a => a.grupo_id);
  const gruposBase = grupos.filter(g => idsGrupoBase.includes(g.id) && g.tipo !== 'texto');

  const gruposDependientes = grupos.filter(g => {
    if (!g.depende_de_opcion_id) return false;
    const opcionPadre = opciones.find(o => o.id === g.depende_de_opcion_id);
    return opcionPadre && idsGrupoBase.includes(opcionPadre.grupo_id);
  });

  const todosLosGrupos = [...gruposBase, ...gruposDependientes].sort((a,b) => a.orden - b.orden);

  // Guardamos la plantilla de modificadores del plato para generar un bloque
  // independiente por cada unidad cuando cambie la cantidad.
  caseritosMods[p.id] = { grupos: todosLosGrupos, opciones };

  // Si el plato tiene modificadores, la observación va dentro de cada pestaña (Plato 1, Plato 2...).
  // Si no tiene modificadores, se deja una sola observación general como antes.
  const obsCompartidaHtml = todosLosGrupos.length === 0
    ? `<label class="obs-label">📝 Observaciones:</label><textarea class="observaciones" rows="2" placeholder="Ej: sin ensalada, más frijoles, sin plátano..."></textarea>`
    : "";

  return `<div class="item" data-producto-id="${p.id}">
      <div class="item-linea">
        <label><input type="checkbox" class="check-plato" name="${id}" value="${nombre}"
          onchange="toggleCantidad(this); toggleDescripcion(this)"><span class="txt">${nombre}</span></label>
        <span class="precio" data-precio="${precio}">$${precio.toLocaleString("es-CO")}</span>
        <input type="number" class="cantidad" name="${id}Cantidad" value="0" min="0" disabled oninput="actualizarUnidadesCaserito(this)" onchange="calcularTotal(); actualizarUnidadesCaserito(this)">
      </div>
      <div class="descripcion">${imgHtml}${desc}<div class="unidades-caserito" id="unidades-${id}"></div>${obsCompartidaHtml}</div>
    </div>`;
}

function construirBloqueModificadores(productoId, unidad, grupos, opciones){
  const prefijo = `Cas${productoId}_u${unidad}`;
  const modsHtml = grupos.map(g => {
    const opcionesGrupo = opciones.filter(o => o.grupo_id === g.id).sort((a,b) => a.orden - b.orden);
    const inputType = g.tipo === 'multiple' ? 'checkbox' : 'radio';
    const nombreInput = `${prefijo}_g${g.id}`;
    const opcionesHtml = opcionesGrupo.map(o =>
      `<label><input type="${inputType}" name="${nombreInput}" value="${o.nombre}" data-opcion-id="${o.id}"> ${o.nombre}</label>`
    ).join("");
    const oculto = g.depende_de_opcion_id ? ' style="display:none"' : '';
    return `<div class="mod-group" data-grupo-id="${g.id}" data-depende-de-opcion="${g.depende_de_opcion_id || ''}"${oculto}>
      <span class="mod-label">${g.nombre}</span>
      <div class="mod-options">${opcionesHtml}</div>
    </div>`;
  }).join("");
  return `<div class="arma-plato unidad-plato" data-unidad="${unidad}">${modsHtml}<label class="obs-label">📝 Observaciones Plato ${unidad}:</label><textarea class="observaciones-unidad" rows="2" placeholder="Ej: sin cebolla, extra picante..."></textarea></div>`;
}

function actualizarUnidadesCaserito(inputCantidad){
  const item = inputCantidad.closest(".item");
  const cont = item?.querySelector(".unidades-caserito");
  if (!cont) return; // no es un Caserito (es de la Carta), no aplica
  const productoId = Number(item.dataset.productoId);
  const cantidad = Number(inputCantidad.value) || 0;
  const datos = caseritosMods[productoId];
  if (!datos || !datos.grupos.length) { cont.innerHTML = ""; return; }

  let bloques = cont.querySelectorAll(".unidad-plato");
  // Si bajó la cantidad, quita los bloques sobrantes desde el final
  while (bloques.length > cantidad){
    cont.removeChild(cont.lastElementChild);
    bloques = cont.querySelectorAll(".unidad-plato");
  }
  // Si subió la cantidad, agrega bloques nuevos sin tocar los que ya tenían selección
  for (let i = bloques.length + 1; i <= cantidad; i++){
    cont.insertAdjacentHTML("beforeend", construirBloqueModificadores(productoId, i, datos.grupos, datos.opciones));
  }

  actualizarTabsCaserito(cont, cantidad);
}

function actualizarTabsCaserito(cont, cantidad){
  let nav = cont.querySelector(".unidad-tabs");
  const bloques = Array.from(cont.querySelectorAll(".unidad-plato"));

  if (cantidad <= 1){
    if (nav) nav.remove();
    bloques.forEach(b => b.style.display = "block");
    return;
  }

  if (!nav){
    nav = document.createElement("div");
    nav.className = "unidad-tabs";
    cont.insertBefore(nav, cont.firstChild);
  }

  const activaPrevia = nav.querySelector(".unidad-tab.activa");
  const unidadActiva = Math.min(activaPrevia ? Number(activaPrevia.dataset.unidad) : 1, cantidad);

  nav.innerHTML = bloques.map((b, idx) => {
    const u = idx + 1;
    return `<button type="button" class="unidad-tab${u === unidadActiva ? ' activa' : ''}" data-unidad="${u}" onclick="mostrarUnidadCaserito(this)">Plato ${u}</button>`;
  }).join("");

  bloques.forEach((b, idx) => {
    b.style.display = (idx + 1 === unidadActiva) ? "block" : "none";
  });
}

function mostrarUnidadCaserito(btn){
  const cont = btn.closest(".unidades-caserito");
  const unidad = btn.dataset.unidad;
  cont.querySelectorAll(".unidad-tab").forEach(t => t.classList.toggle("activa", t === btn));
  cont.querySelectorAll(".unidad-plato").forEach(b => {
    b.style.display = (b.dataset.unidad === unidad) ? "block" : "none";
  });
}

async function cargarCaseritos(){
  if (caseritosCargados) return; // ya se cargaron en esta visita, no repetir la consulta
  const cont = document.getElementById("caseritosLista");
  try {
    const [prodResp, grupoResp, opcionResp] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/productos?activo_caserito=eq.true&select=*`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/grupos_modificadores?select=*&order=orden.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/opciones_modificador?select=*&order=orden.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    ]);
    if (!prodResp.ok || !grupoResp.ok || !opcionResp.ok) throw new Error("Respuesta no válida de Supabase");
    const productos = await prodResp.json();
    const grupos = await grupoResp.json();
    const opciones = await opcionResp.json();

    if (!productos.length){
      cont.innerHTML = '<p class="caseritos-msg">Hoy no hay Caseritos disponibles. Vuelve a intentar más tarde.</p>';
      return;
    }

    const ids = productos.map(p => p.id);
    const pmResp = await fetch(`${SUPABASE_URL}/rest/v1/producto_modificadores?producto_id=in.(${ids.join(",")})&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!pmResp.ok) throw new Error("Respuesta no válida de Supabase");
    const asignaciones = await pmResp.json();

    cont.innerHTML = productos.map(p => construirItemCaserito(p, grupos, opciones, asignaciones)).join("");
    caseritosCargados = true;
    inicializarDependenciasModificadores();
  } catch (err){
    cont.innerHTML = '<p class="caseritos-msg">No se pudieron cargar los Caseritos en este momento.</p>';
  }
}

function inicializarDependenciasModificadores(){
  document.getElementById("caseritosLista").addEventListener("change", (e) => {
    const input = e.target.closest('.mod-options input');
    if (!input) return;
    const item = input.closest(".item");
    if (!item) return;
    const grupoActual = input.closest(".mod-group");
    const opcionId = input.dataset.opcionId;

    item.querySelectorAll('.mod-options input[data-opcion-id]').forEach(opt => {
      if (opt.closest(".mod-group") !== grupoActual) return;
      const dependiente = item.querySelector(`.mod-group[data-depende-de-opcion="${opt.dataset.opcionId}"]`);
      if (dependiente && opt.dataset.opcionId !== opcionId){
        dependiente.style.display = "none";
        dependiente.querySelectorAll("input:checked").forEach(i => i.checked = false);
      }
    });

    const mostrar = item.querySelector(`.mod-group[data-depende-de-opcion="${opcionId}"]`);
    if (mostrar && input.checked) mostrar.style.display = "block";
  });
}

/* ===== Horarios ===== */
const HORA_APERTURA = 10 * 60 + 30;   // 10:30 a.m.
const HORA_CIERRE   = 22 * 60 + 15;   // 10:15 p.m.
const CASERITOS_INICIO = 0;           // TEMPORAL: pruebas, quitar después
const CASERITOS_FIN    = 23 * 60 + 59; // TEMPORAL: pruebas, quitar después
const CARTA_INICIO = 11 * 60;         // 11:00 a.m.
const CARTA_FIN    = 23 * 60;         // 11:00 p.m.

function minutosAhora(){
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes();
}

function dentroDeHorario(inicio, fin){
  const m = minutosAhora();
  return m >= inicio && m <= fin;
}

function formatoHora(min){
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "p.m." : "a.m.";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2,"0")} ${ampm}`;
}

function inicializarHorario(){
  const btnCarta = document.getElementById("btnCarta");
  const btnCaseritos = document.getElementById("btnCaseritos");
  const cerradoMsg = document.getElementById("cerradoMsg");

  if (!dentroDeHorario(HORA_APERTURA, HORA_CIERRE)){
    btnCarta.disabled = true;
    btnCaseritos.disabled = true;
    cerradoMsg.style.display = "block";
    cerradoMsg.textContent = `Por ahora no estamos recibiendo pedidos. Atendemos de ${formatoHora(HORA_APERTURA)} a ${formatoHora(HORA_CIERRE)}.`;
    return;
  }

  if (!dentroDeHorario(CASERITOS_INICIO, CASERITOS_FIN)){
    btnCaseritos.disabled = true;
  }
  if (!dentroDeHorario(CARTA_INICIO, CARTA_FIN)){
    btnCarta.disabled = true;
  }
}

/* ===== Navegación entre vistas ===== */
function mostrarCarta(){
  document.getElementById("landing").style.display = "none";
  document.getElementById("pedidoForm").style.display = "block";
  document.getElementById("seccionCarta").style.display = "block";
  document.getElementById("seccionCaseritos").style.display = "none";
}

function mostrarCaseritos(){
  document.getElementById("landing").style.display = "none";
  document.getElementById("pedidoForm").style.display = "block";
  document.getElementById("seccionCaseritos").style.display = "block";
  document.getElementById("seccionCarta").style.display = "none";
  cargarCaseritos();
}

function volverLanding(){
  document.getElementById("pedidoForm").style.display = "none";
  document.getElementById("landing").style.display = "block";
}

inicializarHorario();

/* ===== Funciones fijas de la plantilla — NO CAMBIAR ===== */
function toggleMenu(titulo) {
  const seccion = titulo.nextElementSibling;
  if (!seccion) return;
  const abierta = seccion.style.display === "block";
  seccion.style.display = abierta ? "none" : "block";
  titulo.classList.toggle("open", !abierta);
}

function toggleCantidad(checkbox) {
  const item = checkbox.closest(".item");
  if (!item) return;
  const cantidad = item.querySelector(".cantidad");
  if (!cantidad) return;
  if (checkbox.checked) {
    cantidad.disabled = false;
    if (Number(cantidad.value) === 0) cantidad.value = 1;
  } else {
    cantidad.value = 0;
    cantidad.disabled = true;
  }
  actualizarUnidadesCaserito(cantidad);
  calcularTotal();
}

function toggleDescripcion(checkbox) {
  const item = checkbox.closest(".item");
  if (!item) return;
  const desc = item.querySelector(".descripcion");
  if (!desc) return;
  desc.style.display = checkbox.checked ? "block" : "none";
}

function calcularTotal() {
  let subtotal = 0;
  let contadorEmpaque = 0;
  document.querySelectorAll(".check-plato").forEach(cb => {
    if (!cb.checked) return;
    const item = cb.closest(".item");
    if (!item) return;
    const cantidad = Number(item.querySelector(".cantidad")?.value) || 0;
    if (cantidad <= 0) return;
    const tamanoSel = item.querySelector(".tamano");
    let precio = 0;
    if (tamanoSel) {
      precio = Number(tamanoSel.value) || 0;
    } else {
      const precioSpan = item.querySelector(".precio");
      precio = Number(precioSpan?.dataset.precio) || 0;
    }
    subtotal += precio * cantidad;
    contadorEmpaque += cantidad;
  });
  const tipoEntrega = document.getElementById("tipoEntrega")?.value;
  // [SI EL RESTAURANTE COBRA DOMICILIO: descomentar]
  // if (tipoEntrega === "A domicilio") subtotal += COSTO_DOMICILIO;
  // [SI EL RESTAURANTE COBRA EMPAQUE: descomentar]
  // let empaque = (tipoEntrega === "Comer dentro del local") ? 0 : contadorEmpaque * 1500;
  // subtotal += empaque;
  document.getElementById("total").innerText = "$" + subtotal.toLocaleString("es-CO");
  document.getElementById("totalPedido").value = subtotal;
}

/* ===== Comportamiento de entrega / pago ===== */
function manejarEntrega() {
  const valor = document.getElementById("tipoEntrega").value;
  document.getElementById("direccionField").style.display = valor === "A domicilio" ? "block" : "none";
  document.getElementById("mesaField").style.display = valor === "Comer dentro del local" ? "block" : "none";
  // Domicilio sin costo adicional por ahora — costoDomicilio queda oculto.
}

function manejarPago() {
  const valor = document.getElementById("tipoPago").value;
  document.getElementById("efectivoField").style.display = valor === "Efectivo" ? "block" : "none";
}

/* ===== Envío del pedido ===== */
let ultimoEnvio = 0;
document.getElementById("pedidoForm").addEventListener("submit", function(e){
  e.preventDefault();

  if (!dentroDeHorario(HORA_APERTURA, HORA_CIERRE)){
    alert(`El restaurante ya está cerrado. Atendemos de ${formatoHora(HORA_APERTURA)} a ${formatoHora(HORA_CIERRE)}.`);
    return;
  }
  const enCaseritos = document.getElementById("seccionCaseritos").style.display === "block";
  if (enCaseritos && !dentroDeHorario(CASERITOS_INICIO, CASERITOS_FIN)){
    alert(`Los Caseritos solo se venden de ${formatoHora(CASERITOS_INICIO)} a ${formatoHora(CASERITOS_FIN)}.`);
    return;
  }
  const enCarta = document.getElementById("seccionCarta").style.display === "block";
  if (enCarta && !dentroDeHorario(CARTA_INICIO, CARTA_FIN)){
    alert(`La Carta solo se vende de ${formatoHora(CARTA_INICIO)} a ${formatoHora(CARTA_FIN)}.`);
    return;
  }

  const ahora = Date.now();
  if (ahora - ultimoEnvio < 5000) return;
  ultimoEnvio = ahora;

  const btn = document.getElementById("btnEnviar");
  btn.disabled = true;
  setTimeout(() => { btn.disabled = false; }, 5000);

  const nombre = document.getElementById("nombre").value;
  const telefono = document.getElementById("telefono").value;
  const tipoEntrega = document.getElementById("tipoEntrega").value;
  const direccion = document.getElementById("direccion").value;
  const numeroMesa = document.getElementById("numeroMesa").value;
  const tipoPago = document.getElementById("tipoPago").value;
  const efectivoMonto = document.getElementById("efectivoCliente").value;
  const especificaciones = document.getElementById("especificaciones").value;
  const total = document.getElementById("total").innerText;

  let lineas = [];
  document.querySelectorAll(".item").forEach(item => {
    const cb = item.querySelector(".check-plato");
    if (!cb || !cb.checked) return;
    const cantidad = Number(item.querySelector(".cantidad")?.value) || 0;
    if (cantidad <= 0) return;

    const bloquesUnidad = Array.from(item.querySelectorAll(".unidad-plato"));

    if (bloquesUnidad.length > 1){
      // Varias unidades: una línea por plato, cada una con sus propios modificadores y observación
      const partes = bloquesUnidad.map((bloque, idx) => {
        const modsBloque = [];
        bloque.querySelectorAll(".mod-group").forEach(group => {
          if (group.style.display === "none") return; // grupo oculto por dependencia, no se envía
          const marcados = Array.from(group.querySelectorAll('input:checked'));
          if (!marcados.length) return;
          const valores = marcados.map(i => i.value).join(", ");
          modsBloque.push(`${group.querySelector(".mod-label").textContent}: ${valores}`);
        });
        const obsUnidad = bloque.querySelector(".observaciones-unidad")?.value.trim();
        let detalle = modsBloque.join(", ");
        if (obsUnidad) detalle += (detalle ? " — " : "") + `Obs: ${obsUnidad}`;
        return `   Plato ${idx+1}${detalle ? ": " + detalle : ""}`;
      });
      lineas.push(`• ${cb.value} x${cantidad}\n` + partes.join("\n"));

    } else if (bloquesUnidad.length === 1){
      // Una sola unidad con modificadores: se mantiene el formato de siempre
      const bloque = bloquesUnidad[0];
      const mods = [];
      bloque.querySelectorAll(".mod-group").forEach(group => {
        if (group.style.display === "none") return;
        const marcados = Array.from(group.querySelectorAll('input:checked'));
        if (!marcados.length) return;
        const valores = marcados.map(i => i.value).join(", ");
        mods.push(`${group.querySelector(".mod-label").textContent}: ${valores}`);
      });
      const saborTxt = mods.length ? ` (${mods.join(", ")})` : "";
      const obs = bloque.querySelector(".observaciones-unidad")?.value.trim();
      const obsTxt = obs ? ` — Obs: ${obs}` : "";
      lineas.push(`• ${cb.value}${saborTxt} x${cantidad}${obsTxt}`);

    } else {
      // Plato sin modificadores: observación general, como siempre
      const obs = item.querySelector(".observaciones")?.value.trim();
      const obsTxt = obs ? ` — Obs: ${obs}` : "";
      lineas.push(`• ${cb.value} x${cantidad}${obsTxt}`);
    }
  });

  if (lineas.length === 0) {
    alert("Selecciona al menos un plato antes de enviar el pedido.");
    btn.disabled = false;
    return;
  }

  let mensaje = `101 Bistró:\n\n`;
  mensaje += lineas.join("\n") + "\n\n";
  mensaje += `👤 Nombre: ${nombre}\n📞 Teléfono: ${telefono}\n📦 Entrega: ${tipoEntrega}\n`;
  if (tipoEntrega === "A domicilio") mensaje += `📍 Dirección: ${direccion}\n`;
  if (tipoEntrega === "Comer dentro del local") mensaje += `🔢 Mesa: ${numeroMesa}\n`;
  mensaje += `💰 Pago: ${tipoPago}\n`;
  if (tipoPago === "Efectivo" && efectivoMonto) mensaje += `💵 Paga con: ${efectivoMonto}\n`;
  if (especificaciones) mensaje += `📒 Especificaciones: ${especificaciones}\n`;
  mensaje += `\n💸 Total: ${total}`;

  const numero = "573108191468";
  window.location.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje);
});

/* ===== Vaciar pedido (con confirmación) ===== */
function confirmarVaciarPedido(){
  const hayAlgo = Array.from(document.querySelectorAll(".check-plato")).some(cb => cb.checked);
  if (!hayAlgo){
    alert("El pedido ya está vacío.");
    return;
  }
  if (confirm("¿Seguro que quieres vaciar todo el pedido? Esta acción no se puede deshacer.")){
    vaciarPedido();
  }
}

function vaciarPedido(){
  document.querySelectorAll(".check-plato").forEach(cb => { cb.checked = false; });
  document.querySelectorAll(".cantidad").forEach(inp => { inp.value = 0; inp.disabled = true; });
  document.querySelectorAll(".descripcion").forEach(d => { d.style.display = "none"; });
  document.querySelectorAll(".unidades-caserito").forEach(u => { u.innerHTML = ""; });
  document.querySelectorAll(".observaciones, .observaciones-unidad").forEach(t => { t.value = ""; });
  calcularTotal();
}