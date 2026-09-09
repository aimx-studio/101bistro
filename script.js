/* =========================================================
   CONFIG SUPABASE — Albis: llenar esto antes de desplegar.
   Debe coincidir con lo que uses en dashboard-caseritos.html.
   ========================================================= */
const SUPABASE_URL = "https://hotryxyvbdbizfivgfft.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdHJ5eHl2YmRiaXpmaXZnZmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDk1MDMsImV4cCI6MjA5MjM4NTUwM30.e_8rXHLVKl8gGH7r65LzCbXpLVygnHJf3lSvYXqosfw";

// Sopa del día: se llena una sola vez desde Supabase y se inyecta en cada
// pestaña "Sopa del día" de cada plato cuando se genera (ver construirBloqueModificadoresMulti).
let sopaDelDiaHtml = "";
async function cargarSopaDelDia(){
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/opciones_modificador?grupo_id=eq.9&disponible_hoy=eq.true&select=*&order=orden.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!resp.ok) throw new Error("Respuesta no válida de Supabase");
    const sopas = await resp.json();
    sopaDelDiaHtml = sopas.length
      ? sopas.map(s => `<label><input type="radio" name="SopaDelDiaOpcion" value="${s.nombre}"> ${s.nombre}</label>`).join("")
      : `<span style="color:var(--dim);font-size:0.78rem;">Hoy no hay sopas disponibles, elige Frijol.</span>`;
  } catch (err){
    sopaDelDiaHtml = `<span style="color:var(--dim);font-size:0.78rem;">No se pudo cargar la sopa del día.</span>`;
  }
}

// ===== Adicionales dentro de cada plato (excepto Postres y Bebidas) =====
const ADICIONALES_DISPONIBLES = [
  { nombre: "Cascos de Papa 130gr", precio: 12000 },
  { nombre: "Puré de Papa 120gr", precio: 9000 },
  { nombre: "Patacones Crocantes", precio: 7000 },
  { nombre: "Ensalada 101", precio: 5000 }
];

let adicionalesContador = 0;

function construirAdicionalesHtml(){
  adicionalesContador++;
  const prefijo = `adic${adicionalesContador}`;
  const filas = ADICIONALES_DISPONIBLES.map((a, idx) => {
    return `<div class="adicional-linea">
      <label class="adicional-check"><input type="checkbox" class="check-adicional" name="${prefijo}_${idx}" data-nombre="${a.nombre}" data-precio="${a.precio}" onchange="toggleAdicionalCantidad(this)"> ${a.nombre} <span class="adicional-precio">$${a.precio.toLocaleString("es-CO")}</span></label>
      <input type="number" class="cantidad-adicional" name="${prefijo}_${idx}Cantidad" value="0" min="0" disabled onchange="calcularTotal()">
    </div>`;
  }).join("");
  return `<div class="adicionales-bloque">
    <button type="button" class="btn-toggle-adicionales" onclick="toggleAdicionalesPanel(this)">➕ Agregar adicionales <span class="adicionales-flecha">▾</span></button>
    <div class="adicionales-lista">${filas}</div>
  </div>`;
}

function toggleAdicionalesPanel(btn){
  const lista = btn.nextElementSibling;
  const abierto = lista.classList.toggle("abierta");
  btn.classList.toggle("activo", abierto);
}

function toggleAdicionalCantidad(checkbox){
  const linea = checkbox.closest(".adicional-linea");
  const cantidad = linea.querySelector(".cantidad-adicional");
  if (!cantidad) return;
  if (checkbox.checked){
    cantidad.disabled = false;
    if (Number(cantidad.value) === 0) cantidad.value = 1;
  } else {
    cantidad.value = 0;
    cantidad.disabled = true;
  }
  calcularTotal();
}

function extraerAdicionalesItem(item){
  const extras = [];
  item.querySelectorAll(".check-adicional").forEach(cb => {
    if (!cb.checked) return;
    const linea = cb.closest(".adicional-linea");
    const cantidad = Number(linea.querySelector(".cantidad-adicional")?.value) || 0;
    if (cantidad <= 0) return;
    extras.push(`➕ ${cb.dataset.nombre}${cantidad > 1 ? ` x${cantidad}` : ""}`);
  });
  return extras;
}





function actualizarTabsCaserito(cont, cantidad){
  let nav = cont.querySelector(".unidad-tabs");
  const bloques = Array.from(cont.querySelectorAll(".unidad-plato"));

  if (cantidad <= 1){
    if (nav) nav.remove();
    const hintExistente = cont.querySelector(".tabs-hint");
    if (hintExistente) hintExistente.remove();
    bloques.forEach(b => b.style.display = "block");
    return;
  }

  let hint = cont.querySelector(".tabs-hint");
  if (!hint){
    hint = document.createElement("p");
    hint.className = "tabs-hint";
    hint.textContent = "👉 Toca cada pestaña para elegir diferente en cada plato";
    cont.insertBefore(hint, cont.firstChild);
  }

  if (!nav){
    nav = document.createElement("div");
    nav.className = "unidad-tabs";
    cont.insertBefore(nav, hint.nextSibling);
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

// Extrae los modificadores de un plato para el mensaje de WhatsApp.
// Si un grupo (ej. "¿Desea arroz?") tiene un grupo "hijo" visible con respuesta
// (ej. "Tipo de arroz"), se muestra SOLO la respuesta del hijo (ej. "Arroz de coco"),
// sin repetir la del padre ni el nombre del grupo. Si no hay hijo respondido,
// se muestra el padre normal (ej. "Sin arroz"). Grupos sin hijos (Ensalada, Adicionales)
// no cambian su comportamiento.
function extraerModificadoresUnidad(scopeElement){
  const mods = [];
  const grupos = Array.from(scopeElement.querySelectorAll(".mod-group"));

  grupos.forEach(group => {
    if (group.style.display === "none") return; // oculto por dependencia, no se envía
    if (group.dataset.dependeDeOpcion) return; // es un grupo "hijo", se procesa desde su padre

    const marcados = Array.from(group.querySelectorAll('input:checked'));
    if (!marcados.length) return; // nada elegido en este grupo

    const opcionId = marcados[0].dataset.opcionId;
    if (opcionId) { // solo los modificadores de Caseritos (Supabase) usan data-opcion-id; los de la Carta no
      const grupoHijo = grupos.find(g => g.dataset.dependeDeOpcion === opcionId && g.style.display !== "none");
      if (grupoHijo){
        const marcadosHijo = Array.from(grupoHijo.querySelectorAll('input:checked'));
        if (marcadosHijo.length){
          mods.push(marcadosHijo.map(i => i.value).join(", "));
          return; // se usó la respuesta del hijo, no la del padre
        }
      }
    }

    const valores = marcados.map(i => i.value).join(", ");
    mods.push(valores); // sin etiqueta del grupo, solo el valor elegido
  });

  return mods;
}

/* ===== Generalizar pestañas por unidad a los platos de la Carta que tienen modificadores ===== */
let multiUnidadPlantillas = {}; // { [itemId]: { gruposHtml: "..." } } — plantilla de modificadores por plato de la Carta
let multiUnidadContador = 0;

function inicializarModificadoresCarta(){
  document.querySelectorAll("#seccionCarta .item, #seccionCaseritos .item").forEach(item => {
    const seccion = item.closest(".menu-section");
    const titulo = seccion?.querySelector("h2")?.textContent || "";
    const incluirAdicionales = !(titulo.includes("Postres") || titulo.includes("Bebidas"));

    const armaPlato = item.querySelector(".arma-plato"); // puede no existir — no todos los platos tienen modificadores
    const gruposHtml = armaPlato ? armaPlato.innerHTML : "";

    multiUnidadContador++;
    const itemId = "carta" + multiUnidadContador;
    item.dataset.multiId = itemId;

    multiUnidadPlantillas[itemId] = { gruposHtml, incluirAdicionales };

    const cont = document.createElement("div");
    cont.className = "unidades-caserito"; // reutiliza el mismo sistema visual de pestañas de Caseritos
    cont.id = "unidades-" + itemId;

    const desc = item.querySelector(".descripcion");
    const obsLabel = desc?.querySelector(".obs-label");
    if (armaPlato){
      armaPlato.parentNode.insertBefore(cont, armaPlato);
      armaPlato.remove();
    } else if (obsLabel){
      obsLabel.insertAdjacentElement("beforebegin", cont);
    } else if (desc){
      desc.appendChild(cont);
    }

    // Evita duplicar campo de observaciones: ya queda uno por unidad ("Observaciones Plato N")
    const obsCompartida = item.querySelector(".observaciones");
    if (obsCompartida) {
      obsCompartida.previousElementSibling?.remove(); // quita el label "📝 Observaciones:"
      obsCompartida.remove();
    }

    const cantidad = item.querySelector(".cantidad");
    cantidad.setAttribute("oninput", "actualizarUnidadesMulti(this)");
    cantidad.setAttribute("onchange", "calcularTotal(); actualizarUnidadesMulti(this)");
  });
}

function construirBloqueModificadoresMulti(itemId, unidad, gruposHtml, incluirAdicionales){
  // Renombra los "name" de los inputs para que cada unidad tenga su propia selección independiente
  let conNombresUnicos = gruposHtml.replace(/name="([^"]+)"/g, `name="${itemId}_u${unidad}_$1"`);
  // Inyecta las sopas del día disponibles hoy en el placeholder vacío correspondiente
  conNombresUnicos = conNombresUnicos.replace('<div class="mod-options sopa-opciones-lista"></div>', `<div class="mod-options sopa-opciones-lista">${sopaDelDiaHtml}</div>`);
  const adicionalesUnidadHtml = incluirAdicionales ? construirAdicionalesHtml() : "";
  return `<div class="arma-plato unidad-plato" data-unidad="${unidad}">${conNombresUnicos}${adicionalesUnidadHtml}<label class="obs-label">📝 Observaciones Plato ${unidad}:</label><textarea class="observaciones-unidad" rows="2" placeholder="Ej: sin cebolla, extra picante..."></textarea></div>`;
}

function actualizarUnidadesMulti(inputCantidad){
  const item = inputCantidad.closest(".item");
  const itemId = item?.dataset.multiId;
  if (!itemId) return;
  const cont = item.querySelector(".unidades-caserito");
  if (!cont) return;
  const cantidad = Number(inputCantidad.value) || 0;
  const plantilla = multiUnidadPlantillas[itemId];
  if (!plantilla) return;

  let bloques = cont.querySelectorAll(".unidad-plato");
  while (bloques.length > cantidad){
    cont.removeChild(cont.lastElementChild);
    bloques = cont.querySelectorAll(".unidad-plato");
  }
  for (let i = bloques.length + 1; i <= cantidad; i++){
    cont.insertAdjacentHTML("beforeend", construirBloqueModificadoresMulti(itemId, i, plantilla.gruposHtml, plantilla.incluirAdicionales));
  }

  actualizarTabsCaserito(cont, cantidad);
}

function inicializarDependenciasModificadores(){
  document.getElementById("pedidoForm").addEventListener("change", (e) => {
    const input = e.target.closest('.mod-options input');
    if (!input) return;
    // Buscar dentro de la pestaña específica (Plato 1, Plato 2...) en vez de todo el plato,
    // para que no se cruce la información entre unidades distintas.
    const scope = input.closest(".unidad-plato") || input.closest(".item");
    if (!scope) return;
    const grupoActual = input.closest(".mod-group");
    const opcionId = input.dataset.opcionId;

    scope.querySelectorAll('.mod-options input[data-opcion-id]').forEach(opt => {
      if (opt.closest(".mod-group") !== grupoActual) return;
      const dependiente = scope.querySelector(`.mod-group[data-depende-de-opcion="${opt.dataset.opcionId}"]`);
      if (dependiente && opt.dataset.opcionId !== opcionId){
        dependiente.style.display = "none";
        dependiente.querySelectorAll("input:checked").forEach(i => i.checked = false);
      }
    });

    const mostrar = scope.querySelector(`.mod-group[data-depende-de-opcion="${opcionId}"]`);
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
}

function volverLanding(){
  document.getElementById("pedidoForm").style.display = "none";
  document.getElementById("landing").style.display = "block";
}

inicializarHorario();
inicializarModificadoresCarta();
inicializarDependenciasModificadores();
cargarSopaDelDia();

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
  actualizarUnidadesMulti(cantidad);
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

  document.querySelectorAll(".check-adicional").forEach(cb => {
    if (!cb.checked) return;
    const linea = cb.closest(".adicional-linea");
    const cantidadAd = Number(linea?.querySelector(".cantidad-adicional")?.value) || 0;
    if (cantidadAd <= 0) return;
    const precioAd = Number(cb.dataset.precio) || 0;
    subtotal += precioAd * cantidadAd;
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

  let productosPedido = [];
  document.querySelectorAll(".item").forEach(item => {
    const cb = item.querySelector(".check-plato");
    if (!cb || !cb.checked) return;
    const cantidad = Number(item.querySelector(".cantidad")?.value) || 0;
    if (cantidad <= 0) return;

    const tamanoSel = item.querySelector(".tamano");
    const precioSpan = item.querySelector(".precio");
    const precioUnitario = tamanoSel ? (Number(tamanoSel.value) || 0) : (Number(precioSpan?.dataset.precio) || 0);

    const esBebida = item.dataset.categoria === "bebida";
    const bloquesUnidad = Array.from(item.querySelectorAll(".unidad-plato"));

    if (bloquesUnidad.length > 1){
      // Varias unidades: solo se separan en líneas distintas las que de verdad
      // tienen algo diferente (modificadores, adicionales u observación).
      // Las que quedaron idénticas entre sí se agrupan como "N × Plato".
      const unidadesInfo = bloquesUnidad.map(bloque => {
        const extras = extraerModificadoresUnidad(bloque);
        extras.push(...extraerAdicionalesItem(bloque));
        const obsUnidad = bloque.querySelector(".observaciones-unidad")?.value.trim();
        if (obsUnidad) extras.push(`Observación: ${obsUnidad}`);
        return { extras, clave: JSON.stringify(extras) };
      });

      const grupos = [];
      unidadesInfo.forEach(u => {
        const existente = grupos.find(g => g.clave === u.clave);
        if (existente) existente.cantidad++;
        else grupos.push({ clave: u.clave, extras: u.extras, cantidad: 1 });
      });

      grupos.forEach(g => {
        productosPedido.push({ nombre: cb.value, cantidad: g.cantidad, precioLinea: precioUnitario * g.cantidad, extras: g.extras, esBebida });
      });

    } else if (bloquesUnidad.length === 1){
      const bloque = bloquesUnidad[0];
      const extras = extraerModificadoresUnidad(bloque);
      extras.push(...extraerAdicionalesItem(bloque));
      const obs = bloque.querySelector(".observaciones-unidad")?.value.trim();
      if (obs) extras.push(`Observación: ${obs}`);
      productosPedido.push({ nombre: cb.value, cantidad, precioLinea: precioUnitario * cantidad, extras, esBebida });

    } else {
      const obs = item.querySelector(".observaciones")?.value.trim();
      const extras = extraerAdicionalesItem(item);
      if (obs) extras.push(`Observación: ${obs}`);
      productosPedido.push({ nombre: cb.value, cantidad, precioLinea: precioUnitario * cantidad, extras, esBebida });
    }
  });

  // Validar modificadores obligatorios en Caseritos: "Acompañamiento principal", "¿Desea guarnición?" y "Sopa del día" (solo si eligió Sopa)
  const GRUPOS_OBLIGATORIOS = ["Acompañamiento principal", "¿Desea guarnición?", "Sopa del día"];
  let faltante = null;

  document.querySelectorAll(".item").forEach(item => {
    if (faltante) return; // ya se encontró un error, no seguir buscando
    const cb = item.querySelector(".check-plato");
    if (!cb || !cb.checked) return;
    const cantidad = Number(item.querySelector(".cantidad")?.value) || 0;
    if (cantidad <= 0) return;

    const bloquesUnidad = Array.from(item.querySelectorAll(".unidad-plato"));
    if (!bloquesUnidad.length) return; // plato sin modificadores, no aplica

    bloquesUnidad.forEach((bloque, idx) => {
      if (faltante) return;
      GRUPOS_OBLIGATORIOS.forEach(nombreGrupo => {
        if (faltante) return;
        const grupo = Array.from(bloque.querySelectorAll(".mod-group")).find(g => {
          if (g.style.display === "none") return false; // grupo oculto por dependencia, no aplica
          return g.querySelector(".mod-label")?.textContent === nombreGrupo;
        });
        if (!grupo) return; // este plato no tiene ese grupo asignado, no aplica
        const marcado = grupo.querySelector("input:checked");
        if (!marcado) {
          const etiqueta = bloquesUnidad.length > 1 ? ` (Plato ${idx + 1})` : "";
          faltante = `${cb.value}${etiqueta}: falta elegir "${nombreGrupo}"`;
        }
      });
    });
  });

  if (faltante) {
    alert(`Falta completar tu pedido:\n\n${faltante}`);
    btn.disabled = false;
    return;
  }

  if (productosPedido.length === 0) {
    alert("Selecciona al menos un plato antes de enviar el pedido.");
    btn.disabled = false;
    return;
  }

  let mensaje = `🍽️  NUEVO PEDIDO\n\n`;
  mensaje += `👤 Cliente: ${nombre}\n📞 WhatsApp: ${telefono}\n`;

  mensaje += `\n━━━━━━━━━━━━━━━━━\n\n🛒 PEDIDO\n\n`;
  mensaje += productosPedido.map(p => {
    if (p.esBebida && p.extras.length){
      return `${p.cantidad} × ${p.nombre} — ${p.extras.join(" — ")}`;
    }
    let bloque = `${p.cantidad} × ${p.nombre}`;
    if (p.extras.length) bloque += "\n" + p.extras.map(e => `　• ${e}`).join("\n");
    return bloque;
  }).join("\n\n");

  mensaje += `\n\n━━━━━━━━━━━━━━━━━\n\n📦 Entrega: ${tipoEntrega}\n`;
  if (tipoEntrega === "A domicilio") mensaje += `📍 Dirección: ${direccion}\n`;
  if (tipoEntrega === "Comer dentro del local") mensaje += `🔢 Mesa: ${numeroMesa}\n`;
  mensaje += `\n💰 Pago: ${tipoPago}\n`;
  if (tipoPago === "Efectivo" && efectivoMonto) mensaje += `💵 Paga con: ${efectivoMonto}\n`;
  if (especificaciones) mensaje += `📒 Especificaciones: ${especificaciones}\n`;

  mensaje += `\n💸 TOTAL: ${total}`;

  // ===== Registro en Google Sheets (silencioso, no bloquea el envío a WhatsApp) =====
  const platosTexto = productosPedido.map(p => {
    let linea = `${p.cantidad} × ${p.nombre}`;
    if (p.extras.length) linea += " (" + p.extras.join(", ") + ")";
    return linea;
  }).join("\n");

  const formData = new FormData();
  formData.append('entry.1663713726', nombre);
  formData.append('entry.856172361', telefono);
  formData.append('entry.745554867', platosTexto);
  formData.append('entry.1670087538', tipoEntrega);
  formData.append('entry.879395181', direccion || '');
  formData.append('entry.175498978', tipoPago);
  formData.append('entry.1313055968', especificaciones || '');
  formData.append('entry.296477633', `${total} COP`);

  fetch('https://docs.google.com/forms/d/e/1FAIpQLSeFreSTyhy0Y3Hl5t6yZhrwZLa7EsGCMIDS7ToFPzchY3-RFQ/formResponse', {
    method: 'POST',
    mode: 'no-cors',
    body: formData
  });

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

/* ===== Mejoras al campo de cantidad (evitar tener que borrar manualmente) ===== */
// Al tocar el campo, selecciona el número que ya tiene para que escribir lo reemplace directo
document.addEventListener("focusin", (e) => {
  if (e.target.classList && e.target.classList.contains("cantidad")) {
    e.target.select();
  }
});

// Si el plato está marcado y el cliente deja el campo en 0 o vacío, vuelve a 1 automáticamente
document.addEventListener("focusout", (e) => {
  if (e.target.classList && e.target.classList.contains("cantidad")) {
    const item = e.target.closest(".item");
    const cb = item?.querySelector(".check-plato");
    if (cb && cb.checked) {
      const valor = Number(e.target.value);
      if (!valor || valor < 1) {
        e.target.value = 1;
        actualizarUnidadesMulti(e.target);
        calcularTotal();
      }
    }
  }
});